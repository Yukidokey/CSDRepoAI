import { useEffect, useState } from "react";
import { FileText, FolderOpen, Check, X, Clock, ClipboardCheck } from "lucide-react";
import Layout from "../../components/Layout";
import { PageHeader, EmptyState } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { getPendingSubmissions, reviewSubmission } from "../../services/research";

export default function ReviewApproval() {
  const { user } = useAuth();
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState({});

  function load() {
    getPendingSubmissions().then(setPending).finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDecision(paperId, status) {
    await reviewSubmission({ paperId, status, notes: notes[paperId] || "", reviewerId: user.id });
    load();
  }

  return (
    <Layout>
      <PageHeader eyebrow="Submission Review" title="Review & Approval" description="Evaluate pending research submissions before they're archived." />

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {[0, 1].map((i) => (
            <div key={i} className="skeleton" style={{ height: 160 }} />
          ))}
        </div>
      ) : pending.length === 0 ? (
        <div className="card">
          <EmptyState icon={ClipboardCheck} title="All caught up">
            No pending submissions right now.
          </EmptyState>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {pending.map((p) => (
            <div key={p.id} className="card card-pad">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div>
                  <h3 style={{ fontSize: 15, fontFamily: "var(--font-display)" }}>{p.title}</h3>
                  <p style={{ fontSize: 12.5, color: "var(--ink-500)", marginTop: 3 }}>
                    Submitted by {p.profiles?.full_name} ({p.profiles?.student_number || "n/a"})
                  </p>
                </div>
                <span className="badge badge-warning">
                  <Clock size={11} /> {p.status.replace("_", " ")}
                </span>
              </div>
              <p style={{ fontSize: 13, marginTop: 10 }}>{p.abstract}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
                {p.file_url && (
                  <a href={p.file_url} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                    <FileText size={13} /> View manuscript
                  </a>
                )}
                {p.source_code_url && (
                  <a href={p.source_code_url} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                    <FolderOpen size={13} /> View source code
                  </a>
                )}
                {p.ieee_paper_url && (
                  <a href={p.ieee_paper_url} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                    <FileText size={13} /> View IEEE short paper
                  </a>
                )}
              </div>
              <textarea
                placeholder="Review notes (optional)"
                value={notes[p.id] || ""}
                onChange={(e) => setNotes((n) => ({ ...n, [p.id]: e.target.value }))}
                rows={2}
                className="input"
                style={{ marginTop: 12 }}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button onClick={() => handleDecision(p.id, "approved")} className="btn btn-success btn-sm">
                  <Check size={13} /> Approve
                </button>
                <button onClick={() => handleDecision(p.id, "rejected")} className="btn btn-danger btn-sm">
                  <X size={13} /> Reject
                </button>
                <button onClick={() => handleDecision(p.id, "under_review")} className="btn btn-outline btn-sm">
                  Mark Under Review
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
