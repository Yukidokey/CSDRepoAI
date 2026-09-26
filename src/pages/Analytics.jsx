import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Download, Eye, FileDown, FolderOpen, CheckCircle2, Clock, XCircle, Users2, GraduationCap, UserCog, UserCheck, UserX, Search } from "lucide-react";
import Layout from "../components/Layout";
import { PageHeader, StatGrid, StatCard } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { getAnalyticsSummary, getUserAnalytics, exportSummaryCsv } from "../services/analytics";

const PIE_COLORS = ["var(--analytics-pie-1)", "var(--analytics-pie-2)", "var(--analytics-pie-3)", "var(--analytics-pie-4)", "var(--analytics-pie-5)", "var(--analytics-pie-6)", "var(--analytics-pie-7)"];
const BAR_COLORS = { total: "var(--analytics-total)", published: "var(--analytics-published)", program: "var(--analytics-program)", keyword: "var(--analytics-keyword)" };
const LEGEND_STYLE = { fontSize: 12, color: "var(--ink-700)" };

export default function Analytics() {
  const { role } = useAuth();
  const [data, setData] = useState(null);
  const [users, setUsers] = useState(null);
  const [loading, setLoading] = useState(true);
  const [titleSearch, setTitleSearch] = useState("");

  useEffect(() => {
    Promise.all([
      getAnalyticsSummary(),
      role === "admin" ? getUserAnalytics() : Promise.resolve(null),
    ])
      .then(([summary, userStats]) => {
        setData(summary);
        setUsers(userStats);
      })
      .finally(() => setLoading(false));
  }, [role]);

  if (loading) {
    return (
      <Layout>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="skeleton" style={{ height: 28, width: 220 }} />
          <div className="stat-grid">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton" style={{ height: 88 }} />
            ))}
          </div>
          <div className="skeleton" style={{ height: 260 }} />
        </div>
      </Layout>
    );
  }
  if (!data) return <Layout><p className="page-loading">No data available yet.</p></Layout>;

  const searchTerm = titleSearch.trim().toLocaleLowerCase();
  const filteredTitlesByProgram = data.titlesByProgram
    .map(({ program, titles }) => ({
      program,
      titles: titles.filter((paper) =>
        !searchTerm
        || program.toLocaleLowerCase().includes(searchTerm)
        || paper.title.toLocaleLowerCase().includes(searchTerm)
        || paper.status.toLocaleLowerCase().replaceAll("_", " ").includes(searchTerm)
      ),
    }))
    .filter(({ titles }) => titles.length > 0);

  return (
    <Layout>
      <PageHeader
        eyebrow="Research Analytics Dashboard"
        title="Research Analytics"
        description="Submission trends, program distribution, engagement, and SDG alignment across the repository."
        action={
          <button className="btn btn-outline btn-sm" onClick={() => exportSummaryCsv(data.rawPapers)}>
            <Download size={13} /> Export report (CSV)
          </button>
        }
      />

      <StatGrid>
        <StatCard label="Total Submissions" value={data.totalSubmissions} accent="brass" icon={FolderOpen} />
        <StatCard label="Published (Approved)" value={data.approved} accent="success" icon={CheckCircle2} />
        <StatCard label="Pending" value={data.pending} accent="warning" icon={Clock} />
        <StatCard label="Rejected" value={data.rejected} accent="danger" icon={XCircle} />
      </StatGrid>

      {/* a + b: Published per year vs total per school year */}
      <SectionTitle>Research Volume Over Time</SectionTitle>
      <div className="card card-pad">
        <h3 style={{ fontSize: 13.5, marginBottom: 14 }}>Total Submitted vs. Published, per Academic Year</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data.byYear}>
            <XAxis dataKey="name" fontSize={11} stroke="var(--ink-500)" />
            <YAxis allowDecimals={false} fontSize={11} stroke="var(--ink-500)" />
            <Tooltip content={<AnalyticsTooltip />} />
            <Legend wrapperStyle={LEGEND_STYLE} />
            <Bar dataKey="total" name="Total submitted" fill={BAR_COLORS.total} radius={[4, 4, 0, 0]} />
            <Bar dataKey="published" name="Published" fill={BAR_COLORS.published} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* c + g: program + SDG */}
      <SectionTitle>Distribution</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div className="card card-pad" style={{ width: "100%" }}>
          <h3 style={{ fontSize: 14, marginBottom: 14 }}>Research per Program</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.byProgram}>
              <XAxis dataKey="name" fontSize={11} stroke="var(--ink-500)" />
              <YAxis allowDecimals={false} fontSize={11} stroke="var(--ink-500)" />
              <Tooltip content={<AnalyticsTooltip />} />
              <Bar dataKey="count" fill={BAR_COLORS.program} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card card-pad" style={{ width: "100%" }}>
          <h3 style={{ fontSize: 14, marginBottom: 14 }}>Research by SDG Alignment</h3>
          {data.sdgCounts.length === 0 ? (
            <p style={{ color: "var(--ink-500)", fontSize: 13 }}>No SDG-tagged research yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={data.sdgCounts} dataKey="count" nameKey="sdg" outerRadius={85} label={{ fill: "var(--ink-700)", fontSize: 11 }}>
                  {data.sdgCounts.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<AnalyticsTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card card-pad" style={{ width: "100%" }}>
          <div style={{ marginBottom: 18 }}>
            <h3 style={{ fontSize: 14 }}>Research by Keyword</h3>
            <p style={{ color: "var(--ink-500)", fontSize: 12.5, marginTop: 4 }}>Most common keywords across submitted research.</p>
          </div>
          {data.byKeyword.length === 0 ? (
            <p style={{ color: "var(--ink-500)", fontSize: 13 }}>No keywords recorded yet.</p>
          ) : (
            <div className="keyword-analytics-grid">
              {data.byKeyword.map(({ keyword, count }, index) => (
                <div className="keyword-analytics-item" key={keyword} title={`${keyword}: ${count} research paper${count === 1 ? "" : "s"}`}>
                  <span className="keyword-analytics-rank">{String(index + 1).padStart(2, "0")}</span>
                  <div className="keyword-analytics-content">
                    <div className="keyword-analytics-label-row">
                      <span className="keyword-analytics-label">{keyword}</span>
                      <span className="keyword-analytics-count">{count}</span>
                    </div>
                    <div className="keyword-analytics-track" aria-hidden="true">
                      <span style={{ width: `${Math.max(6, (count / data.byKeyword[0].count) * 100)}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <SectionTitle>Research Titles by Program</SectionTitle>
      <div className="card card-pad">
        <p style={{ color: "var(--ink-500)", fontSize: 13, marginBottom: 16 }}>
          Compare existing active and approved research titles before choosing a topic.
        </p>
        <label style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 18, maxWidth: 440 }}>
          <Search size={16} color="var(--ink-500)" aria-hidden="true" />
          <input
            className="input"
            type="search"
            value={titleSearch}
            onChange={(event) => setTitleSearch(event.target.value)}
            placeholder="Search by research title, program, or status..."
            aria-label="Search research titles by title, program, or status"
          />
        </label>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {filteredTitlesByProgram.length === 0 ? (
            <p style={{ color: "var(--ink-500)", fontSize: 13 }}>
              {searchTerm ? "No research titles match your search." : "No research titles available yet."}
            </p>
          ) : (
            filteredTitlesByProgram.map(({ program, titles }) => (
              <section key={program} style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, paddingBottom: 8, borderBottom: "1px solid var(--line)" }}>
                  <h3 style={{ fontSize: 14 }}>{program}</h3>
                  <span className="badge badge-neutral">{titles.length} title{titles.length === 1 ? "" : "s"}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                  {titles.map((paper) => (
                    <div key={paper.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minWidth: 0 }}>
                      <span style={{ minWidth: 0, fontSize: 13, overflowWrap: "anywhere" }}>{paper.title}</span>
                      <StatusBadge status={paper.status} />
                    </div>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </div>

      {/* d: most viewed / downloaded */}
      <SectionTitle>Engagement</SectionTitle>
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        <RankedList title="Most Viewed Research" icon={Eye} items={data.mostViewed} metricKey="view_count" metricLabel="views" />
        <RankedList title="Most Downloaded Research" icon={FileDown} items={data.mostDownloaded} metricKey="download_count" metricLabel="downloads" />
      </div>

      {role === "admin" && (
        <>
          <SectionTitle>User Analytics</SectionTitle>
          {users && (
            <StatGrid>
              <StatCard label="Total Users" value={users.total} accent="brass" icon={Users2} />
              <StatCard label="Students" value={users.byRole.student || 0} accent="info" icon={GraduationCap} />
              <StatCard label="Faculty" value={users.byRole.faculty || 0} accent="info" icon={UserCog} />
              <StatCard label="Admins" value={users.byRole.admin || 0} accent="info" icon={UserCog} />
              <StatCard label="Active Accounts" value={users.active} accent="success" icon={UserCheck} />
              <StatCard label="Deactivated Accounts" value={users.inactive} accent="danger" icon={UserX} />
            </StatGrid>
          )}
        </>
      )}
    </Layout>
  );
}

function SectionTitle({ children }) {
  return (
    <h2 style={{ fontSize: 13, fontFamily: "var(--font-mono)", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--brass-700)", margin: "30px 0 14px" }}>
      {children}
    </h2>
  );
}

function AnalyticsTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="analytics-tooltip">
      {label && <div className="analytics-tooltip-label">{label}</div>}
      {payload.map((entry) => (
        <div key={entry.dataKey || entry.name} className="analytics-tooltip-row">
          <span>{entry.name || entry.dataKey}</span>
          <strong>{entry.value}</strong>
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }) {
  const labels = { approved: "Approved", pending: "Pending", under_review: "Under review" };
  const kinds = { approved: "success", pending: "warning", under_review: "info" };
  return <span className={`badge badge-${kinds[status] || "neutral"}`}>{labels[status] || status}</span>;
}

function RankedList({ title, icon: Icon, items, metricKey, metricLabel }) {
  return (
    <div className="card card-pad" style={{ flex: "1 1 340px", minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
        <Icon size={14} color="var(--brass-600)" />
        <h3 style={{ fontSize: 14 }}>{title}</h3>
      </div>
      {items.length === 0 ? (
        <p style={{ color: "var(--ink-500)", fontSize: 13 }}>No {metricLabel} recorded yet — this fills in as people browse the archive.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((p, i) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, minWidth: 0, padding: "8px 0", borderBottom: i < items.length - 1 ? "1px solid var(--line)" : "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-300)", flexShrink: 0 }}>{String(i + 1).padStart(2, "0")}</span>
                <span style={{ display: "block", flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</span>
              </div>
              <span className="badge badge-neutral" style={{ flexShrink: 0 }}>
                {p[metricKey] || 0} {metricLabel}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
