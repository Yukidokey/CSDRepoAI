import "dotenv/config";
import express from "express";
import cors from "cors";
import { semanticSearchFlow } from "./flows/semanticSearch.js";
import { embedPaperFlow } from "./flows/embedPaper.js";
import { metadataAnalysisFlow } from "./flows/metadataAnalysis.js";
import { extractMetadataFlow } from "./flows/extractMetadata.js";
import { supabaseAdmin } from "./supabaseAdmin.js";

const app = express();
const allowedOrigins = [
  "https://csd-repo-ai.vercel.app",
  "https://csd-repo-ai-semantic.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:8787",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:8787",
];

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || /^https?:\/\/localhost(?::\d+)?$/.test(origin) || /^https?:\/\/127\.0\.0\.1(?::\d+)?$/.test(origin)) {
      callback(null, true);
      return;
    }
    callback(null, false);
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  credentials: true,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json({ limit: "1mb" }));
const DUPLICATE_SIMILARITY_THRESHOLD = 0.92;
const DUPLICATE_STOP_WORDS = new Set([
  "about", "after", "also", "among", "and", "are", "based", "been", "between", "both", "can", "could",
  "each", "for", "from", "have", "into", "its", "more", "most", "not", "our", "over", "research", "study",
  "such", "than", "that", "the", "their", "these", "this", "through", "using", "was", "were", "with", "within",
]);

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

    const candidates = result.items
      .filter((item) => item.id !== excludePaperId && Number(item.similarity) >= DUPLICATE_SIMILARITY_THRESHOLD)
      .slice(0, 12);

    if (!candidates.length) return res.json({ duplicate: false });

    const { data: candidateDocuments, error: candidateError } = await supabaseAdmin
      .from("research_papers")
      .select("id, ocr_raw_text")
      .in("id", candidates.map((item) => item.id));

    if (candidateError) throw candidateError;
    const documentTextById = new Map((candidateDocuments || []).map((paper) => [paper.id, paper.ocr_raw_text || ""]));
    const metadataContext = [abstract, Array.isArray(keywords) ? keywords.join(" ") : keywords]
      .filter(Boolean)
      .join(" ");
    const duplicate = candidates.some((item) => {
      const candidateMetadata = [item.title, item.abstract, ...(item.keywords || [])].filter(Boolean).join(" ");
      const documentOverlap = getContentOverlap(documentText, documentTextById.get(item.id));
      const metadataOverlap = getContentOverlap(metadataContext, candidateMetadata);
      return documentOverlap >= 0.35 || metadataOverlap >= 0.75;
    });

    res.json({ duplicate });
  } catch (error) {
    console.error("[genkit] /check-duplicate failed:", error);
    res.status(500).json({ error: "manuscript similarity check failed" });
  }
});

function getContentOverlap(left, right) {
  const leftTerms = getContentTerms(left);
  const rightTerms = getContentTerms(right);
  const smallestSetSize = Math.min(leftTerms.size, rightTerms.size);
  if (smallestSetSize < 10) return 0;

  let sharedTerms = 0;
  for (const term of leftTerms) {
    if (rightTerms.has(term)) sharedTerms += 1;
  }
  return sharedTerms / smallestSetSize;
}

function getContentTerms(text) {
  return new Set(
    String(text || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .split(/[^a-z0-9]+/)
      .filter((term) => term.length > 3 && !DUPLICATE_STOP_WORDS.has(term))
  );
}

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
