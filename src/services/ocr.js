import { createWorker, PSM, OEM } from "tesseract.js";
import { jsPDF } from "jspdf";
import { supabase } from "../lib/supabaseClient";

/**
 * OCR Digitization Module
 *
 * Runs Tesseract.js entirely in the browser (no server needed) to scan
 * images of hardbound research documents and extract text. `onProgress`
 * receives a 0-1 value you can wire into a progress bar.
 */
export async function scanDocument(imageFileOrUrl, onProgress) {
  const worker = await createWorker("eng", 1, {
    logger: (m) => {
      if (m.status === "recognizing text" && onProgress) {
        onProgress(m.progress);
      }
    },
  });

  try {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
      preserve_interword_spaces: "1",
    });

    const {
      data: { text, confidence },
    } = await worker.recognize(imageFileOrUrl);
    return { text, confidence };
  } finally {
    await worker.terminate();
  }
}

export async function scanDocuments(imageFiles, onProgress) {
  const pages = [];
  const totalPages = imageFiles.length;
  const worker = await createWorker("eng", 1, {
    logger: (m) => {
      if (m.status === "recognizing text" && onProgress) {
        onProgress(Math.max(0.05, m.progress), pages.length + 1, totalPages);
      }
    },
  });

  try {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.AUTO,
      preserve_interword_spaces: "1",
      textord_heavy_nr: "1",
    });

    for (let index = 0; index < imageFiles.length; index += 1) {
      const file = imageFiles[index];
      const { data: { text } } = await worker.recognize(file);

      pages.push({
        pageNumber: index + 1,
        text: cleanOcrText(text),
      });

      if (onProgress) {
        onProgress(1, index + 1, totalPages);
      }
    }
  } finally {
    await worker.terminate();
  }

  const text = pages
    .map((page) => `--- Page ${page.pageNumber} ---\n${page.text}`)
    .join("\n\n");

  return { text, pages };
}

function cleanOcrText(rawText) {
  return rawText
    .replace(/\r/g, "")
    .replace(/\t+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Downscales/recompresses a scanned page image before it's uploaded for
 * archival storage. OCR has already run on the original file by this
 * point (see scanDocuments) — the archive copy only needs to be legible
 * to a human reader, not full camera resolution, so this is a large,
 * safe win for upload time on phone-captured pages (often 3-8MB each).
 * Falls back to the original file if compression fails for any reason.
 */
async function compressPageImage(file, { maxDimension = 1800, quality = 0.82 } = {}) {
  if (!file.type?.startsWith("image/") || file.type === "image/gif") return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob || blob.size >= file.size) return file; // compression didn't help, keep original

    const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], newName, { type: "image/jpeg" });
  } catch {
    return file; // never let a compression hiccup block the archive
  }
}

async function imageFileToDataUrl(file) {
  const compressed = await compressPageImage(file);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ dataUrl: reader.result, file: compressed });
    reader.onerror = () => reject(reader.error || new Error("Could not read scanned page."));
    reader.readAsDataURL(compressed);
  });
}

async function createResearchPdf(files, { onProgress } = {}) {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  for (let index = 0; index < files.length; index += 1) {
    const { dataUrl, file } = await imageFileToDataUrl(files[index]);
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Could not prepare scanned page for PDF."));
      element.src = dataUrl;
    });
    const scale = Math.min(pageWidth / image.width, pageHeight / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    const x = (pageWidth - width) / 2;
    const y = (pageHeight - height) / 2;

    if (index > 0) pdf.addPage();
    pdf.addImage(dataUrl, file.type === "image/png" ? "PNG" : "JPEG", x, y, width, height);
    onProgress?.(index + 1, files.length);
  }

  return pdf.output("blob");
}

