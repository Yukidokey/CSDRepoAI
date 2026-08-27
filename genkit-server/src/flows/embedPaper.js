import { z } from "genkit";
import { ai, embedder, embedOptions } from "../genkit.config.js";
import { supabaseAdmin } from "../supabaseAdmin.js";
import { extractEmbeddingValues, toVectorLiteral } from "../embeddingUtils.js";

/** Builds the text blob that gets embedded for a paper. Mirrors the
 *  fields already weighted into the Postgres full-text `search_vector`
 *  column, so semantic and keyword search stay conceptually aligned. */
function buildEmbeddingText(paper) {
  return [
    paper.title,
    paper.abstract,
    (paper.keywords || []).join(", "),
    (paper.authors || []).join(", "),
    paper.program,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export const embedPaperFlow = ai.defineFlow(
  {
    name: "embedPaper",
    inputSchema: z.object({ paperId: z.string().uuid() }),
    outputSchema: z.object({ paperId: z.string(), embedded: z.boolean() }),
  },
  async ({ paperId }) => {
    const { data: paper, error } = await supabaseAdmin
      .from("research_papers")
      .select("id, title, abstract, keywords, authors, program")
      .eq("id", paperId)
      .single();

    if (error || !paper) {
      throw new Error(`Paper ${paperId} not found: ${error?.message || "no row"}`);
    }

    const text = buildEmbeddingText(paper);
    if (!text.trim()) {
      return { paperId, embedded: false };
    }

    const rawEmbedding = await ai.embed({ embedder, content: text, options: embedOptions });
    const embedding = toVectorLiteral(extractEmbeddingValues(rawEmbedding));

    const { error: updateError } = await supabaseAdmin
      .from("research_papers")
      .update({ embedding })
      .eq("id", paperId);

    if (updateError) throw updateError;

    return { paperId, embedded: true };
  }
);

export { buildEmbeddingText };
