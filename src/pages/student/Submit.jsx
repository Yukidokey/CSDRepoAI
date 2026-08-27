import { useEffect, useState } from "react";
import {
  AlertTriangle,
  UploadCloud,
  CheckCircle2,
  FileText,
  Tag as TagIcon,
  Paperclip,
  ShieldCheck,
} from "lucide-react";
import Layout from "../../components/Layout";
import { PageHeader, Field } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { submitResearch } from "../../services/research";
import { searchResearch } from "../../services/search";
import { suggestMetadata } from "../../services/metadataSuggestions";
import { SDG_LIST } from "../../lib/sdgList";

export default function Submit() {
  const { user, profile } = useAuth();
  const [form, setForm] = useState({
    title: "",
    abstract: "",
    authors: profile?.full_name || "",
    adviser: "",
    academicYear: "",
    semester: "1st Semester",
    program: profile?.program || "",
    keywords: "",
  });
  const [sdgTags, setSdgTags] = useState([]);
  const [files, setFiles] = useState({ manuscript: null, sourceCode: null, ieee: null });
  const [status, setStatus] = useState("idle"); // idle | submitting | done | error
  const [errorMsg, setErrorMsg] = useState("");
  const [related, setRelated] = useState([]);
  const [suggestions, setSuggestions] = useState(null);

  // Generate academic year options dynamically (e.g., 2022-2023, 2023-2024, etc.)
  // Returns 5 years back through 2 years forward from current year
  function generateAcademicYears() {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = -5; i <= 2; i++) {
      const year = currentYear + i;
      years.push(`${year}-${year + 1}`);
    }
    return years;
  }

  // AI-Assisted Search Module: proactively surface similar existing studies
  // as the student types a title, so they can avoid duplicating a topic
  // that's already in the department archive.
  useEffect(() => {
    if (form.title.trim().length < 8) {
      setRelated([]);
      return;
    }
    const timeout = setTimeout(() => {
      searchResearch(form.title).then((results) => setRelated(results.slice(0, 3)));
    }, 500);
    return () => clearTimeout(timeout);
  }, [form.title]);

  useEffect(() => {
    if (form.title.trim().length < 8 && form.abstract.trim().length < 30) {
      setSuggestions(null);
      return;
    }
    setSuggestions(suggestMetadata(form));
  }, [form.title, form.abstract, form.keywords]);

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  // Keywords is a comma-separated field — auto-insert a space right after a
  // typed comma so the list reads "AI, machine learning" without the user
  // having to type the space themselves. Only kicks in while typing forward
  // (inputType !== delete*), so backspacing to edit/remove text still works
  // normally instead of the space fighting the user's deletion.
  function handleKeywordsChange(e) {
    const { value } = e.target;
    const inputType = e.nativeEvent?.inputType || "";
    if (!inputType.startsWith("delete") && value.endsWith(",")) {
      setForm((f) => ({ ...f, keywords: value + " " }));
      return;
    }
    setForm((f) => ({ ...f, keywords: value }));
  }

  function toggleSdg(id) {
    setSdgTags((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function applySuggestions() {
    if (!suggestions) return;
    setForm((current) => ({
      ...current,
      keywords: current.keywords || suggestions.keywords.join(", "),
    }));
    setSdgTags((current) => [...new Set([...current, ...suggestions.sdgTags])]);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMsg("");
    try {
      await submitResearch({
        title: form.title,
        abstract: form.abstract,
        authors: form.authors.split(",").map((a) => a.trim()).filter(Boolean),
        adviser: form.adviser,
        academicYear: form.academicYear,
        semester: form.semester,
        program: form.program,
        keywords: form.keywords.split(",").map((k) => k.trim()).filter(Boolean),
        sdgTags,
        manuscriptFile: files.manuscript,
        sourceCodeFile: files.sourceCode,
        ieeeFile: files.ieee,
        userId: user.id,
      });
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err.message);
    }
  }

  if (status === "done") {
    return (
      <Layout>
        <div style={{ maxWidth: 1040, margin: "0 auto" }}>
          <div
            className="card card-pad"
            style={{
              background: "var(--success-100)",
              border: "1px solid #cbe6d1",
              display: "flex",
              gap: 14,
              alignItems: "flex-start",
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: "var(--success-600)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <CheckCircle2 size={20} color="#fff" />
            </div>
            <div>
              <h2 style={{ color: "var(--success-700)", fontSize: 17 }}>Submission received</h2>
              <p style={{ color: "var(--success-700)", marginTop: 6, fontSize: 13.5 }}>
                Your research has been submitted and is now pending review. You'll see the status
                update on your dashboard.
              </p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // Lightweight progress signal for the sidebar checklist — purely visual,
  // doesn't gate submission (required fields already handle validation).
  const stepsDone = {
    details: form.title.trim().length > 0 && form.abstract.trim().length > 0,
    classification: sdgTags.length > 0 && form.keywords.trim().length > 0,
    files: Boolean(files.manuscript),
  };

  return (
    <Layout>
      <PageHeader
        eyebrow="Research Submission"
        title="Submit Research"
        description="Fill in your research details, tag applicable SDGs, and upload your files for review."
      />

      <div className="submit-layout">
        <form onSubmit={handleSubmit} className="card submit-form">
          <div className="form-section">
            <div className="form-section-head">
              <div className="form-section-icon">
                <FileText size={15} />
              </div>
              <div>
                <div className="form-section-title">Research details</div>
                <div className="form-section-hint">Title, authorship, and academic context</div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Field label="Research title">
                <input className="input" value={form.title} onChange={update("title")} required />
              </Field>
              <Field label="Abstract">
                <textarea className="input" value={form.abstract} onChange={update("abstract")} required rows={4} />
              </Field>
              <Field label="Authors (comma-separated)">
                <input className="input" value={form.authors} onChange={update("authors")} required />
              </Field>
              <Field label="Adviser">
                <input className="input" value={form.adviser} onChange={update("adviser")} />
              </Field>

              <div className="form-grid-2">
                <Field label="Academic year">
                  <select className="input" value={form.academicYear} onChange={update("academicYear")} required>
                    <option value="">Select academic year</option>
                    {generateAcademicYears().map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Semester">
                  <select className="input" value={form.semester} onChange={update("semester")}>
                    <option>1st Semester</option>
                    <option>2nd Semester</option>
                    <option>Summer</option>
                  </select>
                </Field>
              </div>

              <Field label="Program">
                <select className="input" value={form.program} onChange={update("program")} required>
                  <option value="">Select program</option>
                  <option value="BSIT">Bachelor of Science in Information Technology (BSIT)</option>
                  <option value="BSCS">Bachelor of Science in Computer Science (BSCS)</option>
                  <option value="BSIS">Bachelor of Science in Information Systems (BSIS)</option>
                  <option value="BSCpE">Bachelor of Science in Computer Engineering (BSCpE)</option>
                  <option value="Associate/Diploma in Computer Technology">Associate/Diploma in Computer Technology</option>
                </select>
              </Field>
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-head">
              <div className="form-section-icon">
                <TagIcon size={15} />
              </div>
              <div>
                <div className="form-section-title">Classification</div>
                <div className="form-section-hint">Keywords and applicable SDGs</div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {suggestions && (suggestions.keywords.length > 0 || suggestions.sdgTags.length > 0) && (
                <div className="metadata-suggestion">
                  <div>
                    <strong>Suggested classification</strong>
                    <span>{suggestions.category}</span>
                  </div>
                  <p>
                    {suggestions.keywords.length > 0 ? `Keywords: ${suggestions.keywords.join(", ")}` : "Review the suggested SDG tags below."}
                  </p>
                  {suggestions.sdgNames.length > 0 && <p>SDGs: {suggestions.sdgNames.join(", ")}</p>}
                  <button type="button" className="btn btn-outline btn-sm" onClick={applySuggestions}>Apply suggestions</button>
                </div>
              )}
              <Field label="Keywords (comma-separated)">
                <input className="input" value={form.keywords} onChange={handleKeywordsChange} />
              </Field>

              <Field label="SDG classification">
                <div className="sdg-grid">
                  {SDG_LIST.map((sdg) => (
                    <button
                      type="button"
                      key={sdg.id}
                      onClick={() => toggleSdg(sdg.id)}
                      className={`sdg-chip${sdgTags.includes(sdg.id) ? " selected" : ""}`}
                    >
                      <span className="sdg-chip-num">{sdg.id}</span>
                      {sdg.title}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-head">
              <div className="form-section-icon">
                <Paperclip size={15} />
              </div>
              <div>
                <div className="form-section-title">Files &amp; attachments</div>
                <div className="form-section-hint">Manuscript is required; the rest are optional</div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Field label="Manuscript (PDF)">
                <Dropzone
                  accept=".pdf"
                  file={files.manuscript}
                  required
                  onChange={(file) => setFiles((f) => ({ ...f, manuscript: file }))}
                  hint="Full research paper, PDF only"
                />
              </Field>
              <Field label="Source code (zip)">
                <Dropzone
                  accept=".zip"
                  file={files.sourceCode}
                  onChange={(file) => setFiles((f) => ({ ...f, sourceCode: file }))}
                  hint="Optional — zipped project files"
                />
              </Field>
              <Field label="IEEE short paper (PDF)">
                <Dropzone
                  accept=".pdf"
                  file={files.ieee}
                  onChange={(file) => setFiles((f) => ({ ...f, ieee: file }))}
                  hint="Optional — conference-format short paper"
                />
              </Field>
            </div>
          </div>

          <div className="form-section-foot">
            <div style={{ fontSize: 12, color: "var(--ink-500)" }}>
              {errorMsg ? (
                <span className="auth-error" style={{ margin: 0 }}>{errorMsg}</span>
              ) : (
                "Your adviser and the review committee will be notified once submitted."
              )}
            </div>
            <button type="submit" disabled={status === "submitting"} className="btn btn-primary">
              {status === "submitting" ? "Submitting..." : "Submit Research"}
            </button>
          </div>
        </form>

        <div style={{ display: "flex", flexDirection: "column", gap: 16, position: "sticky", top: 24 }}>
          {related.length > 0 && (
            <div className="card card-pad" style={{ borderColor: "var(--warning-100)", background: "var(--warning-100)" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <AlertTriangle size={16} color="var(--warning-700)" style={{ marginTop: 2, flexShrink: 0 }} />
                <div>
                  <h3 style={{ fontSize: 13.5, color: "var(--warning-700)" }}>Similar studies already exist</h3>
                  <p style={{ fontSize: 12, color: "var(--warning-700)", marginTop: 4 }}>
                    Review these before continuing, to avoid duplicating a topic already covered in the department archive.
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                {related.map((r) => (
                  <div key={r.id} style={{ background: "var(--surface)", borderRadius: 8, padding: 10 }}>
                    <p style={{ fontSize: 12.5, fontWeight: 600 }}>{r.title}</p>
                    <p style={{ fontSize: 11.5, color: "var(--ink-500)", marginTop: 2 }}>
                      {(r.authors || []).join(", ")} · {r.academic_year || "—"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card submit-aside-panel">
            <div className="submit-aside-title">Submission checklist</div>
            <div className="submit-aside-sub">Track your progress as you fill out the form.</div>
            <div className="checklist">
              <div className={`checklist-item${stepsDone.details ? " done" : ""}`}>
                <span className="checklist-dot">{stepsDone.details && <CheckCircle2 size={12} />}</span>
                <span>Title and abstract added</span>
              </div>
              <div className={`checklist-item${stepsDone.classification ? " done" : ""}`}>
                <span className="checklist-dot">{stepsDone.classification && <CheckCircle2 size={12} />}</span>
                <span>Keywords and SDGs tagged</span>
              </div>
              <div className={`checklist-item${stepsDone.files ? " done" : ""}`}>
                <span className="checklist-dot">{stepsDone.files && <CheckCircle2 size={12} />}</span>
                <span>Manuscript uploaded</span>
              </div>
            </div>
          </div>

          <div className="card submit-aside-panel">
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <ShieldCheck size={16} color="var(--brass-600)" style={{ marginTop: 1, flexShrink: 0 }} />
              <div>
                <div className="submit-aside-title" style={{ marginBottom: 6 }}>Before you submit</div>
                <p style={{ fontSize: 12, color: "var(--ink-500)", lineHeight: 1.6 }}>
                  Double-check author names and your adviser's spelling — these appear as-is on the
                  approved record. Submissions are reviewed within 3–5 business days.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

function Dropzone({ accept, file, onChange, hint, required }) {
  return (
    <div className={`dropzone${file ? " has-file" : ""}`}>
      <div className="dropzone-icon">
        {file ? <CheckCircle2 size={17} /> : <UploadCloud size={17} />}
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="dropzone-text">
          {file ? file.name : `Click to upload or drag a file here`}
        </div>
        <div className="dropzone-sub">
          {file ? "Click to replace this file" : hint}
        </div>
      </div>
      <input
        type="file"
        accept={accept}
        required={required && !file}
        onChange={(e) => onChange(e.target.files[0] || null)}
      />
    </div>
  );
}
