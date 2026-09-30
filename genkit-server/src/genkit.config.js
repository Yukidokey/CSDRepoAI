import "dotenv/config";
import { genkit } from "genkit";
import { logger } from "genkit/logging";
import { googleAI } from "@genkit-ai/google-genai";

// Genkit captures flow traces automatically. Keep verbose logs enabled for
// local diagnosis, while allowing deployments to choose a quieter level.
logger.setLogLevel(process.env.GENKIT_LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug"));

if (!process.env.GOOGLE_GENAI_API_KEY) {
  console.warn(
    "[genkit] GOOGLE_GENAI_API_KEY is not set. Copy .env.example to .env and add your Google AI Studio key."
  );
}

// Single shared Genkit instance for the whole server.
export const ai = genkit({
  plugins: [googleAI()],
});

// gemini-embedding-001 defaults to 3072 dimensions; we request a 768-dim
// output to match the `vector(768)` column in supabase/schema.sql. Pass
// this same { outputDimensionality: 768 } object wherever ai.embed() is
// called (see flows/embedPaper.js and flows/semanticSearch.js).
export const embedder = googleAI.embedder("gemini-embedding-001");
export const embedOptions = { outputDimensionality: 768 };

