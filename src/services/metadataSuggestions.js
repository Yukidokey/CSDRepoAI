import { SDG_LIST } from "../lib/sdgList.js";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import mammoth from "mammoth/mammoth.browser.js";

const viteEnv = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};
const GENKIT_METADATA_URL = viteEnv.VITE_GENKIT_METADATA_URL;

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

async function configurePdfWorker() {
  if (typeof window === "undefined" && typeof document === "undefined") {
    return;
  }

  try {
    const workerModule = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    const workerSrc = workerModule.default || workerModule;
    GlobalWorkerOptions.workerSrc = workerSrc;
  } catch {
    // Ignore in environments where the browser-only worker URL cannot be resolved.
  }
}

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
  await configurePdfWorker();
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
  const arrayBuffer = await file.arrayBuffer();
  const [{ value }, { value: html }] = await Promise.all([
    mammoth.extractRawText({ arrayBuffer }),
    mammoth.convertToHtml({ arrayBuffer }),
  ]);
  const boldLines = getBoldDocxParagraphs(html);
  const italicLines = getItalicDocxParagraphs(html);
  const rawLines = value.replace(/\r/g, "").split("\n");
  const lines = rawLines.map((line) => line.trim()).filter(Boolean);
  const markedLines = lines.map((line) => {
    if (boldLines.has(line)) return `__DOCX_BOLD__${line}`;
    if (italicLines.has(line)) return `__DOCX_ITALIC__${line}`;
    return line;
  });
  return markedLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function getBoldDocxParagraphs(html) {
  const boldLines = new Set();
  const paragraphs = html.match(/<p[\s\S]*?<\/p>/gi) || [];

  for (const paragraph of paragraphs) {
    if (!/<strong\b|<b\b/i.test(paragraph)) continue;
    const text = paragraph
      .replace(/<br\s*\/?\s*>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim();
    if (text) boldLines.add(text);
  }

  return boldLines;
}

function getItalicDocxParagraphs(html) {
  const italicLines = new Set();
  const paragraphs = html.match(/<p[\s\S]*?<\/p>/gi) || [];

  for (const paragraph of paragraphs) {
    if (!/<em\b|<i\b/i.test(paragraph)) continue;
    const text = paragraph
      .replace(/<br\s*\/?\s*>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim();
    if (text) italicLines.add(text);
  }

  return italicLines;
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
  const keywordsIndex = findKeywordsIndex(lines, abstractIndex);
  const titleLabel = lines.find((line) => /^title\s*[:\-]/i.test(cleanMetadataLine(line)));
  const abstract = extractSection(lines, abstractIndex, ["keywords?", "introduction", "chapter", "table of contents"]);
  const keywordsLine = extractKeywords(lines, keywordsIndex);
  const title = extractTitle(lines) || (titleLabel
    ? cleanMetadataLine(titleLabel).replace(/^title\s*[:\-]?\s*/i, "").trim()
    : "");
  const authors = extractAuthors(lines);
  const adviser = extractAdviser(lines);

  return {
    title,
    authors,
    adviser,
    abstract,
    keywords: cleanMetadataLine(keywordsLine).replace(/[.;]+$/, "").trim(),
  };
}

function extractTitle(lines) {
  const boldTitle = lines
    .slice(0, 12)
    .find((line) => line.startsWith("__DOCX_BOLD__") && !isDocumentHeading(cleanMetadataLine(line)));
  if (boldTitle) return cleanMetadataLine(boldTitle);

  const titleIndex = lines.findIndex((line) => /^title\s*[:\-]/i.test(cleanMetadataLine(line)));
  if (titleIndex >= 0) {
    const inlineTitle = cleanMetadataLine(lines[titleIndex]).replace(/^title\s*[:\-]?\s*/i, "").trim();
    if (inlineTitle) return inlineTitle;
    const nextTitleLine = cleanMetadataLine(lines[titleIndex + 1] || "");
    if (nextTitleLine && !isDocumentHeading(nextTitleLine)) return nextTitleLine;
  }

  const authorLabelIndex = lines.findIndex((line) => /^(authors?|researchers?|prepared by|by)\s*[:\-]?\s*/i.test(line));
  if (authorLabelIndex > 0) {
    const beforeAuthors = lines.slice(0, authorLabelIndex).filter((line) => !isPageMarkerLine(line));
    if (beforeAuthors.length > 0) return beforeAuthors.slice(-3).join(" ").trim();
  }

  return firstPageTitle(lines);
}

function extractSection(lines, startIndex, stopPatterns) {
  if (startIndex < 0) return "";
  const content = [];
  for (let index = startIndex; index < lines.length; index += 1) {
    if (index === startIndex) {
      const inline = cleanMetadataLine(lines[index]).replace(/^(abstract|keywords?)\s*[:\-]?\s*/i, "");
      if (inline) content.push(inline);
      continue;
    }
    const line = cleanMetadataLine(lines[index]);
    if (stopPatterns.some((pattern) => new RegExp(`^${pattern}\\b`, "i").test(line))) break;
    content.push(line);
  }
  return content.join(" ").replace(/\s+/g, " ").trim();
}

function extractKeywords(lines, startIndex) {
  if (startIndex < 0) return "";

  return cleanMetadataLine(lines[startIndex])
    .replace(/^\*?\s*keywords?\s*\*?\s*[:\-]?\s*/i, "")
    .replace(/\*+\s*$/, "")
    .replace(/[.;]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function findKeywordsIndex(lines, abstractIndex) {
  const startIndex = abstractIndex >= 0 ? abstractIndex + 1 : 0;
  const keywordPattern = /^\*?\s*keywords?\s*\*?\s*[:\-]/i;
  return lines.findIndex((line, index) => index >= startIndex && keywordPattern.test(cleanMetadataLine(line)));
}

function isDocumentHeading(line) {
  return /^(introduction|background|methodology|methods?|results?|discussion|conclusion|references?|chapter|table of contents|acknowledgement|approval sheet|dedication)\b/i.test(line);
}

function isPageMarkerLine(line) {
  return /^-{2,}\s*page\s*\d+\s*-{2,}$/i.test(line.trim());
}

function firstPageTitle(lines) {
  const titleLines = [];

  for (let index = 0; index < lines.length && index < 8; index += 1) {
    const line = cleanMetadataLine(lines[index]).replace(/^(title\s*[:\-]?\s*)/i, "").trim();
    if (!line) continue;
    if (isPageMarkerLine(line)) continue;
    if (/^(abstract|keywords?)\b/i.test(line)) break;
    if (isLikelyAuthorNameLine(line) || (isInstitutionLine(line) && !isAllCapsLine(line))) break;
    if (line.length > 90) break;

    titleLines.push(line);
  }

  return titleLines.join(" ").replace(/\s+/g, " ").trim();
}

function extractAuthors(lines) {
  const labeledAuthors = extractLabeledAuthors(lines);
  if (labeledAuthors.length > 0) return labeledAuthors;

  const titleIndex = lines.findIndex((line) => line.startsWith("__DOCX_BOLD__"));
  const universityIndex = lines.findIndex((line, index) => index > 0 && /\b(university|college|institute)\b/i.test(cleanMetadataLine(line)));
  const authorStart = titleIndex >= 0 ? titleIndex + 1 : 0;
  const searchEnd = universityIndex > 0 ? universityIndex : Math.min(lines.length, 12);

  const authors = [];
  for (let index = authorStart; index < searchEnd && authors.length < 4; index += 1) {
    const line = cleanMetadataLine(lines[index]);

    if (!line || line.length > 60) continue;
    if (/^(abstract|keywords?|approval sheet|thesis adviser|panel chair|panel member|acknowledgement|dedication|chapter)\b/i.test(line)) break;
    if (isInstitutionLine(line)) break;
    if (!isAuthorCandidate(line)) continue;

    authors.push(line.trim());
  }

  if (authors.length > 0) return authors;

  for (let index = searchEnd - 1; index >= 0 && authors.length < 4; index -= 1) {
    const line = cleanMetadataLine(lines[index]);
    if (isAuthorCandidate(line)) authors.unshift(line);
  }

  return authors;
}

function cleanMetadataLine(line) {
  return line.replace(/^__DOCX_(?:BOLD|ITALIC)__/, "").trim();
}

function extractLabeledAuthors(lines) {
  const authors = [];
  const labelPattern = /^(authors?|researchers?|prepared by|by)\s*[:\-]?\s*(.*)$/i;

  for (let index = 0; index < lines.length && index < 20; index += 1) {
    const match = lines[index].match(labelPattern);
    if (!match) continue;

    if (match[2].trim()) {
      authors.push(...splitPeople(match[2]));
    } else {
      for (let nextIndex = index + 1; nextIndex < lines.length && nextIndex < index + 7; nextIndex += 1) {
        const line = cleanMetadataLine(lines[nextIndex]);
        if (isInstitutionLine(line) || isDocumentHeading(line)) break;
        if (isAuthorCandidate(line)) authors.push(line);
      }
    }
    break;
  }

  return [...new Set(authors.map((author) => author.trim()).filter(Boolean))].slice(0, 6);
}

function splitPeople(value) {
  return value
    .split(/\s*(?:;|\||\band\b)\s*|\s*,\s*(?=[A-Z][a-z])/i)
    .map((author) => author.trim())
    .filter((author) => isLikelyAuthorNameLine(author));
}

function isAuthorCandidate(line) {
  const candidate = cleanMetadataLine(line);
  if (!candidate || candidate.length > 60 || isInstitutionLine(candidate)) return false;
  if (/^(abstract|keywords?|title|authors?|researchers?|prepared by|by|approval sheet|thesis adviser|panel chair|panel member|chapter|introduction|background|methodology|references?)\b/i.test(candidate)) {
    return false;
  }

  const words = candidate.replace(/[,:;]/g, "").split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 6) return false;
  return words.every((word) => word.replace(/[^A-Za-z.'-]/g, "").length >= 2);
}

function isInstitutionLine(line) {
  return /(university|college|institute|campus|bachelor|bs\b|bsc\b|computer science|information technology|school of|department of|year|month|date)/i.test(line);
}

function isLikelyAuthorNameLine(line) {
  if (!isLikelyAuthorLine(line) || isInstitutionLine(line)) return false;
  if (isAllCapsLine(line)) return false;
  if (/^(abstract|keywords?|title|approval sheet|thesis adviser|panel chair|panel member|chapter|introduction|background|methodology|references?)\b/i.test(line)) {
    return false;
  }

  const words = line.replace(/[,:;]/g, "").split(/\s+/).filter(Boolean);
  const nameLikeWords = words.filter((word) => /^[A-Z][A-Za-z.'-]*$/.test(word));
  return nameLikeWords.length >= 2 || /\b[A-Z][a-z]+,\s*[A-Z]/.test(line);
}

function isAllCapsLine(line) {
  const lettersOnly = line.replace(/[^A-Za-z]/g, "");
  return Boolean(lettersOnly) && lettersOnly === lettersOnly.toUpperCase();
}

function extractAdviser(lines) {
  for (let index = 0; index < lines.length - 1; index += 1) {
    const line = cleanMetadataLine(lines[index]);
    const nextLine = cleanMetadataLine(lines[index + 1] || "");

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
  if (words.length < 2 || words.length > 6) return false;

  return words.every((word) => {
    const letters = word.replace(/[^A-Za-z]/g, "");
    return letters.length >= 2 && /[A-Za-z]{2,}/.test(letters);
  });
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