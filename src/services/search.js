import { supabase } from "../lib/supabaseClient";

const GENKIT_SEARCH_URL = import.meta.env.VITE_GENKIT_SEARCH_URL;
const GENKIT_DUPLICATE_URL = GENKIT_SEARCH_URL?.replace(/\/search\/?$/i, "/check-duplicate");
const MIN_SEMANTIC_SIMILARITY = 0.45;
const MIN_MATCH_CONFIDENCE = 50;
const SEARCH_STOP_WORDS = new Set([
  "a", "an", "and", "are", "about", "for", "from", "in", "into", "is", "of", "on", "or", "the", "to", "with",
  "find", "paper", "papers", "research", "study", "studies", "system",
]);

export async function checkResearchDuplicate({ title, abstract, keywords = [], documentText = "", excludePaperId }) {
  if (!GENKIT_DUPLICATE_URL || GENKIT_DUPLICATE_URL === GENKIT_SEARCH_URL) {
    throw new Error("Topic duplicate checking is not configured. Ask an administrator to enable semantic search before submitting this manuscript.");
  }

  try {
    const response = await fetch(GENKIT_DUPLICATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, abstract, keywords, documentText: String(documentText || "").slice(0, 12000), excludePaperId }),
    });

    if (!response.ok) {
      throw new Error(`Topic duplicate checking is temporarily unavailable (${response.status}). Please try again later.`);
    }

    const result = await response.json();
    if (typeof result.duplicate !== "boolean") {
      throw new Error("Topic duplicate checking returned an invalid response. Please try again later.");
    }
    if (result.duplicate) {
      throw new Error("This manuscript is too similar to an existing submission. Please review it with your adviser before submitting.");
    }

    return false;
  } catch (error) {
    if (error instanceof Error && /Failed to fetch|fetch/i.test(error.message)) {
      throw new Error("Topic duplicate checking is temporarily unavailable. Please try again later.");
    }
    throw error;
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
  if (semanticResult.status === "rejected" && textItems.length === 0) {
    throw semanticResult.reason;
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
    .map((item) => ({ item, ...getSearchMatch(query, item) }))
    .filter(({ relevant }) => relevant)
    .sort((left, right) => right.confidence - left.confidence)
    .slice(0, 30)
    .map(({ item, confidence }) => ({ ...item, matchConfidence: confidence }));
}

function getSearchMatch(query, item) {
  const normalizedQuery = normalizeSearchText(query);
  const tokens = normalizedQuery
    .split(" ")
    .filter((token) => token.length > 1 && !SEARCH_STOP_WORDS.has(token));
  const fields = [
    normalizeSearchText(item.title),
    normalizeSearchText(item.abstract),
    normalizeSearchText(Array.isArray(item.keywords) ? item.keywords.join(" ") : ""),
    normalizeSearchText(item.ocr_raw_text),
  ].filter(Boolean);
  const exactPhraseMatch = normalizedQuery.length > 2 && fields.some((field) => field.includes(normalizedQuery));
  const matchedTokens = tokens.filter((token) => fields.some((field) => field.split(" ").includes(token)));
  const termCoverage = tokens.length ? matchedTokens.length / tokens.length : 0;
  const semanticSimilarity = Math.min(1, Math.max(0, Number(item.similarity) || 0));
  const confidence = exactPhraseMatch
    ? 100
    : Math.round(Math.max(termCoverage, semanticSimilarity) * 100);
  const requiredMatches = Math.min(2, tokens.length);
  const relevant = exactPhraseMatch
    || semanticSimilarity >= MIN_SEMANTIC_SIMILARITY
    || (requiredMatches > 0 && matchedTokens.length >= requiredMatches && confidence >= MIN_MATCH_CONFIDENCE);

  return { confidence, relevant };
}

function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}
