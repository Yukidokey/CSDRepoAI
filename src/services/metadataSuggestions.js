import { SDG_LIST } from "../lib/sdgList";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import mammoth from "mammoth/mammoth.browser";

const GENKIT_METADATA_URL = import.meta.env.VITE_GENKIT_METADATA_URL;

export async function extractMetadataWithAI(documentText) {
  if (!GENKIT_METADATA_URL) {
    return null;
  }

  try {
    const response = await fetch(GENKIT_METADATA_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ documentText }),
    });

    if (!response.ok) {
      throw new Error(`metadata extraction request failed (${response.status})`);
    }

    return await response.json();
  } catch (error) {
    console.warn("Genkit semantic search unavailable, using fallback text search.", error);
    return null;
  }
}

GlobalWorkerOptions.workerSrc = workerSrc;

const TOPIC_RULES = [
  { category: "Artificial Intelligence", terms: ["artificial intelligence", "machine learning", "deep learning", "neural network", "chatbot", "computer vision", "natural language"] },
  { category: "Information Systems", terms: ["information system", "management system", "information management", "record system", "database"] },
  { category: "Education Technology", terms: ["learning", "education", "student", "school", "teaching", "academic"] },
  { category: "Health Technology", terms: ["health", "medical", "hospital", "clinic", "disease", "patient"] },
  { category: "Cybersecurity", terms: ["cybersecurity", "cyber security", "privacy", "encryption", "malware", "phishing", "security"] },
  { category: "Web and Mobile Development", terms: ["web", "website", "mobile", "android", "ios", "application", "app"] },
  { category: "Data and Analytics", terms: ["data", "analytics", "prediction", "forecast", "classification", "survey"] },
];

const SDG_RULES = [
  { id: 3, terms: ["health", "medical", "hospital", "clinic", "patient", "disease"] },
  { id: 4, terms: ["education", "learning", "student", "school", "teaching", "academic"] },
  { id: 8, terms: ["employment", "work", "business", "entrepreneur", "livelihood", "productivity"] },
  { id: 9, terms: ["technology", "innovation", "infrastructure", "system", "software", "engineering"] },
  { id: 10, terms: ["inclusion", "accessibility", "inequality", "disability", "marginalized"] },
  { id: 11, terms: ["community", "city", "urban", "disaster", "transportation", "sustainable"] },
  { id: 12, terms: ["consumption", "waste", "recycling", "production", "resource"] },
  { id: 13, terms: ["climate", "environment", "carbon", "energy", "renewable", "pollution"] },
];

function normalize(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g, " ");
}

function matches(text, terms) {
  return terms.some((term) => text.includes(term));
}

export function suggestMetadata({ title = "", abstract = "", keywords = "" }) {
  const source = normalize(`${title} ${abstract} ${keywords}`);
  const topicMatches = TOPIC_RULES.filter((rule) => matches(source, rule.terms));
  const suggestedKeywords = [...new Set(
    topicMatches.flatMap((rule) => rule.terms.filter((term) => source.includes(term)))
  )].slice(0, 8);
  const suggestedSdgs = SDG_RULES.filter((rule) => matches(source, rule.terms)).map((rule) => rule.id);
  const category = topicMatches[0]?.category || "Computer Studies";

  return {
    category,
    keywords: suggestedKeywords,
    sdgTags: suggestedSdgs,
    sdgNames: suggestedSdgs.map((id) => SDG_LIST.find((sdg) => sdg.id === id)?.title).filter(Boolean),
  };
}

export async function analyzeResearchDocument(file) {
  if (!file) return null;

  const documentText = isDocx(file) ? await extractDocxText(file) : await extractPdfText(file);
  const extracted = extractDocumentFields(documentText);
  const abstract = extracted.abstract || buildAbstract(documentText, extracted.title);

  const aiMetadata = await extractMetadataWithAI(documentText);

  if (aiMetadata) {
    return {
      title: aiMetadata.title || extracted.title,
      authors: Array.isArray(aiMetadata.authors) ? aiMetadata.authors.join(", ") : "",
      adviser: aiMetadata.adviser || "",
      keywords: Array.isArray(aiMetadata.keywords) ? aiMetadata.keywords.join(", ") : extracted.keywords,
      abstract: aiMetadata.abstract || abstract,
      category: "Computer Studies",
      sdgTags: [],
      sdgNames: [],
      extractedText: documentText,
      sourceTextLength: documentText.length,
    };
  }

  const metadata = await maybeAnalyzeWithGenkit({
    title: extracted.title,
    abstract,
    keywords: extracted.keywords,
    text: documentText,
  });

  return {
    title: extracted.title,
    authors: "",
    adviser: "",
    keywords: extracted.keywords || metadata.keywords.join(", "),
    abstract,
    category: metadata.category,
    sdgTags: metadata.sdgTags,
    sdgNames: metadata.sdgNames,
    extractedText: documentText,
    sourceTextLength: documentText.length,
  };
}

