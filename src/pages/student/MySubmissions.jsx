import { useEffect, useMemo, useState } from "react";
import { FileText, FolderOpen, Pencil, X } from "lucide-react";
import Layout from "../../components/Layout";
import { PageHeader, StatusBadge, EmptyState, Field, Button } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { checkResearchDuplicate } from "../../services/search";
import { getMySubmissions, updateResearchSubmission } from "../../services/research";
import { SDG_LIST } from "../../lib/sdgList";

const EMPTY_FILES = { manuscript: null, sourceCode: null, ieee: null, acm: null, apa: null };

function listToText(value) {
  return Array.isArray(value) ? value.join(", ") : "";
}

function splitList(value) {
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

export default function MySubmissions() {
  const { user, role } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editSdgTags, setEditSdgTags] = useState([]);
  const [editFiles, setEditFiles] = useState(EMPTY_FILES);
  const [editError, setEditError] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [confirmEditSave, setConfirmEditSave] = useState(false);

  useEffect(() => {
    if (!user) return;
    getMySubmissions(user.id).then(setSubmissions).finally(() => setLoading(false));
  }, [user]);

  const filtered = useMemo(
    () => (statusFilter === "all" ? submissions : submissions.filter((s) => s.status === statusFilter)),
    [submissions, statusFilter]
  );

  const statuses = ["all", "pending", "under_review", "approved", "rejected"];

  function startEditing(paper) {
    setEditing(paper);
    setEditForm({
      title: paper.title || "",
      abstract: paper.abstract || "",
      authors: listToText(paper.authors),
      adviser: paper.adviser || "",
      academicYear: paper.academic_year || "",
      semester: paper.semester || "1st Semester",
      program: paper.program || "",
      keywords: listToText(paper.keywords),
    });
    setEditSdgTags(paper.sdg_tags || []);
    setEditFiles({ ...EMPTY_FILES });
    setEditError("");
    setConfirmEditSave(false);
  }

  function validateAcademicYear(value) {
    const match = String(value || "").trim().match(/^(\d{4})-(\d{4})$/);
    if (!match) return "Use the format YYYY-YYYY, for example 2025-2026.";
    if (Number(match[2]) !== Number(match[1]) + 1) {
      return "Academic years must be consecutive and in forward order, for example 2025-2026.";
    }
    return "";
  }

  function cancelEditing() {
    setEditing(null);
    setEditForm(null);
    setEditError("");
    setConfirmEditSave(false);
  }

  function handleEditSubmit(event) {
    event.preventDefault();
    if (!editing || !editForm || !user) return;

    const yearError = validateAcademicYear(editForm.academicYear);
    if (yearError) {
      setEditError(yearError);
      return;
    }

    setEditError("");
    setConfirmEditSave(true);
  }

  async function saveEditChanges() {
    if (!editing || !editForm || !user) return;

    const yearError = validateAcademicYear(editForm.academicYear);
    if (yearError) {
      setEditError(yearError);
      setConfirmEditSave(false);
      return;
    }

    setEditSaving(true);
    setEditError("");
    try {
      const authors = splitList(editForm.authors);
      const keywords = splitList(editForm.keywords);
      await checkResearchDuplicate({
        abstract: editForm.abstract,
        keywords,
        excludePaperId: editing.id,
      });

      const updatedPaper = await updateResearchSubmission({
        paper: editing,
        title: editForm.title,
        abstract: editForm.abstract,
        authors,
        adviser: editForm.adviser,
        academicYear: editForm.academicYear,
        semester: editForm.semester,
        program: editForm.program,
        keywords,
        sdgTags: editSdgTags,
        files: editFiles,
        userId: user.id,
      });

      setSubmissions((current) => current.map((paper) => paper.id === updatedPaper.id ? updatedPaper : paper));
      setEditing(null);
      setEditForm(null);
      setEditFiles({ ...EMPTY_FILES });
      setConfirmEditSave(false);
    } catch (error) {
      setEditError(error.message || "Could not save your changes. Please try again.");
      setConfirmEditSave(false);
    } finally {
      setEditSaving(false);
    }
  }

  function updateEditField(field) {
    return (event) => setEditForm((current) => ({ ...current, [field]: event.target.value }));
  }

  function toggleEditSdg(id) {
    setEditSdgTags((current) => current.includes(id)
      ? current.filter((tag) => tag !== id)
      : [...current, id]);
  }

  return (
    <Layout>
      <PageHeader
        eyebrow="Research Submission"
        title="My Submissions"
        description={`${role === "faculty" ? "Faculty" : "Student"} research outputs submitted from your account and their current review status.`}
      />

      {submissions.length > 0 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`tag${statusFilter === s ? " selected" : ""}`}
              style={{ textTransform: "capitalize" }}
            >
              {s === "all" ? "All" : s.replace("_", " ")}
            </button>
          ))}
        </div>
      )}

      {editing && editForm && (
        <form className="card card-pad" onSubmit={handleEditSubmit} style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 18 }}>
            <div>
              <h2 style={{ fontSize: 17 }}>Edit submission</h2>
              <p style={{ color: "var(--ink-500)", fontSize: 12.5, marginTop: 4 }}>Changes are available until the paper is approved.</p>
            </div>
            <button type="button" className="portal-icon-button" aria-label="Cancel editing" title="Cancel editing" onClick={cancelEditing}>
              <X size={17} />
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field label="Research title">
              <input className="input" value={editForm.title} onChange={updateEditField("title")} required />
            </Field>
            <Field label="Abstract">
              <textarea className="input" rows={4} value={editForm.abstract} onChange={updateEditField("abstract")} required />
            </Field>
            <Field label="Authors (comma-separated)">
              <input className="input" value={editForm.authors} onChange={updateEditField("authors")} required />
            </Field>
            <Field label="Adviser">
              <input className="input" value={editForm.adviser} onChange={updateEditField("adviser")} />
            </Field>
            <div className="form-grid-2">
              <Field label="Academic year">
                <input className="input" value={editForm.academicYear} onChange={updateEditField("academicYear")} placeholder="e.g. 2025-2026" pattern="[0-9]{4}-[0-9]{4}" title="Use the format YYYY-YYYY, for example 2025-2026" required />
              </Field>
              <Field label="Semester">
                <select className="input" value={editForm.semester} onChange={updateEditField("semester")}>
                  <option>1st Semester</option>
                  <option>2nd Semester</option>
                  <option>Summer</option>
                </select>
              </Field>
            </div>
            <Field label="Program">
              <select className="input" value={editForm.program} onChange={updateEditField("program")} required>
                <option value="">Select program</option>
                <option value="BSIT">Bachelor of Science in Information Technology (BSIT)</option>
                <option value="BSCS">Bachelor of Science in Computer Science (BSCS)</option>
                <option value="BSIS">Bachelor of Science in Information Systems (BSIS)</option>
                <option value="BSCpE">Bachelor of Science in Computer Engineering (BSCpE)</option>
                <option value="Associate/Diploma in Computer Technology">Associate/Diploma in Computer Technology</option>
              </select>
            </Field>
            <Field label="Keywords (comma-separated)">
              <input className="input" value={editForm.keywords} onChange={updateEditField("keywords")} />
            </Field>
            <Field label="SDG classification">
              <div className="sdg-grid">
                {SDG_LIST.map((sdg) => (
                  <button type="button" key={sdg.id} onClick={() => toggleEditSdg(sdg.id)} className={`sdg-chip${editSdgTags.includes(sdg.id) ? " selected" : ""}`}>
                    <span className="sdg-chip-num">{sdg.id}</span>
                    {sdg.title}
                  </button>
                ))}
              </div>
            </Field>
            <div className="form-grid-2">
              <Field label="Replace manuscript (PDF or DOCX)">
                <input className="input" type="file" accept=".pdf,.docx" onChange={(event) => setEditFiles((current) => ({ ...current, manuscript: event.target.files?.[0] || null }))} />
              </Field>
              <Field label="Replace source code (ZIP)">
                <input className="input" type="file" accept=".zip" onChange={(event) => setEditFiles((current) => ({ ...current, sourceCode: event.target.files?.[0] || null }))} />
              </Field>
              <Field label="Replace IEEE paper (PDF)">
                <input className="input" type="file" accept=".pdf" onChange={(event) => setEditFiles((current) => ({ ...current, ieee: event.target.files?.[0] || null }))} />
              </Field>
              <Field label="Replace ACM paper (PDF)">
                <input className="input" type="file" accept=".pdf" onChange={(event) => setEditFiles((current) => ({ ...current, acm: event.target.files?.[0] || null }))} />
              </Field>
              <Field label="Replace APA paper (PDF)">
                <input className="input" type="file" accept=".pdf" onChange={(event) => setEditFiles((current) => ({ ...current, apa: event.target.files?.[0] || null }))} />
              </Field>
            </div>
          </div>

          {editError && <p className="auth-error" role="alert" style={{ marginTop: 16 }}>{editError}</p>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
            <Button type="button" variant="secondary" onClick={cancelEditing}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={editSaving}>{editSaving ? "Saving..." : "Save changes"}</Button>
          </div>
        </form>
      )}

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton" style={{ height: 110 }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <EmptyState icon={FolderOpen} title="Nothing here yet">
            {submissions.length === 0 ? "Nothing submitted yet." : "No submissions match this filter."}
          </EmptyState>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map((s) => (
            <div key={s.id} className="card card-pad">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <h3 style={{ fontSize: 15, fontFamily: "var(--font-display)" }}>{s.title}</h3>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <StatusBadge status={s.status} />
                  {role === "student" && s.status !== "approved" && (
                    <Button type="button" variant="secondary" size="sm" onClick={() => startEditing(s)}>
                      <Pencil size={13} /> Edit
                    </Button>
                  )}
                </div>
              </div>
              <p style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 3 }}>
                Submitted {new Date(s.created_at).toLocaleDateString()}
              </p>
              <p style={{ fontSize: 13, marginTop: 10 }}>{s.abstract}</p>
              {s.review_notes && (
                <p style={{ fontSize: 12.5, marginTop: 10, background: "var(--surface-sunken)", padding: 10, borderRadius: 8 }}>
                  <strong>Reviewer notes:</strong> {s.review_notes}
                </p>
              )}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
                {s.file_url && (
                  <a href={s.file_url} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                    <FileText size={13} /> View manuscript
                  </a>
                )}
                {s.source_code_url && (
                  <a href={s.source_code_url} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                    <FolderOpen size={13} /> View source code
                  </a>
                )}
                {s.ieee_paper_url && (
                  <a href={s.ieee_paper_url} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                    <FileText size={13} /> View IEEE short paper
                  </a>
                )}
                {s.acm_paper_url && (
                  <a href={s.acm_paper_url} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                    <FileText size={13} /> View ACM style paper
                  </a>
                )}
                {s.apa_paper_url && (
                  <a href={s.apa_paper_url} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                    <FileText size={13} /> View APA style paper
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {confirmEditSave && editing && (
        <div
          role="presentation"
          onMouseDown={(event) => { if (event.target === event.currentTarget && !editSaving) setConfirmEditSave(false); }}
          style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "rgba(15, 23, 42, 0.55)" }}
        >
          <div className="card card-pad" role="alertdialog" aria-modal="true" aria-labelledby="edit-confirm-title" style={{ width: "min(100%, 440px)", boxShadow: "var(--shadow-lg)" }}>
            <h2 id="edit-confirm-title" style={{ fontSize: 19 }}>Confirm submission changes</h2>
            <p style={{ marginTop: 10, color: "var(--ink-700)" }}>Save your updates to <strong>{editing.title}</strong>?</p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
              <button type="button" className="btn btn-outline btn-sm" disabled={editSaving} onClick={() => setConfirmEditSave(false)}>Cancel</button>
              <button type="button" className="btn btn-primary btn-sm" disabled={editSaving} onClick={saveEditChanges}>{editSaving ? "Saving..." : "Yes, save changes"}</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
