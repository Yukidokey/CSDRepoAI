import { supabase } from "../lib/supabaseClient";

const GENKIT_SEARCH_URL = import.meta.env.VITE_GENKIT_SEARCH_URL;

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

  if (GENKIT_SEARCH_URL) {
    try {
      const response = await fetch(GENKIT_SEARCH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: normalizedQuery,
          sdgFilter,
          statusFilter,
        }),
      });

      if (response.ok) {
        const payload = await response.json();
        const items = payload.items || payload.results || payload.data || payload.searchResults;

        if (Array.isArray(items) && items.length > 0) {
          return items;
        }
      }
    } catch (error) {
      console.warn("Genkit semantic search unavailable, using fallback text search.", error);
    }
  }

  let request = supabase
    .from("research_papers")
    .select("*")
    .textSearch("search_vector", formatQuery(normalizedQuery), {
      type: "websearch",
      config: "english",
    });

  if (statusFilter) request = request.eq("status", statusFilter);
  if (sdgFilter) request = request.contains("sdg_tags", [sdgFilter]);

  const { data, error } = await request.limit(30);
  if (error) throw error;
  return data;
}

function formatQuery(raw) {
  // websearch_to_tsquery handles natural phrasing like "AI search for thesis papers"
  return raw.trim();
}
