import { useState } from "react";
import { Search as SearchIcon, FileSearch } from "lucide-react";
import Layout from "../components/Layout";
import { PageHeader, EmptyState } from "../components/ui";
import { searchResearch } from "../services/search";
import { incrementDownloadCount } from "../services/research";

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
            <h3 style={{ fontSize: 15.5, fontFamily: "var(--font-display)" }}>{r.title}</h3>
            <p style={{ fontSize: 13, color: "var(--ink-500)", marginTop: 6 }}>{r.abstract}</p>
            <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
              {(r.keywords || []).map((k) => (
                <span key={k} className="badge badge-neutral">
                  {k}
                </span>
              ))}
            </div>
            {r.file_url && (
              <a
                href={r.file_url}
                target="_blank"
                rel="noreferrer"
                onClick={() => incrementDownloadCount(r.id)}
                style={{ fontSize: 12.5, fontWeight: 600, marginTop: 10, display: "inline-block" }}
              >
                View document →
              </a>
            )}
          </div>
        ))}
      </div>
    </Layout>
  );
}
