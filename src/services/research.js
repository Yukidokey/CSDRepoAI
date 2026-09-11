import { supabase } from "../lib/supabaseClient";
import { jsPDF } from "jspdf";

function buildStoragePath(userId, file) {
  const originalName = file?.name || "upload";
  const lastDot = originalName.lastIndexOf(".");
  const extension = lastDot >= 0 ? originalName.slice(lastDot) : "";
  const baseName = lastDot >= 0 ? originalName.slice(0, lastDot) : originalName;

  const sanitizedBase = baseName
    .normalize("NFKD")
    .replace(/[^\u0000-\u007F]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .trim();

  const sanitizedExtension = extension
    .normalize("NFKD")
    .replace(/[^\u0000-\u007F]/g, "")
    .replace(/[^a-zA-Z0-9.]+/g, "");

  const sanitizedName = `${sanitizedBase || "file"}${sanitizedExtension || ""}`.slice(0, 180) || `upload${sanitizedExtension || ""}`;

  return `${userId}/${Date.now()}_${sanitizedName}`;
}

/** Research Submission Module: student submits a new paper + files */
export async function submitResearch({
  title,
  abstract,
  authors,
  adviser,
  academicYear,
  semester,
  program,
  keywords,
  sdgTags,
  category,
  manuscriptFile,
  sourceCodeFile,
  ieeeFile,
  userId,
}) {
  const normalizedTitle = title.trim().replace(/\s+/g, " ");
  if (!normalizedTitle) throw new Error("Research title is required.");

  const { data: existingTitle, error: titleCheckError } = await supabase
    .from("research_papers")
    .select("id")
    .ilike("title", normalizedTitle)
    .neq("status", "rejected")
    .limit(1)
    .maybeSingle();

  if (titleCheckError) throw titleCheckError;
  if (existingTitle) {
    throw new Error("A research paper with this title already exists. Please choose a different title.");
  }

  const uploads = {};

  for (const [key, file] of Object.entries({
    file_url: manuscriptFile,
    source_code_url: sourceCodeFile,
    ieee_paper_url: ieeeFile,
  })) {
    if (!file) continue;
    const path = buildStoragePath(userId, file);
    const { error: uploadError } = await supabase.storage
      .from("research-files")
      .upload(path, file);
    if (uploadError) throw uploadError;
    const { data: pub } = supabase.storage.from("research-files").getPublicUrl(path);
    uploads[key] = pub.publicUrl;
  }

  const { data, error } = await supabase
    .from("research_papers")
    .insert({
      title: normalizedTitle,
      abstract,
      authors,
      adviser,
      academic_year: academicYear,
      semester,
      program,
      keywords,
      sdg_tags: sdgTags,
      submitted_by: userId,
      status: "pending",
      ...uploads,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("A research paper with this title already exists. Please choose a different title.");
    }
    throw error;
  }

  await supabase.from("submission_logs").insert({
    paper_id: data.id,
    action: "submitted",
    actor_id: userId,
    detail: { category, metadata_source: "ai_assisted_document_analysis" },
  });

  triggerEmbedding(data.id);

  return data;
}

/** Fire-and-forget: asks the Genkit server to embed a paper for semantic
 *  search. Never blocks or fails the submission flow — if the Genkit
 *  server isn't configured/running, keyword search still works fine,
 *  and `npm run reindex` in genkit-server can backfill it later. */
function triggerEmbedding(paperId) {
  const embedUrl = import.meta.env.VITE_GENKIT_EMBED_URL;
  if (!embedUrl) return;

  fetch(embedUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paperId }),
  }).catch((error) => {
    console.warn("Genkit embedding request failed (non-fatal):", error);
  });
}

/** Research Submission Module: student's own submission history + status */
export async function getMySubmissions(userId) {
  const { data, error } = await supabase
    .from("research_papers")
    .select("*")
    .eq("submitted_by", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

/** Research Archive Module: browse approved papers */
export async function getApprovedPapers({ limit = 50 } = {}) {
  const { data, error } = await supabase
    .from("research_papers")
    .select("*")
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function deleteResearchPaper(paper) {
  const fileUrls = [paper.file_url, paper.source_code_url, paper.ieee_paper_url]
    .flatMap(getResearchFileUrls);
  const storagePaths = fileUrls
    .map((url) => getResearchStoragePath(url))
    .filter(Boolean);

  if (storagePaths.length > 0) {
    const { error: storageError } = await supabase.storage.from("research-files").remove(storagePaths);
    if (storageError) throw storageError;
  }

  const { error } = await supabase.from("research_papers").delete().eq("id", paper.id);
  if (error) throw error;
}

export function getResearchFileUrls(fileUrl) {
  if (!fileUrl) return [];
  if (Array.isArray(fileUrl)) return fileUrl.filter(Boolean);

  try {
    const parsed = JSON.parse(fileUrl);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [fileUrl];
  } catch {
    return [fileUrl];
  }
}

function getResearchStoragePath(url) {
  const marker = "/storage/v1/object/public/research-files/";
  const markerIndex = url.indexOf(marker);
  return markerIndex >= 0 ? decodeURIComponent(url.slice(markerIndex + marker.length)) : null;
}

async function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("Could not read research page."));
    reader.readAsDataURL(blob);
  });
}

