import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Upload, Search, Clock, CheckCircle2, XCircle, FileText } from "lucide-react";
import Layout from "../../components/Layout";
import { PageHeader, StatGrid, StatCard, StatusBadge, EmptyState } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { getMySubmissions } from "../../services/research";

export default function StudentDashboard() {
  const { user, profile } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getMySubmissions(user.id).then(setSubmissions).finally(() => setLoading(false));
  }, [user]);

  const counts = {
    pending: submissions.filter((s) => s.status === "pending" || s.status === "under_review").length,
    approved: submissions.filter((s) => s.status === "approved").length,
    rejected: submissions.filter((s) => s.status === "rejected").length,
  };

  return (
    <Layout>
      <PageHeader
        eyebrow="Student Dashboard"
        title={`Welcome, ${profile?.full_name?.split(" ")[0] || ""}`}
        description="Track your research submissions and their review status."
      />

      <StatGrid>
        <StatCard label="Pending / Under Review" value={counts.pending} accent="warning" icon={Clock} />
        <StatCard label="Approved" value={counts.approved} accent="success" icon={CheckCircle2} />
        <StatCard label="Rejected" value={counts.rejected} accent="danger" icon={XCircle} />
      </StatGrid>

      <div style={{ display: "flex", gap: 12, margin: "24px 0" }}>
        <Link to="/student/submit" className="btn btn-brass">
          <Upload size={14} /> Submit Research
        </Link>
        <Link to="/student/search" className="btn btn-outline">
          <Search size={14} /> Search Repository
        </Link>
      </div>

      <h2 style={{ fontSize: 13, fontFamily: "var(--font-mono)", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--brass-700)", marginBottom: 14 }}>
        Recent Submissions
      </h2>
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton" style={{ height: 44 }} />
          ))}
        </div>
      ) : submissions.length === 0 ? (
        <div className="card">
          <EmptyState icon={FileText} title="No submissions yet">
            You haven't submitted any research yet. Start with "Submit Research" above.
          </EmptyState>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {submissions.slice(0, 5).map((s) => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600 }}>{s.title}</td>
                  <td>
                    <StatusBadge status={s.status} />
                  </td>
                  <td style={{ color: "var(--ink-500)" }}>{new Date(s.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}
