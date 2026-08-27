import "dotenv/config";
import express from "express";
import cors from "cors";
import { semanticSearchFlow } from "./flows/semanticSearch.js";
import { embedPaperFlow } from "./flows/embedPaper.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

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

app.get("/health", (_req, res) => res.json({ ok: true }));

const port = process.env.PORT || 8787;
app.listen(port, () => {
  console.log(`[genkit] CSDRepoAI semantic search server listening on http://localhost:${port}`);
  console.log(`[genkit] Point the frontend at it via VITE_GENKIT_SEARCH_URL=http://localhost:${port}/search`);
});