async function maybeAnalyzeWithGenkit({ title, abstract, keywords, text }) {
  if (!GENKIT_METADATA_URL) {
    return suggestMetadata({ title, abstract, keywords });
  }

  try {
    const response = await fetch(GENKIT_METADATA_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title, abstract, keywords, text }),
    });

    if (!response.ok) {
      throw new Error(`metadata analysis request failed (${response.status})`);
    }

    const payload = await response.json();
    return normalizeMetadataPayload(payload);
  } catch (error) {
    console.warn("Google Genkit metadata analysis unavailable, using local heuristic analysis.", error);
    return suggestMetadata({ title, abstract, keywords });
  }
}

function normalizeMetadataPayload(payload) {
  const fallback = suggestMetadata({ title: payload?.title || "", abstract: payload?.abstract || "", keywords: payload?.keywords || "" });

  return {
    category: String(payload?.category || fallback.category).trim() || fallback.category,
    keywords: Array.isArray(payload?.keywords)
      ? payload.keywords.map((keyword) => String(keyword).trim()).filter(Boolean).slice(0, 8)
      : fallback.keywords,
    sdgTags: Array.isArray(payload?.sdgTags)
      ? payload.sdgTags.map((tag) => Number(tag)).filter((tag) => Number.isInteger(tag))
      : fallback.sdgTags,
    sdgNames: Array.isArray(payload?.sdgNames)
      ? payload.sdgNames.map((name) => String(name).trim()).filter(Boolean)
      : fallback.sdgNames,
  };
}

async function extractPdfText(file) {
  const data = await file.arrayBuffer();
  const pdf = await getDocument({ data }).promise;
  const pages = [];
  const pageLimit = Math.min(pdf.numPages, 8);

  for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(joinPdfTextItems(content.items));
  }

  return pages.join("\n\n").trim();
}

async function extractDocxText(file) {
  const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return value.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
}

function joinPdfTextItems(items) {
  const lines = [];
  for (const item of items) {
    const text = item.str?.trim();
    if (!text) continue;
    const y = item.transform?.[5] ?? 0;
    const line = lines.find((candidate) => Math.abs(candidate.y - y) < 3);
    if (line) {
      line.items.push({ x: item.transform?.[4] ?? 0, text });
    } else {
      lines.push({ y, items: [{ x: item.transform?.[4] ?? 0, text }] });
    }
  }
  return lines
    .sort((a, b) => b.y - a.y)
    .map((line) => line.items.sort((a, b) => a.x - b.x).map((item) => item.text).join(" "))
    .join("\n");
}

function isDocx(file) {
  return file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || /\.docx$/i.test(file.name);
}

function extractDocumentFields(text) {
  if (!text) return { title: "", abstract: "", keywords: "" };

  const lines = text.split("\n").map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
  const abstractIndex = lines.findIndex((line) => /^abstract\b\s*[:\-]?/i.test(line));
  const keywordsIndex = lines.findIndex((line) => /^keywords?\s*[:\-]?/i.test(line));
  const titleLabel = lines.find((line) => /^title\s*[:\-]/i.test(line));
  const abstract = extractSection(lines, abstractIndex, ["keywords?", "introduction", "chapter", "table of contents"]);
  const keywordsLine = extractKeywords(lines, keywordsIndex);
  const title = firstPageTitle(lines) || (titleLabel
    ? titleLabel.replace(/^title\s*[:\-]?\s*/i, "").trim()
    : "");

  return {
    title,
    abstract,
    keywords: keywordsLine.replace(/[.;]+$/, "").trim(),
  };
}

function extractSection(lines, startIndex, stopPatterns) {
  if (startIndex < 0) return "";
  const content = [];
  for (let index = startIndex; index < lines.length; index += 1) {
    if (index === startIndex) {
      const inline = lines[index].replace(/^(abstract|keywords?)\s*[:\-]?\s*/i, "");
      if (inline) content.push(inline);
      continue;
    }
    if (stopPatterns.some((pattern) => new RegExp(`^${pattern}\\b`, "i").test(lines[index]))) break;
    content.push(lines[index]);
  }
  return content.join(" ").replace(/\s+/g, " ").trim();
}

function extractKeywords(lines, startIndex) {
  if (startIndex < 0) return "";

  const values = [];
  const firstValue = lines[startIndex].replace(/^keywords?\s*[:\-]?\s*/i, "").trim();
  if (firstValue) values.push(firstValue);

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (isDocumentHeading(line) || /^abstract\b/i.test(line)) break;
    values.push(line);
  }

  return values.join(" ").replace(/[.;]+$/, "").replace(/\s+/g, " ").trim();
}

function isDocumentHeading(line) {
  return /^(introduction|background|methodology|methods?|results?|discussion|conclusion|references?|chapter|table of contents)\b/i.test(line);
}

function firstPageTitle(lines) {
  const firstLine = lines[0] || "";
  if (!firstLine || /^(abstract|keywords?)\b/i.test(firstLine)) return "";
  return firstLine
    .replace(/^(title\s*[:\-]?\s*)/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildAbstract(text, title = "") {
  const withoutTitle = title ? text.replace(title, " ") : text;
  const sentences = withoutTitle.match(/[^.!?]+[.!?]+/g) || [];
  return sentences
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 35)
    .slice(0, 3)
    .join(" ")
    .slice(0, 900);
}