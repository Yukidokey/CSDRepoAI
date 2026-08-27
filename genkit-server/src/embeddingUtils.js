/** ai.embed() returns an array of result objects, e.g. [{ embedding: [...] }]
 *  — this pulls out the actual number array from that shape. */
export function extractEmbeddingValues(embedResult) {
  const first = Array.isArray(embedResult) ? embedResult[0] : embedResult;
  const values = first?.embedding ?? first;

  if (!Array.isArray(values) || typeof values[0] !== "number") {
    throw new Error(
      `Unexpected embedding result shape: ${JSON.stringify(embedResult).slice(0, 200)}`
    );
  }
  return values;
}

/** pgvector expects text input like "[0.1,0.2,0.3]" (square brackets, no
 *  spaces) — a plain JS array gets serialized by supabase-js as a
 *  Postgres array literal ("{...}") instead, which pgvector rejects. */
export function toVectorLiteral(values) {
  return `[${values.join(",")}]`;
}
