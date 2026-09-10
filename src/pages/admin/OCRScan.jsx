import { useState, useRef } from "react";
import {
  Sparkles,
  Camera,
  UploadCloud,
  ScanLine,
  X,
  Check,
  FileText,
  BookOpenCheck,
  PenLine,
  Users,
  GraduationCap,
  Quote,
  Tags,
  CalendarDays,
  ArrowRight,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import Layout from "../../components/Layout";
import { PageHeader, Field } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { digitizeAndArchive, scanDocuments, extractMetadata } from "../../services/ocr";

const STEPS = [
  { key: "upload", label: "Upload" },
  { key: "scan", label: "Scan" },
  { key: "review", label: "Review" },
  { key: "done", label: "Archived" },
];

function stepIndexFor(step) {
  if (step === "idle") return 0;
  if (step === "scanning") return 1;
  if (step === "scanned" || step === "saving") return 2;
  if (step === "done") return 3;
  return 0;
}

export default function OCRScan() {
  const { user } = useAuth();
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [ocrText, setOcrText] = useState("");
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState("idle"); // idle | scanning | scanned | saving | done
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [donePages, setDonePages] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [meta, setMeta] = useState({ title: "", authors: "", academicYear: "", adviser: "", abstract: "", keywords: "" });
  const [saveProgress, setSaveProgress] = useState({ completed: 0, total: 0 });
  const [previewIndex, setPreviewIndex] = useState(null);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const fileInputRef = useRef(null);

  const activeIndex = stepIndexFor(step);

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function handleAuthorsChange(e) {
    const { value } = e.target;
    const inputType = e.nativeEvent?.inputType || "";
    if (!inputType.startsWith("delete") && value.endsWith(",")) {
      setMeta((m) => ({ ...m, authors: value + " " }));
      return;
    }
    setMeta((m) => ({ ...m, authors: value }));
  }

  function generateAcademicYears() {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = -5; i <= 2; i += 1) {
      const year = currentYear + i;
      years.push(`${year}-${year + 1}`);
    }
    return years;
  }

function loadFiles(list) {
  const selected = Array.from(list || []);
  if (!selected.length) return;
  const imageFiles = selected.filter((file) => file.type.startsWith("image/"));
  if (!imageFiles.length) return;
  setFiles((prev) => [...prev, ...imageFiles]);
  setPreviews((prev) => [...prev, ...imageFiles.map((file) => URL.createObjectURL(file))]);
  setOcrText("");
  setStep("idle");
  setDonePages(0);
  setCurrentPage(1);
}

function handleFile(e) {
  loadFiles(e.target.files);
  e.target.value = "";
}

  function handleDrop(e) {
    e.preventDefault();
    setIsDragging(false);
    loadFiles(e.dataTransfer.files);
  }

  function removeFile(index) {
    const nextFiles = files.filter((_, i) => i !== index);
    const nextPreviews = previews.filter((_, i) => i !== index);
    setFiles(nextFiles);
    setPreviews(nextPreviews);
    if (nextFiles.length === 0) {
      setStep("idle");
      setOcrText("");
      setMeta({ title: "", authors: "", academicYear: "", adviser: "", abstract: "", keywords: "" });
    }
    setPreviewIndex(null);
    setPreviewZoom(1);
  }

  function openPreview(index) {
    setPreviewIndex(index);
    setPreviewZoom(1);
  }

  function reorderPages(fromIndex, toIndex) {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;

    setFiles((prev) => {
      const next = [...prev];
      const [item] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, item);
      return next;
    });

    setPreviews((prev) => {
      const next = [...prev];
      const [item] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, item);
      return next;
    });

    setPreviewIndex((current) => {
      if (current === null) return null;
      if (current === fromIndex) return toIndex;
      if (current > fromIndex && current <= toIndex) return current - 1;
      if (current < fromIndex && current >= toIndex) return current + 1;
      return current;
    });
  }

  async function handleScan() {
    if (!files.length) return;
    setStep("scanning");
    setProgress(0);
    setDonePages(0);
    setTotalPages(files.length);
    setCurrentPage(1);

    const { text, pages } = await scanDocuments(files, (pageProgress, page, total) => {
      setCurrentPage(page);
      setTotalPages(total);
      setProgress(pageProgress);
      if (pageProgress >= 1) setDonePages(page);
    });

    setOcrText(text);

    const extracted = extractMetadata(text);
    setMeta({
      title: extracted.title,
      authors: extracted.authors,
      academicYear: "",
      adviser: extracted.adviser,
      abstract: extracted.abstract,
      keywords: extracted.keywords,
    });

    setStep("scanned");
  }

  async function handleArchive(e) {
    e.preventDefault();
    setStep("saving");
    setSaveProgress({ completed: 0, total: files.length });
    await digitizeAndArchive({
      imageFiles: files,
      ocrText,
      title: meta.title,
      authors: meta.authors.split(",").map((a) => a.trim()).filter(Boolean),
      academicYear: meta.academicYear,
      adviser: meta.adviser,
      abstract: meta.abstract,
      keywords: meta.keywords.split(",").map((k) => k.trim()).filter(Boolean),
      adminId: user.id,
      onProgress: (completed, total) => setSaveProgress({ completed, total }),
    });
    setStep("done");
  }

  function resetAll() {
    setFiles([]);
    setPreviews([]);
    setOcrText("");
    setProgress(0);
    setStep("idle");
    setCurrentPage(1);
    setTotalPages(0);
    setDonePages(0);
    setMeta({ title: "", authors: "", academicYear: "", adviser: "", abstract: "", keywords: "" });
    setSaveProgress({ completed: 0, total: 0 });
  }

  const stagePreview = previews[currentPage - 1] || previews[0];

  return (
    <Layout>
      <PageHeader
        eyebrow="OCR Digitization"
        title="Digitize a Research Document"
        description="Upload scanned image pages from a hardbound paper. The app extracts the text and suggests metadata for review before saving."
      />

      {/* ---------- stepper ---------- */}
      <div className="ocr-stepper">
        {STEPS.map((s, i) => (
          <div key={s.key} style={{ display: "flex", alignItems: "center" }}>
            <div className={`ocr-step ${i === activeIndex ? "is-active" : ""} ${i < activeIndex ? "is-done" : ""}`}>
              <div className="ocr-step-dot">{i < activeIndex ? <Check size={12} /> : i + 1}</div>
              <span className="ocr-step-label">{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="ocr-step-connector" style={{ "--fill": i < activeIndex ? 1 : 0 }} />
            )}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFile}
          style={{ display: "none" }}
        />

        {/* ---------- left: upload / scan stage ---------- */}
        <div className="card card-pad" style={{ flex: "1 1 360px" }}>
          {step !== "scanning" && previews.length === 0 && (
            <>
              <div
                className={`ocr-dropzone ${isDragging ? "is-dragging" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={openFilePicker}
              >
                <div className="ocr-dropzone-icon">
                  <UploadCloud size={20} />
                </div>
                <div className="ocr-dropzone-title">Drop scanned research pages here</div>
                <div className="ocr-dropzone-hint">
                  <Camera size={11} style={{ verticalAlign: -1, marginRight: 3 }} />
                  JPG, PNG, or other image files · choose pages from your computer
                </div>
              </div>
              <button
                type="button"
                className="btn btn-outline btn-block"
                onClick={openFilePicker}
                style={{ marginTop: 12 }}
              >
                <UploadCloud size={14} /> Select files
              </button>
            </>
          )}

          {previews.length > 0 && step !== "scanning" && (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h3 style={{ fontSize: 13.5 }}>
                  {previews.length} page{previews.length > 1 ? "s" : ""} selected
                </h3>
                <span style={{ fontSize: 11.5, color: "var(--ink-500)" }}>
                  Drag thumbnails to reorder pages. The first visible page is Page 1.
                </span>
               {(step === "idle" || step === "scanned") && (
              <button className="btn btn-ghost btn-sm" onClick={openFilePicker}>
                <UploadCloud size={13} /> Add more
              </button>
              )}
              </div>

              <div className="ocr-thumb-strip">
                {previews.map((src, index) => (
                  <div
                    key={`${src}-${index}`}
                    className={`ocr-thumb ${draggedIndex === index ? "is-dragging" : ""}`}
                    draggable={step === "idle" || step === "scanned"}
                    onDragStart={() => setDraggedIndex(index)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (draggedIndex !== null) {
                        reorderPages(draggedIndex, index);
                        setDraggedIndex(null);
                      }
                    }}
                    onDragEnd={() => setDraggedIndex(null)}
                  >
                    <button type="button" className="ocr-thumb-preview" onClick={() => openPreview(index)} aria-label={`Preview page ${index + 1}`} title="Zoom to review this image">
                      <img src={src} alt={`page ${index + 1}`} />
                    </button>
                    <span className="ocr-thumb-page">Pg {index + 1}</span>
                    {(step === "idle" || step === "scanned") && (
              <button className="ocr-thumb-remove" onClick={() => removeFile(index)} aria-label="Remove page">
                <X size={11} />
              </button>
                  )}
                  </div>
                ))}
              </div>
            </>
          )}

          {files.length > 0 && step === "idle" && (
            <button onClick={handleScan} className="btn btn-brass btn-block" style={{ marginTop: 16 }}>
              <ScanLine size={14} /> Run OCR Scan
            </button>
          )}

          {/* ---------- animated scanning stage ---------- */}
          {step === "scanning" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <h3 style={{ fontSize: 13.5 }}>Scanning in progress</h3>
                <div className="ocr-thumb-strip" style={{ display: "none" }} />
              </div>

              <div className="ocr-scan-stage">
                {stagePreview && <img src={stagePreview} alt={`scanning page ${currentPage}`} />}
                <div className="ocr-scan-grid" />
                <div className="ocr-scan-laser" />
                <div className="ocr-scan-line" />
                <div className="ocr-scan-vignette" />
                <span className="ocr-scan-corner ocr-corner-tl" />
                <span className="ocr-scan-corner ocr-corner-tr" />
                <span className="ocr-scan-corner ocr-corner-bl" />
                <span className="ocr-scan-corner ocr-corner-br" />
                <div className="ocr-scan-badge">
                  <span className="ocr-scan-dot" />
                  Reading text
                </div>
                <span className="ocr-scan-pagelabel">Page {currentPage} of {totalPages}</span>
                <span className="ocr-scan-percent">{Math.round(progress * 100)}%</span>
              </div>

              <div className="ocr-progress-track">
                <div className="ocr-progress-fill" style={{ width: `${Math.round(((currentPage - 1 + progress) / Math.max(totalPages, 1)) * 100)}%` }} />
              </div>
              <p style={{ fontSize: 11.5, color: "var(--ink-500)", marginTop: 7 }}>
                Overall progress · {donePages} of {totalPages} pages recognized
              </p>

              {previews.length > 1 && (
                <div className="ocr-thumb-strip">
                  {previews.map((src, index) => {
                    const pageNum = index + 1;
                    const isDone = pageNum < currentPage || (pageNum === currentPage && progress >= 1);
                    const isCurrent = pageNum === currentPage && !isDone;
                    return (
                      <div key={`${src}-${index}`} className={`ocr-thumb ${isCurrent ? "is-current" : ""} ${isDone ? "is-done" : ""}`}>
                        <button type="button" className="ocr-thumb-preview" onClick={() => openPreview(index)} aria-label={`Preview page ${pageNum}`} title="Zoom to review this image">
                          <img src={src} alt={`page ${pageNum}`} />
                        </button>
                        {isDone && <span className="ocr-thumb-check"><Check size={10} /></span>}
                        <span className="ocr-thumb-page">Pg {pageNum}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ---------- right: extracted text ---------- */}
        <div className="card card-pad" style={{ flex: "1 1 360px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <FileText size={14} color="var(--ink-500)" />
            <h3 style={{ fontSize: 13.5 }}>Extracted Raw Text</h3>
          </div>
          {ocrText ? (
            <textarea
              value={ocrText}
              onChange={(e) => setOcrText(e.target.value)}
              rows={12}
              placeholder="Extracted text will appear here after scanning."
              className="input ocr-text-panel"
            />
          ) : (
            <div className="ocr-text-empty">
              <div className="ocr-text-empty-icon">
                <BookOpenCheck size={18} />
              </div>
              <div style={{ fontSize: 12.5 }}>
                {step === "scanning"
                  ? "Recognized text will stream in here as each page finishes."
                  : "Run the OCR scan to see recognized text here, editable before archiving."}
              </div>
            </div>
          )}
        </div>
      </div>

      {previewIndex !== null && previews[previewIndex] && (
        <div className="ocr-preview-modal" role="dialog" aria-modal="true" aria-label={`Preview page ${previewIndex + 1}`}>
          <div className="ocr-preview-toolbar">
            <span>Page {previewIndex + 1} of {previews.length}</span>
            <div style={{ display: "flex", gap: 6 }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPreviewZoom((value) => Math.max(0.5, value - 0.25))} aria-label="Zoom out">
                <ZoomOut size={14} />
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPreviewZoom(1)}>Reset</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPreviewZoom((value) => Math.min(3, value + 0.25))} aria-label="Zoom in">
                <ZoomIn size={14} />
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPreviewIndex(null)} aria-label="Close preview">
                <X size={15} />
              </button>
            </div>
          </div>
          <div className="ocr-preview-canvas" onClick={(event) => { if (event.target === event.currentTarget) setPreviewIndex(null); }}>
            <img src={previews[previewIndex]} alt={`Expanded page ${previewIndex + 1}`} style={{ transform: `scale(${previewZoom})` }} />
          </div>
        </div>
      )}

      {/* ---------- metadata review ---------- */}
      {(step === "scanned" || step === "saving") && (
        <form onSubmit={handleArchive} className="card card-pad" style={{ marginTop: 20, maxWidth: 680, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Sparkles size={14} color="var(--brass-600)" />
            <h3 style={{ fontSize: 13.5 }}>Auto-Suggested Metadata</h3>
            <span className="ocr-ai-tag"><Sparkles size={9} /> AI extracted</span>
          </div>
          <p style={{ fontSize: 11.5, color: "var(--ink-500)", marginTop: -8 }}>
            Fields below were parsed from the title page. Please review and correct before archiving.
          </p>

          <Field label={<span><PenLine size={11} style={{ verticalAlign: -1, marginRight: 4 }} />Title</span>}>
            <input className="input" value={meta.title} onChange={(e) => setMeta((m) => ({ ...m, title: e.target.value }))} required />
          </Field>

          <div className="ocr-field-grid">
            <Field label={<span><Users size={11} style={{ verticalAlign: -1, marginRight: 4 }} />Authors (comma-separated)</span>}>
              <input className="input" value={meta.authors} onChange={handleAuthorsChange} required />
            </Field>
            <Field label={<span><GraduationCap size={11} style={{ verticalAlign: -1, marginRight: 4 }} />Adviser</span>}>
              <input className="input" value={meta.adviser} onChange={(e) => setMeta((m) => ({ ...m, adviser: e.target.value }))} />
            </Field>
          </div>

          <Field label={<span><Quote size={11} style={{ verticalAlign: -1, marginRight: 4 }} />Abstract</span>}>
            <textarea className="input" rows={3} value={meta.abstract} onChange={(e) => setMeta((m) => ({ ...m, abstract: e.target.value }))} />
          </Field>

          <div className="ocr-field-grid">
            <Field label={<span><Tags size={11} style={{ verticalAlign: -1, marginRight: 4 }} />Keywords (comma-separated)</span>}>
              <input className="input" value={meta.keywords} onChange={(e) => setMeta((m) => ({ ...m, keywords: e.target.value }))} />
            </Field>
            <Field label={<span><CalendarDays size={11} style={{ verticalAlign: -1, marginRight: 4 }} />Academic year</span>}>
              <select className="input" value={meta.academicYear} onChange={(e) => setMeta((m) => ({ ...m, academicYear: e.target.value }))} required>
                <option value="">Select academic year</option>
                {generateAcademicYears().map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </Field>
          </div>

          <button type="submit" disabled={step === "saving"} className="btn btn-primary" style={{ marginTop: 4 }}>
            {step === "saving"
              ? saveProgress.total
                ? `Uploading page ${saveProgress.completed} of ${saveProgress.total}...`
                : "Saving..."
              : <>Save to Repository <ArrowRight size={14} /></>}
          </button>
          {step === "saving" && saveProgress.total > 0 && (
            <div className="ocr-progress-track" style={{ marginTop: -4 }}>
              <div
                className="ocr-progress-fill"
                style={{ width: `${Math.round((saveProgress.completed / saveProgress.total) * 100)}%` }}
              />
            </div>
          )}
        </form>
      )}

      {/* ---------- success ---------- */}
      {step === "done" && (
        <div className="card card-pad" style={{ marginTop: 20, maxWidth: 680, display: "flex", alignItems: "center", gap: 14 }}>
          <div className="ocr-success-icon">
            <Check size={24} />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: 14.5, marginBottom: 3 }}>Document digitized and archived</h3>
            <p style={{ fontSize: 12.5, color: "var(--ink-500)" }}>
              "{meta.title || "Untitled document"}" is now searchable in the repository.
            </p>
          </div>
          <button className="btn btn-outline btn-sm" onClick={resetAll}>
            <RotateCcw size={13} /> Scan another
          </button>
        </div>
      )}
    </Layout>
  );
}
