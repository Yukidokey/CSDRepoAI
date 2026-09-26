import { jsPDF } from "jspdf";
import mammoth from "mammoth/mammoth.browser.js";
import { supabase } from "../lib/supabaseClient.js";
import { extractDocumentFields, extractMetadataWithAI } from "./metadataSuggestions.js";
import { stripPageMarkers } from "./ocrTextUtils.js";

/**
 * OCR Digitization Module
 *
 * Runs PaddleOCR in a browser worker (no OCR server needed) to scan
 * images of hardbound research documents and extract text. `onProgress`
 * receives a 0-1 value you can wire into a progress bar.
 */
let paddleOcrPromise;
let pdfJsPromise;

function getPaddleOcr() {
  if (!paddleOcrPromise) {
    paddleOcrPromise = import("@paddleocr/paddleocr-js")
      .then(({ PaddleOCR }) => PaddleOCR.create({
        lang: "en",
        ocrVersion: "PP-OCRv5",
        worker: true,
        ortOptions: {
          backend: "wasm",
          numThreads: 1,
          simd: true,
        },
      }))
      .catch((error) => {
        paddleOcrPromise = null;
        throw new Error(`PaddleOCR could not start: ${error.message || "model initialization failed"}`);
      });
  }
  return paddleOcrPromise;
}

function getRecognizedText(result) {
  const lines = (result?.items || [])
    .map((item) => String(item.text || "").trim())
    .filter(Boolean);
  return cleanOcrText(lines.join("\n"));
}

export async function scanDocument(imageFileOrUrl, onProgress) {
  const ocr = await getPaddleOcr();
  onProgress?.(0.05);
  const preparedImage = await prepareOcrImage(imageFileOrUrl);
  const [result] = await ocr.predict(preparedImage);
  onProgress?.(1);
  const scores = (result?.items || []).map((item) => item.score).filter(Number.isFinite);
  const confidence = scores.length
    ? (scores.reduce((sum, score) => sum + score, 0) / scores.length) * 100
    : 0;
  return { text: getRecognizedText(result), confidence };
}

export async function expandUploadedFiles(files) {
  return normalizeFilesForArchive(files);
}

async function normalizeFilesForArchive(files) {
  const expanded = [];

  for (const file of files || []) {
    if (file?.type?.startsWith("image/")) {
      expanded.push(file);
      continue;
    }

    if (isPdfFile(file)) {
      const pdfPageFiles = await pdfFileToPageImageFiles(file);
      expanded.push(...pdfPageFiles);
      continue;
    }

    if (isDocxFile(file)) {
      expanded.push(file);
      continue;
    }

    throw new Error("Document digitization requires scanned image files, PDF, or DOCX uploads.");
  }

  return expanded;
}

export { stripPageMarkers } from "./ocrTextUtils.js";

export async function scanDocuments(imageFiles, onProgress, { signal } = {}) {
  const pages = [];
  const totalPages = imageFiles.length;
  const needsImageOcr = imageFiles.some((file) => !isDocxFile(file));
  if (needsImageOcr) onProgress?.(0.02, 1, totalPages);
  const ocr = needsImageOcr ? await getPaddleOcr() : null;

  for (let index = 0; index < imageFiles.length; index += 1) {
    if (signal?.aborted) break;
    const file = imageFiles[index];
    if (isDocxFile(file)) {
      const text = await extractDocxTextForOcr(file);
      pages.push({ pageNumber: index + 1, text });
      onProgress?.(1, index + 1, totalPages);
      continue;
    }

    onProgress?.(0.05, index + 1, totalPages);
    const preparedImage = await prepareOcrImage(file);
    if (signal?.aborted) break;
    const [result] = await ocr.predict(preparedImage);
    pages.push({
      pageNumber: index + 1,
      text: getRecognizedText(result),
    });
    onProgress?.(1, index + 1, totalPages);
  }

  const text = pages
    .map((page) => `--- Page ${page.pageNumber} ---\n${page.text}`)
    .join("\n\n");

  return { text, pages, cancelled: Boolean(signal?.aborted) };
}

function cleanOcrText(rawText) {
  const normalized = rawText
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\t+/g, " ")
    .replace(/([A-Za-z])-\s*\n\s*([A-Za-z])/g, "$1$2")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();

  return applyCommonOcrCorrections(normalized)
    .replace(/\b([A-Za-z]{3,})\s+\1\b/gi, "$1")
    .replace(/([A-Za-z])\s{2,}([A-Za-z])/g, "$1 $2")
    .replace(/\s+([.,;:!?])/g, "$1")
    .replace(/([.,;:!?])([A-Za-z])/g, "$1 $2")
    .trim();
}

