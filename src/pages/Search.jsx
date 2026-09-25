import { useState } from "react";
import { Search as SearchIcon, FileSearch, FolderOpen } from "lucide-react";
import Layout from "../components/Layout";
import { PageHeader, EmptyState } from "../components/ui";
import { searchResearch } from "../services/search";
import { getResearchFileUrls, incrementDownloadCount } from "../services/research";

export default function Search() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function handleSearch(e) {
    e.preventDefault();
    setLoading(true);
    setSearched(true);
    try {
      const data = await searchResearch(query);
      setResults(data);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout>
      <PageHeader
        eyebrow="AI-Assisted Retrieval"
        title="Search the Repository"
        description="Describe your topic in plain language. Matches title, abstract, keywords, and OCR-digitized text across the archive."
      />

      <form onSubmit={handleSearch} style={{ display: "flex", gap: 8, marginBottom: 24, maxWidth: 640 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. mobile app for barangay disaster response"
          className="input"
        />
        <button type="submit" className="btn btn-brass">
          <SearchIcon size={14} /> Search
        </button>
      </form>

      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton" style={{ height: 96 }} />
          ))}
        </div>
      )}

      {!loading && searched && results.length === 0 && (
        <div className="card">
          <EmptyState icon={FileSearch} title="No matches found">
            No matching research found. Try a broader topic or fewer keywords.
          </EmptyState>
        </div>
      )}

      {!loading && results.length > 0 && (
        <p style={{ fontSize: 12.5, color: "var(--ink-500)", marginBottom: 12 }}>
          {results.length} result{results.length === 1 ? "" : "s"} for "{query}"
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {results.map((r) => (
          <div key={r.id} className="card card-pad">
            <div className="search-result-heading">
              <h3>{r.title}</h3>
              <div
                className={`search-match-confidence${r.matchConfidence >= 80 ? " is-high" : r.matchConfidence >= 65 ? " is-mid" : " is-low"}`}
                aria-label={`Match confidence ${r.matchConfidence}%`}
                title="Relevance score based on the paper's content and semantic similarity; not a probability."
              >
                <span>Match confidence</span>
                <strong>{r.matchConfidence}%</strong>
                <span className="search-match-track" aria-hidden="true"><span style={{ width: `${r.matchConfidence}%` }} /></span>
              </div>
            </div>
            <p style={{ fontSize: 13, color: "var(--ink-500)", marginTop: 6 }}>{r.abstract}</p>
            <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
              {(r.keywords || []).map((k) => (
                <span key={k} className="badge badge-neutral">
                  {k}
                </span>
              ))}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
              {getResearchFileUrls(r.file_url).length > 0 && (
                <a
                  href={getResearchFileUrls(r.file_url)[0]}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => incrementDownloadCount(r.id)}
                  style={{ fontSize: 12.5, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}
                >
                  <FileSearch size={13} /> View manuscript
                </a>
              )}
              {getResearchFileUrls(r.source_code_url).length > 0 && (
                <a
                  href={getResearchFileUrls(r.source_code_url)[0]}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => incrementDownloadCount(r.id)}
                  style={{ fontSize: 12.5, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}
                >
                  <FolderOpen size={13} /> View source code
                </a>
              )}
              {getResearchFileUrls(r.ieee_paper_url).length > 0 && (
                <a
                  href={getResearchFileUrls(r.ieee_paper_url)[0]}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => incrementDownloadCount(r.id)}
                  style={{ fontSize: 12.5, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}
                >
                  <FileSearch size={13} /> View IEEE short paper
                </a>
              )}
              {getResearchFileUrls(r.acm_paper_url).length > 0 && (
                <a href={getResearchFileUrls(r.acm_paper_url)[0]} target="_blank" rel="noreferrer" onClick={() => incrementDownloadCount(r.id)} style={{ fontSize: 12.5, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <FileSearch size={13} /> View ACM style paper
                </a>
              )}
              {getResearchFileUrls(r.apa_paper_url).length > 0 && (
                <a href={getResearchFileUrls(r.apa_paper_url)[0]} target="_blank" rel="noreferrer" onClick={() => incrementDownloadCount(r.id)} style={{ fontSize: 12.5, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <FileSearch size={13} /> View APA style paper
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}
