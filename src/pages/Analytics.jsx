import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Download, Eye, FileDown, FolderOpen, CheckCircle2, Clock, XCircle, Users2, GraduationCap, UserCog, UserCheck, UserX } from "lucide-react";
import Layout from "../components/Layout";
import { PageHeader, StatGrid, StatCard } from "../components/ui";
import { getAnalyticsSummary, getUserAnalytics, exportSummaryCsv } from "../services/analytics";

const PIE_COLORS = ["#a9812e", "#14213d", "#35577a", "#2f6846", "#9c6b14", "#a23b2e", "#57648a"];

function wrapKeyword(keyword, maxLength = 24) {
  const words = keyword.split(/\s+/);
  const lines = [];
  let currentLine = "";

  words.forEach((word) => {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    if (currentLine && nextLine.length > maxLength) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = nextLine;
    }
  });

  if (currentLine) lines.push(currentLine);
  return lines.slice(0, 2);
}

function KeywordTick({ x, y, payload }) {
  const lines = wrapKeyword(payload.value);
  const firstLineOffset = lines.length > 1 ? -6 : 0;

  return (
    <g transform={`translate(${x},${y})`}>
      <title>{payload.value}</title>
      <text x={-8} textAnchor="end" fill="var(--ink-500)" fontSize={10.5}>
        {lines.map((line, index) => (
          <tspan key={`${line}-${index}`} x={0} dy={index === 0 ? firstLineOffset : 12}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}

export default function Analytics() {
  const [data, setData] = useState(null);
  const [users, setUsers] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getAnalyticsSummary(), getUserAnalytics()])
      .then(([summary, userStats]) => {
        setData(summary);
        setUsers(userStats);
      })
      .finally(() => setLoading(false));
  }, []);

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
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--line)" }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="total" name="Total submitted" fill="#57648a" radius={[4, 4, 0, 0]} />
            <Bar dataKey="published" name="Published" fill="#a9812e" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* c + g: program + SDG */}
      <SectionTitle>Distribution</SectionTitle>
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        <div className="card card-pad" style={{ flex: "1 1 340px" }}>
          <h3 style={{ fontSize: 14, marginBottom: 14 }}>Research per Program</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.byProgram}>
              <XAxis dataKey="name" fontSize={11} stroke="var(--ink-500)" />
              <YAxis allowDecimals={false} fontSize={11} stroke="var(--ink-500)" />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--line)" }} />
              <Bar dataKey="count" fill="#14213d" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card card-pad" style={{ flex: "1 1 340px" }}>
          <h3 style={{ fontSize: 14, marginBottom: 14 }}>Research by SDG Alignment</h3>
          {data.sdgCounts.length === 0 ? (
            <p style={{ color: "var(--ink-500)", fontSize: 13 }}>No SDG-tagged research yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={data.sdgCounts} dataKey="count" nameKey="sdg" outerRadius={85} label>
                  {data.sdgCounts.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--line)" }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card card-pad" style={{ flex: "1 1 340px", minWidth: 0 }}>
          <h3 style={{ fontSize: 14, marginBottom: 14 }}>Research by Keyword</h3>
          {data.byKeyword.length === 0 ? (
            <p style={{ color: "var(--ink-500)", fontSize: 13 }}>No keywords recorded yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(240, data.byKeyword.length * 42)}>
              <BarChart data={data.byKeyword} layout="vertical" margin={{ left: 10, right: 12 }}>
                <XAxis type="number" allowDecimals={false} fontSize={11} stroke="var(--ink-500)" />
                <YAxis type="category" dataKey="keyword" width={155} interval={0} tick={<KeywordTick />} stroke="var(--ink-500)" />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--line)" }} />
                <Bar dataKey="count" fill="#9c6b14" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* d: most viewed / downloaded */}
      <SectionTitle>Engagement</SectionTitle>
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        <RankedList title="Most Viewed Research" icon={Eye} items={data.mostViewed} metricKey="view_count" metricLabel="views" />
        <RankedList title="Most Downloaded Research" icon={FileDown} items={data.mostDownloaded} metricKey="download_count" metricLabel="downloads" />
      </div>

      {/* f: user analytics */}
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

function RankedList({ title, icon: Icon, items, metricKey, metricLabel }) {
  return (
    <div className="card card-pad" style={{ flex: "1 1 340px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
        <Icon size={14} color="var(--brass-600)" />
        <h3 style={{ fontSize: 14 }}>{title}</h3>
      </div>
      {items.length === 0 ? (
        <p style={{ color: "var(--ink-500)", fontSize: 13 }}>No {metricLabel} recorded yet — this fills in as people browse the archive.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((p, i) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "8px 0", borderBottom: i < items.length - 1 ? "1px solid var(--line)" : "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-300)", flexShrink: 0 }}>{String(i + 1).padStart(2, "0")}</span>
                  <div className={`ranked-title-viewport${p.title.length > 70 ? " is-marquee" : ""}`}>
                    {p.title.length > 70 ? (
                      <div className="ranked-title-track">
                        <span>{p.title}</span>
                        <span aria-hidden="true">{p.title}</span>
                      </div>
                    ) : (
                      <span className="ranked-title-text">{p.title}</span>
                    )}
                  </div>
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