function applyCommonOcrCorrections(text) {
  const replacements = [
    [/\bteh\b/gi, "the"],
    [/\bthte\b/gi, "the"],
    [/\bthier\b/gi, "their"],
    [/\brecieve\b/gi, "receive"],
    [/\bseperate\b/gi, "separate"],
    [/\boccured\b/gi, "occurred"],
    [/\bimporant\b/gi, "important"],
    [/\bstudetn\b/gi, "student"],
    [/\bstudnet\b/gi, "student"],
    [/\bdeparment\b/gi, "department"],
    [/\bdepatrment\b/gi, "department"],
    [/\breserach\b/gi, "research"],
    [/\breserch\b/gi, "research"],
    [/\bpractial\b/gi, "practical"],
    [/\bintial\b/gi, "initial"],
    [/\bdocuemnt\b/gi, "document"],
    [/\bdocment\b/gi, "document"],
    [/\baccross\b/gi, "across"],
    [/\bintroductionn\b/gi, "introduction"],
    [/\bmethodolgy\b/gi, "methodology"],
    [/\banalysys\b/gi, "analysis"],
    [/\bimplmentation\b/gi, "implementation"],
    [/\btechonology\b/gi, "technology"],
    [/\bconclsuion\b/gi, "conclusion"],
    [/\bperfromance\b/gi, "performance"],
    [/\bproccess\b/gi, "process"],
    [/\bcommitee\b/gi, "committee"],
    [/\bpalce\b/gi, "place"],
    [/\bpg\s*(\d+)\b/gi, "Page $1"],
  ];

  return replacements.reduce((result, [pattern, replacement]) => result.replace(pattern, replacement), text);
}

function isPdfFile(file) {
  return file?.type === "application/pdf" || /\.pdf$/i.test(file?.name || "");
}

function isDocxFile(file) {
  return file?.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    || /\.docx$/i.test(file?.name || "");
}

async function extractDocxTextForOcr(file) {
  const arrayBuffer = await file.arrayBuffer();
  const { value } = await mammoth.extractRawText({ arrayBuffer });
  return value
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

async function pdfFileToPageImageFiles(file, maxPages = Infinity) {
  const { getDocument } = await getPdfJs();
  const pdfData = await file.arrayBuffer();
  const pdf = await getDocument({ data: pdfData }).promise;
  const pageFiles = [];

  for (let pageNumber = 1; pageNumber <= Math.min(pdf.numPages, maxPages); pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const context = canvas.getContext("2d");
    if (!context) throw new Error("Your browser could not prepare a canvas for the PDF page.");
    await page.render({ canvasContext: context, viewport }).promise;

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) throw new Error(`Could not convert PDF page ${pageNumber} into an OCR image.`);

    const baseName = file.name.replace(/\.pdf$/i, "");
    pageFiles.push(
      new File([blob], `${baseName}-page-${pageNumber}.jpg`, {
        type: "image/jpeg",
      })
    );
    Object.assign(pageFiles[pageFiles.length - 1], {
      sourcePdf: file,
      sourcePdfPageNumber: pageNumber,
      sourcePdfPageCount: pdf.numPages,
    });
  }

  return pageFiles;
}

export async function extractScannedPdfText(file, { maxPages = 12, onProgress } = {}) {
  const pageFiles = await pdfFileToPageImageFiles(file, maxPages);
  const result = await scanDocuments(pageFiles, onProgress);
  return result.text;
}

function getPdfJs() {
  if (!pdfJsPromise) {
    pdfJsPromise = Promise.all([
      import("pdfjs-dist"),
      import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
    ]).then(([pdfjs, workerModule]) => {
      pdfjs.GlobalWorkerOptions.workerSrc = workerModule.default || workerModule;
      return pdfjs;
    }).catch((error) => {
      pdfJsPromise = null;
      throw error;
    });
  }
  return pdfJsPromise;
}

async function prepareOcrImage(file) {
  if (!file?.type?.startsWith("image/")) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const maxDimension = 3000;
    const scale = Math.min(3.5, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.filter = "grayscale(1) contrast(1.45) brightness(1.08)";
    ctx.drawImage(bitmap, 0, 0, width, height);
    ctx.filter = "none";
    bitmap.close?.();

    const preparedBlob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.95));
    return preparedBlob || file;
  } catch {
    return file;
  }
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
    onProgress?.({ phase: "preparing", completed: index + 1, total: files.length });
  }

  return pdf.output("blob");
}

