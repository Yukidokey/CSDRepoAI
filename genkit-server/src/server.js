import "dotenv/config";
import express from "express";
import cors from "cors";
import { semanticSearchFlow } from "./flows/semanticSearch.js";
import { embedPaperFlow } from "./flows/embedPaper.js";
import { metadataAnalysisFlow } from "./flows/metadataAnalysis.js";
import { extractMetadataFlow } from "./flows/extractMetadata.js";
import { supabaseAdmin } from "./supabaseAdmin.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));
const DUPLICATE_SIMILARITY_THRESHOLD = 0.92;

/**
 * POST /search
 * Body: { query, sdgFilter?, statusFilter? }
 * Matches the shape src/services/search.js already sends when
 * VITE_GENKIT_SEARCH_URL is configured on the frontend.
 */
app.post("/search", async (req, res) => {
  const { query, sdgFilter, statusFilter } = req.body || {};

  if (!query || !query.trim()) {
    return res.status(400).json({ error: "query is required" });
  }

  try {
    const result = await semanticSearchFlow({
      query,
      sdgFilter: sdgFilter ?? null,
      statusFilter: statusFilter ?? "approved",
    });
    res.json(result);
  } catch (error) {
    console.error("[genkit] /search failed:", error);
    res.status(500).json({ error: error.message || "semantic search failed" });
  }
});

/**
 * POST /check-duplicate
 * Compares title-independent manuscript context with embeddings for all submissions.
 * Returns only a boolean so unpublished paper details are not exposed.
 */
app.post("/check-duplicate", async (req, res) => {
  const { abstract, keywords, documentText, excludePaperId } = req.body || {};
  const metadataQuery = [
    String(abstract || "").trim(),
    Array.isArray(keywords) ? keywords.join(", ") : String(keywords || "").trim(),
  ].filter(Boolean).join("\n\n");
  const query = metadataQuery || String(documentText || "").slice(0, 5000).trim();

  if (!query) {
    return res.status(400).json({ error: "manuscript context is required" });
  }

  try {
    const { count: unindexedCount, error: indexError } = await supabaseAdmin
      .from("research_papers")
      .select("id", { count: "exact", head: true })
      .is("embedding", null);

    if (indexError) throw indexError;
    if (unindexedCount > 0) {
      return res.status(503).json({ error: "similarity index is incomplete" });
    }

    const result = await semanticSearchFlow({
      query,
      statusFilter: null,
      matchCount: 100,
    });
    const duplicate = result.items.some(
      (item) => item.id !== excludePaperId && Number(item.similarity) >= DUPLICATE_SIMILARITY_THRESHOLD
    );
    res.json({ duplicate });
  } catch (error) {
    console.error("[genkit] /check-duplicate failed:", error);
    res.status(500).json({ error: "manuscript similarity check failed" });
  }
});

/**
 * POST /embed
 * Body: { paperId }
 * Called by the frontend (fire-and-forget) right after a paper is
 * submitted, so it becomes semantically searchable without a manual
 * reindex step.
 */
app.post("/embed", async (req, res) => {
  const { paperId } = req.body || {};

  if (!paperId) {
    return res.status(400).json({ error: "paperId is required" });
  }

  try {
    const result = await embedPaperFlow({ paperId });
    res.json(result);
  } catch (error) {
    console.error("[genkit] /embed failed:", error);
    res.status(500).json({ error: error.message || "embedding failed" });
  }
});

/**
 * POST /metadata
 * Body: { title, abstract, keywords, text }
 * Uses Google Genkit + Gemini to generate research metadata for the
 * student submission flow. Falls back to the existing local heuristic
 * analysis if the Genkit endpoint is unavailable.
 */
app.post("/metadata", async (req, res) => {
  const { title, abstract, keywords, text } = req.body || {};

  if (!text || !text.trim()) {
    return res.status(400).json({ error: "text is required" });
  }

  try {
    const result = await metadataAnalysisFlow({
      title: title || "",
      abstract: abstract || "",
      keywords: keywords || "",
      text,
    });
    res.json(result);
  } catch (error) {
    console.error("[genkit] /metadata failed:", error);
    res.status(500).json({ error: error.message || "metadata analysis failed" });
  }
});

app.post("/extract-metadata", async (req, res) => {
  const { documentText } = req.body || {};

  if (!documentText || !documentText.trim()) {
    return res.status(400).json({ error: "documentText is required" });
  }

  try {
    const result = await extractMetadataFlow({ documentText });
    res.json(result);
  } catch (error) {
    console.error("[genkit] /extract-metadata failed:", error);
    res.status(500).json({ error: error.message || "metadata extraction failed" });
  }
});

app.get("/health", (_req, res) => res.json({ ok: true }));

if (!process.env.VERCEL) {
  const port = process.env.PORT || 8787;
  app.listen(port, () => {
    console.log(`[genkit] CSDRepoAI semantic search server listening on http://localhost:${port}`);
    console.log(`[genkit] Point the frontend at it via VITE_GENKIT_SEARCH_URL=http://localhost:${port}/search`);
  });
}

export default app;