async function uploadResearchPdf(files, { onProgress } = {}) {
  const pdfBlob = await createResearchPdf(files, { onProgress });
  const path = `ocr-scans/${Date.now()}_research.pdf`;
  const { error } = await supabase.storage.from("research-files").upload(path, pdfBlob, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (error) throw error;

  const { data: pub } = supabase.storage.from("research-files").getPublicUrl(path);
  return pub.publicUrl;
}

async function uploadResearchFile(file, userId) {
  const path = `${userId}/${Date.now()}_${file.name}`;
  const { error } = await supabase.storage.from("research-files").upload(path, file);
  if (error) throw error;
  const { data: pub } = supabase.storage.from("research-files").getPublicUrl(path);
  return pub.publicUrl;
}

/**
 * OCR Digitization Module: heuristic metadata extraction.
 *
 * Hardbound CSD research documents follow a fairly predictable title-page
 * layout, so this pulls out title, authors, adviser, panel members,
 * abstract, and keywords from the raw OCR text using pattern matching.
 * It's a starting point, not a guarantee — the admin reviews and corrects
 * the fields before archiving (see OCRScan.jsx).
 */
export function extractMetadata(rawText) {
  const lines = rawText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const findAfterLabel = (labels) => {
    for (const line of lines) {
      for (const label of labels) {
        const re = new RegExp(`^${label}\\s*[:\\-]\\s*(.+)`, "i");
        const match = line.match(re);
        if (match) return match[1].trim();
      }
    }
    return "";
  };

  // Title: usually the longest all-caps-ish line near the top of the page
  const titleCandidate =
    lines.slice(0, 12).find((l) => l.length > 15 && l === l.toUpperCase() && /[A-Z]/.test(l)) ||
    lines.find((l) => l.length > 15) ||
    "";

  const abstractMatch = rawText.match(/abstract\s*[:\-]?\s*([\s\S]{0,900}?)(?:\n\s*\n|keywords?\s*[:\-]|chapter|introduction)/i);

  return {
    title: toTitleCase(titleCandidate),
    authors: findAfterLabel(["by", "author(s)?", "researchers?", "proponents?"]),
    adviser: findAfterLabel(["adviser", "advisor", "research adviser"]),
    panelMembers: findAfterLabel(["panel members?", "panelists?", "committee"]),
    abstract: abstractMatch ? abstractMatch[1].replace(/\s+/g, " ").trim() : "",
    keywords: findAfterLabel(["keywords?"]),
  };
}

function toTitleCase(str) {
  if (!str) return "";
  // Only reformat if it looks like a shouted all-caps title
  if (str !== str.toUpperCase()) return str;
  return str
    .toLowerCase()
    .split(" ")
    .map((w) => (w.length > 3 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}


/**
 * Admin uploads a scanned page, runs OCR, then creates a research_papers
 * record of source='ocr_scanned' with the extracted text stored for
 * full-text search.
 */
export async function digitizeAndArchive({
  imageFile,
  imageFiles,
  ocrText,
  title,
  authors,
  academicYear,
  adviser,
  abstract,
  keywords,
  adminId,
  digitalFile,
  submitterId,
  onProgress,
}) {
  const filesToUpload = imageFiles?.length ? imageFiles : imageFile ? [imageFile] : [];

  const actorId = submitterId || adminId;
  const uploadedUrl = digitalFile
    ? await uploadResearchFile(digitalFile, actorId)
    : await uploadResearchPdf(filesToUpload, { onProgress });

  const { data, error } = await supabase
    .from("research_papers")
    .insert({
      title,
      authors,
      academic_year: academicYear,
      adviser,
      abstract,
      keywords,
      submitted_by: actorId,
      status: digitalFile ? "pending" : "approved", // digital files follow review; OCR archives are approved past theses
      source: "ocr_scanned",
      ocr_raw_text: ocrText,
      file_url: uploadedUrl,
    })
    .select()
    .single();

  if (error) throw error;

  await supabase.from("submission_logs").insert({
    paper_id: data.id,
    action: "ocr_scanned",
    actor_id: actorId,
    detail: digitalFile ? { submission_type: "digital_file" } : null,
  });

  return data;
}