async function uploadResearchPdf(files, { onProgress } = {}) {
  const pdfBlob = await createResearchPdf(files, { onProgress });
  const path = `ocr-scans/${Date.now()}_research.pdf`;
  onProgress?.({ phase: "uploading", completed: files.length, total: files.length, bytes: pdfBlob.size });
  const { error } = await supabase.storage.from("research-files").upload(path, pdfBlob, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (error) throw error;

  const { data: pub } = supabase.storage.from("research-files").getPublicUrl(path);
  return pub.publicUrl;
}

async function uploadResearchDocument(file, { onProgress } = {}) {
  const path = `ocr-scans/${Date.now()}_${file.name.replace(/[^a-z0-9._-]/gi, "_")}`;
  onProgress?.({ phase: "uploading", completed: 0, total: 1, bytes: file.size });
  const { error } = await supabase.storage.from("research-files").upload(path, file, {
    contentType: file.type || "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    upsert: false,
  });
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
export async function extractMetadata(rawText) {
  const cleanedText = stripPageMarkers(rawText);
  const fallback = extractDocumentFields(cleanedText);
  const aiMetadata = await extractMetadataWithAI(cleanedText);
  const aiStatus = aiMetadata?.unavailable
    ? "not_configured"
    : aiMetadata?.failed
      ? "failed"
      : hasUsableAiMetadata(aiMetadata)
        ? "ok"
        : "failed";

  const fallbackAuthors = Array.isArray(fallback.authors) ? fallback.authors.filter(Boolean) : [];
  const aiAuthors = Array.isArray(aiMetadata?.authors) ? aiMetadata.authors.filter(Boolean) : [];
  const authors = (fallbackAuthors.length >= aiAuthors.length ? fallbackAuthors : aiAuthors).join(", ");

  const fallbackKeywords = String(fallback.keywords || "").trim();
  const aiKeywords = Array.isArray(aiMetadata?.keywords)
    ? aiMetadata.keywords.filter(Boolean).join(", ")
    : String(aiMetadata?.keywords || "").trim();
  const keywords = fallbackKeywords || aiKeywords;

  const fallbackTitle = isUsableMetadataTitle(fallback.title) ? fallback.title : "";
  const aiTitle = isUsableMetadataTitle(aiMetadata?.title) ? String(aiMetadata.title).trim() : "";
  const title = fallbackTitle || aiTitle;

  const fallbackAbstract = String(fallback.abstract || "").trim();
  const aiAbstract = String(aiMetadata?.abstract || "").trim();
  const abstract = fallbackAbstract.length >= 80 ? fallbackAbstract : aiAbstract || fallbackAbstract;
  const panelMembers = Array.isArray(fallback.panelMembers) ? fallback.panelMembers.join(", ") : "";

  return {
    title,
    authors,
    adviser: String(fallback.adviser || aiMetadata?.adviser || "").trim(),
    panelMembers,
    abstract,
    keywords,
    aiStatus,
  };
}

function hasUsableAiMetadata(metadata) {
  return Boolean(metadata && (
    metadata.title
    || metadata.abstract
    || metadata.adviser
    || (Array.isArray(metadata.authors) && metadata.authors.length)
    || (Array.isArray(metadata.keywords) && metadata.keywords.length)
  ));
}

function isUsableMetadataTitle(value) {
  const title = String(value || "").replace(/\s+/g, " ").trim();
  if (!title || title.length > 180 || title.split(/\s+/).length > 24) return false;
  if (/^har(?:d)?bound(?:\s+bayad)?$/i.test(title)) return false;
  if (/^(string|title|document|manuscript|research paper|untitled|unknown|n\/a|null|undefined)$/i.test(title)) return false;
  if (/^\d+\s+(?:weeks?|days?|months?)\b/i.test(title)) return false;
  if (/\b(?:data collection plan|prior to data collection|this study will|the research team will)\b/i.test(title)) return false;
  return !/[.!?]$/.test(title);
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
  panelMembers,
  abstract,
  keywords,
  adminId,
  onProgress,
}) {
  const rawFiles = imageFiles?.length ? imageFiles : imageFile ? [imageFile] : [];
  const filesToUpload = await normalizeFilesForArchive(rawFiles);

  if (!filesToUpload.length) {
    throw new Error("Document digitization requires at least one scanned image or PDF file.");
  }

  const actorId = adminId;
  const firstPage = filesToUpload[0];
  const sourcePdf = firstPage?.sourcePdf;
  const isCompleteOriginalPdf = sourcePdf
    && filesToUpload.length === firstPage.sourcePdfPageCount
    && filesToUpload.every((file, index) => file.sourcePdf === sourcePdf && file.sourcePdfPageNumber === index + 1);
  const uploadedUrl = filesToUpload.length === 1 && isDocxFile(filesToUpload[0])
    ? await uploadResearchDocument(filesToUpload[0], { onProgress })
    : isCompleteOriginalPdf
      ? await uploadResearchDocument(sourcePdf, { onProgress })
      : await uploadResearchPdf(filesToUpload, { onProgress });

  onProgress?.({ phase: "saving", completed: 0, total: 1 });

  const { data, error } = await supabase
    .from("research_papers")
    .insert({
      title,
      authors,
      academic_year: academicYear,
      adviser,
      panel_members: panelMembers,
      abstract,
      keywords,
      submitted_by: actorId,
      status: "approved",
      source: "ocr_scanned",
      ocr_raw_text: ocrText,
      file_url: uploadedUrl,
    })
    .select()
    .single();

  if (error) throw error;

  onProgress?.({ phase: "saving", completed: 1, total: 1 });
  await supabase.from("submission_logs").insert({
    paper_id: data.id,
    action: "ocr_scanned",
    actor_id: actorId,
    detail: null,
  });

  return data;
}
