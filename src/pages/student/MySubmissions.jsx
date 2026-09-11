import { useEffect, useMemo, useState } from "react";
import { FileText, FolderOpen } from "lucide-react";
import Layout from "../../components/Layout";
import { PageHeader, StatusBadge, EmptyState } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { getMySubmissions } from "../../services/research";

export default function MySubmissions() {
  const { user, role } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    if (!user) return;
    getMySubmissions(user.id).then(setSubmissions).finally(() => setLoading(false));
  }, [user]);

  const filtered = useMemo(
    () => (statusFilter === "all" ? submissions : submissions.filter((s) => s.status === statusFilter)),
    [submissions, statusFilter]
  );

  const statuses = ["all", "pending", "under_review", "approved", "rejected"];

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
                <StatusBadge status={s.status} />
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
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