async function loadResearchImage(url) {
  let blob;
  const storageMarker = "/storage/v1/object/public/research-files/";
  const markerIndex = url.indexOf(storageMarker);
  if (markerIndex >= 0) {
    const storagePath = decodeURIComponent(url.slice(markerIndex + storageMarker.length));
    const { data, error } = await supabase.storage.from("research-files").download(storagePath);
    if (error) throw new Error(`Could not load archived page: ${error.message}`);
    blob = data;
  } else {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Could not load archived page (${response.status}).`);
    blob = await response.blob();
  }
  const dataUrl = await blobToDataUrl(blob);
  const image = await new Promise((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("Could not prepare an archived research page."));
    element.src = dataUrl;
  });
  return { dataUrl, image };
}

async function createLegacyResearchPdf(urls) {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  for (let index = 0; index < urls.length; index += 1) {
    const { dataUrl, image } = await loadResearchImage(urls[index]);
    const scale = Math.min(pageWidth / image.width, pageHeight / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    if (index > 0) pdf.addPage();
    pdf.addImage(dataUrl, "JPEG", (pageWidth - width) / 2, (pageHeight - height) / 2, width, height);
  }

  return pdf.output("blob");
}

export async function openResearchFile(paper) {
  const urls = getResearchFileUrls(paper.file_url);
  if (!urls.length) return;

  if (urls.length === 1) {
    window.open(urls[0], "_blank", "noopener,noreferrer");
    return;
  }

  const popup = window.open("", "_blank");
  if (popup) popup.document.write("<p>Preparing research document...</p>");

  try {
    const pdfBlob = await createLegacyResearchPdf(urls);
    const pdfUrl = URL.createObjectURL(pdfBlob);

    try {
      const path = `ocr-scans/${Date.now()}_research.pdf`;
      const { error: uploadError } = await supabase.storage.from("research-files").upload(path, pdfBlob, {
        contentType: "application/pdf",
        upsert: false,
      });
      if (!uploadError) {
        const { data: publicFile } = supabase.storage.from("research-files").getPublicUrl(path);
        const { error: updateError } = await supabase.from("research_papers").update({ file_url: publicFile.publicUrl }).eq("id", paper.id);
        if (updateError) console.warn("Converted PDF opened but could not update archive record.", updateError.message);
      }
    } catch (conversionSaveError) {
      console.warn("Could not save converted OCR PDF; opening temporary PDF instead.", conversionSaveError);
    }

    if (popup) popup.location.href = pdfUrl;
    else window.open(pdfUrl, "_blank", "noopener,noreferrer");
  } catch (error) {
    if (popup) popup.close();
    throw new Error(`Could not create the research PDF. ${error.message}`);
  }
}

/** Submission Review and Approval Module: pending queue for admin */
export async function getPendingSubmissions() {
  const { data, error } = await supabase
    .from("research_papers")
    .select("*, profiles:submitted_by(full_name, student_number)")
    .in("status", ["pending", "under_review"])
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function getAuditTrail({ limit = 10 } = {}) {
  const { data, error } = await supabase
    .from("submission_logs")
    .select("*, paper:paper_id(title), actor:actor_id(full_name)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data || []).map((entry) => ({
    ...entry,
    paperTitle: entry.paper?.title || "Unknown paper",
    actorName: entry.actor?.full_name || "System",
  }));
}

/** Research Analytics Module: best-effort view/download tracking.
 *  Never blocks the UI — if it fails, we just don't count that one. */
export async function incrementViewCount(paperId) {
  const { error } = await supabase.rpc("increment_view_count", { p_paper_id: paperId });
  if (error) console.error("Failed to record view:", error.message);
}

export async function incrementDownloadCount(paperId) {
  const { error } = await supabase.rpc("increment_download_count", { p_paper_id: paperId });
  if (error) console.error("Failed to record download:", error.message);
}
export async function reviewSubmission({ paperId, status, notes, reviewerId }) {
  const { data, error } = await supabase
    .from("research_papers")
    .update({
      status,
      review_notes: notes,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", paperId)
    .select()
    .single();
  if (error) throw error;

  await supabase.from("submission_logs").insert({
    paper_id: paperId,
    action: "status_changed",
    actor_id: reviewerId,
    detail: { status, notes },
  });

  return data;
}
