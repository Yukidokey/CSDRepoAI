import { z } from "genkit";
import { googleAI } from "@genkit-ai/google-genai";
import { ai } from "../genkit.config.js";

const outputSchema = z.object({
  title: z.string(),
  authors: z.array(z.string()),
  adviser: z.string(),
  abstract: z.string(),
  keywords: z.array(z.string()),
});

export const extractMetadataFlow = ai.defineFlow(
  {
    name: "extractMetadata",
    inputSchema: z.object({ documentText: z.string().min(1) }),
    outputSchema,
  },
  async ({ documentText }) => {
    const safeDocumentText = documentText.slice(0, 12000);
    const prompt = `You are extracting metadata from a Philippine university thesis or capstone document.

These documents follow a consistent structural convention that does NOT use explicit field labels for most fields. Identify fields by their position and role, not by searching for labels such as "Title:" or "Author:".

Structural conventions to expect:

TITLE PAGE (usually page 1):
- The title appears as the first large block of text, often spanning 2-4 lines, with no "Title:" label preceding it.
- Immediately below the title, one or more author names appear, each typically on its own line, with NO "By:" or "Author(s):" prefix.
- Below the authors, the university name and degree program usually appear.
- An adviser's name sometimes appears near the bottom of this page, also unlabeled — but do not treat this as fully reliable; the Approval Sheet is the authoritative source for adviser identity.

APPROVAL SHEET (usually page 2, titled "Approval Sheet"):
- This page lists names followed immediately below (or beside) each name by a role caption, not a label before the name. Look for this exact pattern: a person's name on one line, and the words "Thesis Adviser" on the line directly after it — that name is the adviser.
- Similarly, a name followed by "Panel Chair" or "Panel Member" identifies committee members — do NOT confuse these with the adviser.

ABSTRACT:
- Usually appears on its own page headed by the standalone word "Abstract" (no colon). The abstract text follows as one or more paragraphs.
- Immediately after the abstract paragraph(s), a line beginning with "Keywords:" lists the keywords, typically separated by semicolons.

Given the document text below, extract exactly these fields and return ONLY valid JSON matching this shape:
{
  "title": string,
  "authors": string[],
  "adviser": string,
  "abstract": string,
  "keywords": string[]
}

Rules:
- "adviser" must come from the Approval Sheet's "Thesis Adviser" caption if present anywhere in the text — do not guess from the title page alone if the Approval Sheet is available.
- Do not include panel chair or panel members in "authors" or "adviser" — they are separate roles.
- "authors" should only include the names credited as the researchers/writers of the thesis, listed on the title page — not the adviser, panel, or dean.
- If a field cannot be confidently identified, return an empty string (or empty array for authors/keywords) rather than guessing.
- Split "keywords" on semicolons or commas into an array of individual terms.
- Ignore headers, footers, page numbers, repeated boilerplate, and running text that is not part of the document metadata.
- Output ONLY valid JSON with no commentary.

Document text:
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
      adviser: String(parsed.adviser || "").trim(),
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
