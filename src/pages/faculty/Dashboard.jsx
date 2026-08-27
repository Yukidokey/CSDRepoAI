import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, BarChart3, ArrowRight, BookOpen } from "lucide-react";
import Layout from "../../components/Layout";
import { PageHeader, EmptyState } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { getApprovedPapers } from "../../services/research";

export default function FacultyDashboard() {
  const { profile } = useAuth();
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    getApprovedPapers({ limit: 5 }).then(setRecent);
  }, []);

  return (
    <Layout>
      <PageHeader
        eyebrow="Faculty Dashboard"
        title={`Welcome, ${profile?.full_name?.split(" ")[0] || ""}`}
        description="Browse the repository, run AI-assisted searches, or check research trends."
      />

      <div style={{ display: "flex", gap: 16, marginBottom: 28, flexWrap: "wrap" }}>
        <Link to="/faculty/search" className="card card-pad" style={{ flex: "1 1 240px", textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: "var(--brass-50)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Search size={18} color="var(--brass-600)" />
            </div>
            <div>
              <p style={{ fontWeight: 600, color: "var(--ink-900)", fontSize: 14 }}>Search Repository</p>
              <p style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 2 }}>Find research by topic or keyword</p>
            </div>
          </div>
          <ArrowRight size={16} color="var(--ink-300)" />
        </Link>
        <Link to="/faculty/analytics" className="card card-pad" style={{ flex: "1 1 240px", textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: "var(--brass-50)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <BarChart3 size={18} color="var(--brass-600)" />
            </div>
            <div>
              <p style={{ fontWeight: 600, color: "var(--ink-900)", fontSize: 14 }}>Research Analytics</p>
              <p style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 2 }}>View submission trends and SDG alignment</p>
            </div>
          </div>
          <ArrowRight size={16} color="var(--ink-300)" />
        </Link>
      </div>

      <h2 style={{ fontSize: 13, fontFamily: "var(--font-mono)", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--brass-700)", marginBottom: 14 }}>
        Recently Approved Research
      </h2>
      {recent.length === 0 ? (
        <div className="card">
          <EmptyState icon={BookOpen} title="Nothing approved yet">
            Newly approved research will show up here as it's published.
          </EmptyState>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {recent.map((r) => (
            <div key={r.id} className="card card-pad">
              <h3 style={{ fontSize: 14.5, fontFamily: "var(--font-display)" }}>{r.title}</h3>
              <p style={{ fontSize: 12.5, color: "var(--ink-500)", marginTop: 4 }}>{(r.authors || []).join(", ")}</p>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
