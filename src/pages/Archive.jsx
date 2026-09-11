import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FileText, FolderOpen, Archive as ArchiveIcon, X } from "lucide-react";
import Layout from "../components/Layout";
import { PageHeader, EmptyState } from "../components/ui";
import { getApprovedPapers, getResearchFileUrls, incrementViewCount, incrementDownloadCount, openResearchFile } from "../services/research";
import { SDG_LIST } from "../lib/sdgList";

export default function Archive() {
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [yearFilter, setYearFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [queryFilter, setQueryFilter] = useState("");
  const [fileError, setFileError] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();

  // Supports deep-linking from the faculty sidebar's "Browse by SDG" list,
  // e.g. /faculty/archive?sdg=13 — pre-filters to papers tagged with that SDG.
  const sdgFilter = searchParams.get("sdg") ? Number(searchParams.get("sdg")) : null;
  const activeSdg = sdgFilter ? SDG_LIST.find((s) => s.id === sdgFilter) : null;

  function clearSdgFilter() {
    const next = new URLSearchParams(searchParams);
    next.delete("sdg");
    setSearchParams(next, { replace: true });
  }

  useEffect(() => {
    getApprovedPapers({ limit: 200 }).then(setPapers).finally(() => setLoading(false));
  }, []);

  const years = useMemo(() => {
    const set = new Set(papers.map((p) => p.academic_year).filter(Boolean));
    return ["all", ...Array.from(set).sort().reverse()];
  }, [papers]);

  const sourceCounts = useMemo(
    () => ({
      all: papers.length,
      digital: papers.filter((paper) => paper.source !== "ocr_scanned").length,
      ocr_scanned: papers.filter((paper) => paper.source === "ocr_scanned").length,
    }),
    [papers]
  );

  const filtered = papers.filter((p) => {
    const matchesYear = yearFilter === "all" || p.academic_year === yearFilter;
    const matchesSource =
      sourceFilter === "all" ||
      (sourceFilter === "ocr_scanned" ? p.source === "ocr_scanned" : p.source !== "ocr_scanned");
    const matchesSdg = !sdgFilter || (p.sdg_tags || []).includes(sdgFilter);
    const q = queryFilter.toLowerCase();
    const matchesQuery =
      !q ||
      p.title.toLowerCase().includes(q) ||
      (p.authors || []).some((a) => a.toLowerCase().includes(q)) ||
      (p.keywords || []).some((k) => k.toLowerCase().includes(q));
    return matchesYear && matchesSource && matchesSdg && matchesQuery;
  });

  const digitalPapers = filtered.filter((paper) => paper.source !== "ocr_scanned");
  const ocrPapers = filtered.filter((paper) => paper.source === "ocr_scanned");

  function renderPaperTable(records) {
    return (
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Authors</th>
              <th>Year</th>
              <th>Keywords</th>
              <th>Source</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {records.map((p) => (
              <tr key={p.id}>
                <td style={{ fontWeight: 600, maxWidth: 280 }}>{p.title}</td>
                <td style={{ color: "var(--ink-500)" }}>{(p.authors || []).join(", ")}</td>
                <td>{p.academic_year || "—"}</td>
                <td>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {(p.keywords || []).slice(0, 3).map((k) => (
                      <span key={k} className="badge badge-neutral">
                        {k}
                      </span>
                    ))}
                  </div>
                </td>
                <td>
                  <span className={`badge ${p.source === "ocr_scanned" ? "badge-info" : "badge-neutral"}`}>
                    {p.source === "ocr_scanned" ? "OCR Scanned" : "Digital"}
                  </span>
                </td>
                <td>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
                    {getResearchFileUrls(p.file_url).length > 0 && (
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          setFileError("");
                          try {
                            await openResearchFile(p);
                            await incrementViewCount(p.id);
                            await incrementDownloadCount(p.id);
                          } catch (error) {
                            setFileError(error.message);
                          }
                        }}
                        style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12.5, fontWeight: 600, color: "var(--brass-700)", background: "none", border: 0, cursor: "pointer", padding: 0, textDecoration: "underline" }}
                      >
                        <FileText size={13} /> View manuscript
                      </button>
                    )}
                    {getResearchFileUrls(p.source_code_url).length > 0 && (
                      <a
                        href={getResearchFileUrls(p.source_code_url)[0]}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12.5, fontWeight: 600, color: "var(--brass-700)", textDecoration: "underline" }}
                      >
                        <FolderOpen size={13} /> View source code
                      </a>
                    )}
                    {getResearchFileUrls(p.ieee_paper_url).length > 0 && (
                      <a
                        href={getResearchFileUrls(p.ieee_paper_url)[0]}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12.5, fontWeight: 600, color: "var(--brass-700)", textDecoration: "underline" }}
                      >
                        <FileText size={13} /> View IEEE short paper
                      </a>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <Layout>
      <PageHeader
        eyebrow="Digital Repository"
        title="Research Archive"
        description={
          activeSdg
            ? `Showing research tagged under SDG ${activeSdg.id}: ${activeSdg.title}.`
            : "Browse every approved and digitized research output in the department, organized by title, author, year, and keyword."
        }
      />

      {activeSdg && (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 14,
            padding: "6px 6px 6px 12px",
            borderRadius: 999,
            background: "var(--ink-900)",
            color: "#fff",
            fontSize: 12.5,
            fontWeight: 600,
          }}
        >
          SDG {activeSdg.id}: {activeSdg.title}
          <button
            onClick={clearSdgFilter}
            aria-label="Clear SDG filter"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.16)",
              border: "none",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            <X size={12} />
          </button>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <input
          className="input"
          placeholder="Filter by title, author, or keyword..."
          value={queryFilter}
          onChange={(e) => setQueryFilter(e.target.value)}
          style={{ maxWidth: 320 }}
        />
        <select className="input" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} style={{ maxWidth: 180 }}>
          {years.map((y) => (
            <option key={y} value={y}>
              {y === "all" ? "All academic years" : y}
            </option>
          ))}
        </select>
        <select
          className="input"
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          style={{ maxWidth: 180 }}
          aria-label="Filter by source"
        >
          <option value="all">All sources ({sourceCounts.all})</option>
          <option value="digital">Digital ({sourceCounts.digital})</option>
          <option value="ocr_scanned">OCR Scanned ({sourceCounts.ocr_scanned})</option>
        </select>
        <span style={{ marginLeft: "auto", alignSelf: "center", fontSize: 12.5, color: "var(--ink-500)" }}>
          {loading ? "" : `${filtered.length} record${filtered.length === 1 ? "" : "s"}`}
        </span>
      </div>

      {loading ? (
        <div className="table-wrap card-pad" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton" style={{ height: 18 }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <EmptyState icon={ArchiveIcon} title="No records found">
            No research records match those filters yet.
          </EmptyState>
        </div>
      ) : (
        <div className="archive-source-sections">
          {digitalPapers.length > 0 && (
            <section className="archive-source-section">
              <div className="archive-source-heading">
                <div>
                  <span className="page-eyebrow">Source collection</span>
                  <h2>Digital Research</h2>
                </div>
                <span className="badge badge-neutral">{digitalPapers.length} records</span>
              </div>
              {renderPaperTable(digitalPapers)}
            </section>
          )}
          {ocrPapers.length > 0 && (
            <section className="archive-source-section">
              <div className="archive-source-heading">
                <div>
                  <span className="page-eyebrow">Source collection</span>
                  <h2>OCR Scanned Research</h2>
                </div>
                <span className="badge badge-info">{ocrPapers.length} records</span>
              </div>
              {renderPaperTable(ocrPapers)}
            </section>
          )}
          {fileError && <p className="auth-error" style={{ margin: "12px 0" }}>{fileError}</p>}
        </div>
      )}
    </Layout>
  );
}
