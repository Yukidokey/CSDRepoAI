import { z } from "genkit";
import { googleAI } from "@genkit-ai/google-genai";
import { ai } from "../genkit.config.js";

const outputSchema = z.object({
  title: z.string(),
  authors: z.array(z.string()),
  adviser: z.string().nullable(),
  abstract: z.string(),
  keywords: z.array(z.string()),
});

export const extractMetadataFlow = ai.defineFlow(
  {
    name: "extractMetadata",
    inputSchema: z.object({ documentText: z.string() }),
    outputSchema,
  },
  async ({ documentText }) => {
    const safeDocumentText = documentText.slice(0, 12000);
    const prompt = `You are an academic document parser.

Your job is to read the raw extracted text of a thesis, research paper, or manuscript and identify the actual metadata.

Return JSON with exactly these keys:
- title: the real document title, not a running header/footer
- authors: the full list of student authors as an array of strings
- adviser: the adviser's name if it is explicitly mentioned; otherwise null
- abstract: a concise abstract based on the paper's own abstract if present, otherwise a summary of the introduction in roughly 150 words
- keywords: 5-8 relevant keywords or key phrases

Important rules:
- Do not guess the adviser if the name is not clearly present in the text.
- Prefer the paper's own title and abstract when available.
- Ignore headers, footers, page numbers, and repeated boilerplate.
- Output valid JSON only.

Raw manuscript text:
${safeDocumentText}`;

    const response = await ai.generate({
      model: googleAI.model("gemini-2.0-flash"),
      prompt,
      output: { schema: outputSchema },
      config: {
        temperature: 0.2,
      },
    });

    const parsed = response.output ?? (typeof response.text === "string" ? JSON.parse(response.text) : null);

    if (!parsed) {
      throw new Error("Gemini metadata extraction returned no structured output.");
    }

    return {
      title: String(parsed.title || "").trim(),
      authors: Array.isArray(parsed.authors)
        ? parsed.authors.map((author) => String(author).trim()).filter(Boolean)
        : [],
      adviser:
        parsed.adviser === null || parsed.adviser === undefined
          ? null
          : String(parsed.adviser).trim() || null,
      abstract: String(parsed.abstract || "").trim(),
      keywords: Array.isArray(parsed.keywords)
        ? parsed.keywords.map((keyword) => String(keyword).trim()).filter(Boolean).slice(0, 8)
        : [],
    };
  }
);

export async function extractMetadata(documentText) {
  return extractMetadataFlow({ documentText });
}
