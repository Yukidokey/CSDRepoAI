import { supabase } from "../lib/supabaseClient";

const GENKIT_SEARCH_URL = import.meta.env.VITE_GENKIT_SEARCH_URL;
const GENKIT_DUPLICATE_URL = GENKIT_SEARCH_URL?.replace(/\/search\/?$/i, "/check-duplicate");

export async function checkResearchDuplicate({ abstract, keywords = [], documentText = "", excludePaperId }) {
  if (!GENKIT_DUPLICATE_URL || GENKIT_DUPLICATE_URL === GENKIT_SEARCH_URL) {
    throw new Error("Manuscript similarity checking is unavailable. Please try again later.");
  }

  const response = await fetch(GENKIT_DUPLICATE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ abstract, keywords, documentText, excludePaperId }),
  });

  if (!response.ok) {
    throw new Error("Could not verify manuscript similarity. Your submission was not sent. Please try again later.");
  }

  const result = await response.json();
  if (typeof result.duplicate !== "boolean") {
    throw new Error("Could not verify manuscript similarity. Your submission was not sent. Please try again later.");
  }
  if (result.duplicate) {
    throw new Error("This manuscript is too similar to an existing submission. Please review it with your adviser before submitting.");
  }
}

/**
 * AI-Assisted Search and Retrieval Module
 *
 * The default path uses Postgres full-text search (the `search_vector` column
 * defined in supabase/schema.sql) so search works out of the box with no extra
 * infrastructure. When `VITE_GENKIT_SEARCH_URL` is configured, this service
 * will first try the Google Genkit semantic-search endpoint (see the
 * /genkit-server directory for the actual embedding + search service, built
 * with Google's gemini-embedding-001 model and Supabase pgvector) and falls
 * back cleanly to the existing Supabase text search if that endpoint is
 * unavailable.
 */
export async function searchResearch(query, { sdgFilter, statusFilter = "approved" } = {}) {
  if (!query || !query.trim()) return [];

  const normalizedQuery = query.trim();
  const textSearchPromise = searchByText(normalizedQuery, { sdgFilter, statusFilter });
  const semanticSearchPromise = GENKIT_SEARCH_URL
    ? searchBySemantic(normalizedQuery, { sdgFilter, statusFilter })
    : Promise.resolve([]);

  const [textResult, semanticResult] = await Promise.allSettled([
    textSearchPromise,
    semanticSearchPromise,
  ]);

  const textItems = textResult.status === "fulfilled" ? textResult.value : [];
  const semanticItems = semanticResult.status === "fulfilled" ? semanticResult.value : [];

  if (semanticResult.status === "rejected") {
    console.warn("Genkit semantic search unavailable, using text search results.", semanticResult.reason);
  }
  if (textResult.status === "rejected" && semanticItems.length === 0) {
    throw textResult.reason;
  }

  return mergeSearchResults(normalizedQuery, textItems, semanticItems);
}

async function searchBySemantic(query, filters) {
  const response = await fetch(GENKIT_SEARCH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, ...filters }),
  });

  if (!response.ok) {
    throw new Error(`Semantic search failed with status ${response.status}`);
  }

  const payload = await response.json();
  const items = payload.items || payload.results || payload.data || payload.searchResults;
  return Array.isArray(items) ? items : [];
}

async function searchByText(query, { sdgFilter, statusFilter }) {
  let request = supabase
    .from("research_papers")
    .select("*")
    .textSearch("search_vector", formatQuery(query), {
      type: "websearch",
      config: "english",
    });

  if (statusFilter) request = request.eq("status", statusFilter);
  if (sdgFilter) request = request.contains("sdg_tags", [sdgFilter]);

  const { data, error } = await request.limit(30);
  if (error) throw error;
  return data || [];
}

function formatQuery(raw) {
  // websearch_to_tsquery handles natural phrasing like "AI search for thesis papers"
  return raw.trim();
}

function mergeSearchResults(query, textItems, semanticItems) {
  const byId = new Map();

  for (const item of [...textItems, ...semanticItems]) {
    if (!item?.id) continue;

    const existing = byId.get(item.id);
    byId.set(item.id, existing ? { ...existing, ...item } : item);
  }

  return [...byId.values()]
    .map((item) => ({
      item,
      score: scoreSearchResult(query, item),
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 30)
    .map(({ item }) => item);
}

function scoreSearchResult(query, item) {
  const queryText = query.toLowerCase();
  const tokens = queryText
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2);
  const title = String(item.title || "").toLowerCase();
  const keywords = Array.isArray(item.keywords) ? item.keywords.join(" ").toLowerCase() : "";
  const abstract = String(item.abstract || "").toLowerCase();
  const searchableText = [title, keywords, abstract, item.ocr_raw_text || ""].join(" ").toLowerCase();

  let score = Number(item.similarity || 0) * 10;
  if (title.includes(queryText)) score += 30;
  if (keywords.includes(queryText)) score += 20;

  for (const token of tokens) {
    if (title.includes(token)) score += 8;
    if (keywords.includes(token)) score += 5;
    if (abstract.includes(token)) score += 2;
    if (searchableText.includes(token)) score += 0.5;
  }

  return score;
}
