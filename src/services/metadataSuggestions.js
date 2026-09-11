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

  const metadata = await maybeAnalyzeWithGenkit({
    title: extracted.title,
    abstract,
    keywords: extracted.keywords,
    text: documentText,
  });

  return {
    title: extracted.title,
    authors: extracted.authors,
    adviser: extracted.adviser,
    keywords: extracted.keywords || metadata.keywords.join(", "),
    abstract,
    category: metadata.category,
    sdgTags: metadata.sdgTags,
    sdgNames: metadata.sdgNames,
    extractedText: documentText,
    sourceTextLength: documentText.length,
  };
}

export async function analyzeResearchDocumentWithAI(file) {
  if (!file) return null;

  const documentText = isDocx(file) ? await extractDocxText(file) : await extractPdfText(file);
  const extracted = extractDocumentFields(documentText);
  const abstract = extracted.abstract || buildAbstract(documentText, extracted.title);

  if (!GENKIT_METADATA_URL) {
    return analyzeResearchDocument(file);
  }

  const aiMetadata = await extractMetadataWithAI(documentText);

  if (!aiMetadata) {
    return analyzeResearchDocument(file);
  }

  const aiKeywords = Array.isArray(aiMetadata.keywords)
    ? aiMetadata.keywords.join(", ")
    : String(aiMetadata.keywords || extracted.keywords || "").trim();

  const aiSuggestions = suggestMetadata({
    title: aiMetadata.title || extracted.title,
    abstract: aiMetadata.abstract || abstract,
    keywords: aiKeywords,
  });

  return {
    title: aiMetadata.title || extracted.title,
    authors: Array.isArray(aiMetadata.authors) && aiMetadata.authors.length
      ? aiMetadata.authors.join(", ")
      : extracted.authors.join(", "),
    adviser: aiMetadata.adviser || extracted.adviser,
    keywords: aiKeywords || extracted.keywords,
    abstract: aiMetadata.abstract || abstract,
    category: aiSuggestions.category,
    sdgTags: aiSuggestions.sdgTags,
    sdgNames: aiSuggestions.sdgNames,
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

  const joined = lines
    .sort((a, b) => b.y - a.y)
    .map((line) => line.items.sort((a, b) => a.x - b.x).map((item) => item.text).join(" "))
    .join("\n");

  return collapseHyphenSpacing(joined);
}

function collapseHyphenSpacing(text) {
  return text.replace(/(\w)\s*[-–—]\s*(\w)/g, "$1-$2");
}

function isDocx(file) {
  return file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || /\.docx$/i.test(file.name);
}

export function extractDocumentFields(text) {
  if (!text) return { title: "", abstract: "", keywords: "", authors: [], adviser: "" };

  const lines = text.split("\n").map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
  const abstractIndex = lines.findIndex((line) => /^abstract\b\s*[:\-]?/i.test(line));
  const keywordsIndex = lines.findIndex((line) => /^keywords?\s*[:\-]?/i.test(line));
  const titleLabel = lines.find((line) => /^title\s*[:\-]/i.test(line));
  const abstract = extractSection(lines, abstractIndex, ["keywords?", "introduction", "chapter", "table of contents"]);
  const keywordsLine = extractKeywords(lines, keywordsIndex);
  const title = firstPageTitle(lines) || (titleLabel
    ? titleLabel.replace(/^title\s*[:\-]?\s*/i, "").trim()
    : "");
  const authors = extractAuthors(lines);
  const adviser = extractAdviser(lines);

  return {
    title,
    authors,
    adviser,
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

  for (let index = startIndex + 1; index < lines.length && index <= startIndex + 3; index += 1) {
    const line = lines[index];
    if (isDocumentHeading(line) || /^abstract\b/i.test(line)) break;
    values.push(line);
  }

  return values.join(" ").replace(/[.;]+$/, "").replace(/\s+/g, " ").trim();
}

function isDocumentHeading(line) {
  return /^(introduction|background|methodology|methods?|results?|discussion|conclusion|references?|chapter|table of contents|acknowledgement|approval sheet|dedication)\b/i.test(line);
}

function firstPageTitle(lines) {
  const titleLines = [];

  for (let index = 0; index < lines.length && index < 8; index += 1) {
    const line = lines[index].replace(/^(title\s*[:\-]?\s*)/i, "").trim();
    if (!line) continue;
    if (/^(abstract|keywords?)\b/i.test(line)) break;
    if (line.length > 90) break;

    titleLines.push(line);
  }

  return titleLines.join(" ").replace(/\s+/g, " ").trim();
}

function extractAuthors(lines) {
  const universityIndex = lines.findIndex((line) => /(university|college|institute|campus)/i.test(line));
  if (universityIndex <= 0) return [];

  const authors = [];
  for (let index = universityIndex - 1; index >= 0; index -= 1) {
    const line = lines[index];

    if (!line || line.length > 60) break;
    if (/^(abstract|keywords?|approval sheet|thesis adviser|panel chair|panel member|acknowledgement|dedication|chapter)\b/i.test(line)) break;
    if (/(university|college|institute|campus|bachelor|bs\b|bsc\b|computer science|information technology|year|month|date)/i.test(line)) {
      continue;
    }
    if (!isLikelyAuthorLine(line)) {
      continue;
    }

    authors.unshift(line.trim());
    if (authors.length >= 3) break;
  }

  return authors;
}

function extractAdviser(lines) {
  for (let index = 0; index < lines.length - 1; index += 1) {
    const line = lines[index];
    const nextLine = lines[index + 1];

    if (line && /^thesis adviser$/i.test(nextLine || "")) {
      return line.trim();
    }
  }

  return "";
}

function isLikelyAuthorLine(line) {
  if (!line || line.length > 50) return false;
  if (/(university|college|institute|campus|bachelor|bs\b|bsc\b|computer science|information technology)/i.test(line)) {
    return false;
  }

  const words = line.split(/\s+/).filter(Boolean);
  return words.length >= 2 && words.length <= 6;
}

function isLikelyAuthorOrInstitutionLine(line) {
  if (!line) return false;
  if (/(university|college|institute|campus|bachelor|bs\b|bsc\b|computer science|information technology)/i.test(line)) {
    return true;
  }

  const words = line.split(/\s+/).filter(Boolean);
  return line.length <= 55 && words.length <= 5;
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