import { SDG_LIST } from "../lib/sdgList.js";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import mammoth from "mammoth/mammoth.browser.js";

const viteEnv = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};
const GENKIT_METADATA_URL = viteEnv.VITE_GENKIT_METADATA_URL;

export const THESIS_BOILERPLATE_ANCHORS = [
  "Notre Dame of Marbel University",
  "Bachelor of Science in",
  "Thesis Adviser",
  "Panel Chair",
  "Panel Member",
];

export function normalizeThesisBoilerplate(text) {
  return THESIS_BOILERPLATE_ANCHORS.reduce((normalized, anchor) => {
    const escapedAnchor = anchor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const anchorPattern = new RegExp(`([^\\n_])\\s*(${escapedAnchor})`, "gi");
    return normalized.replace(anchorPattern, "$1\n$2");
  }, String(text || ""));
}

const CONCATENATED_NAME_PATTERN = "[A-Z][a-z]+(?:\\s[A-Z][a-z]+)*\\s[A-Z]\\.\\s[A-Z][a-z]+";

export function splitConcatenatedNames(line) {
  const concatenatedNames = new RegExp(`(${CONCATENATED_NAME_PATTERN})\\s+(?=${CONCATENATED_NAME_PATTERN})`, "g");
  return String(line || "").replace(concatenatedNames, "$1\n");
}

export async function extractMetadataWithAI(documentText) {
  if (!GENKIT_METADATA_URL) {
    return { unavailable: true };
  }

  const normalizedDocumentText = normalizeThesisBoilerplate(documentText);

  try {
    const response = await fetch(GENKIT_METADATA_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ documentText: normalizedDocumentText }),
    });

    if (!response.ok) {
      throw new Error(`metadata extraction request failed (${response.status})`);
    }

    return await response.json();
  } catch (error) {
    console.warn("Genkit semantic search unavailable, using fallback text search.", error);
    return { failed: true };
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

function isLikelyNonTitle(title, adviser = "") {
  if (!title) return false;
  const normalized = title.toLowerCase();
  return /(bachelor of|university|college|institute|department of|school of)/i.test(title)
    || Boolean(adviser && normalized.includes(adviser.toLowerCase()));
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

  const documentText = normalizeThesisBoilerplate(
    isDocx(file) ? await extractDocxText(file) : await extractPdfText(file)
  );
  const extracted = extractDocumentFields(documentText);
  const abstract = extracted.abstract || buildAbstract(documentText, extracted.title);

  const metadata = await maybeAnalyzeWithGenkit({
    title: extracted.title,
    abstract,
    keywords: extracted.keywords,
    text: documentText,
  });

  const title = resolveDocumentTitle(extracted.title, file, extracted.adviser);

  return {
    title,
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

  const documentText = normalizeThesisBoilerplate(
    isDocx(file) ? await extractDocxText(file) : await extractPdfText(file)
  );
  const extracted = extractDocumentFields(documentText);
  const abstract = extracted.abstract || buildAbstract(documentText, extracted.title);

  if (!GENKIT_METADATA_URL) {
    return analyzeResearchDocument(file);
  }

  const aiMetadata = await extractMetadataWithAI(documentText);
  if (aiMetadata?.unavailable || aiMetadata?.failed) {
    return analyzeResearchDocument(file);
  }

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

  const localTitle = resolveDocumentTitle(extracted.title, null, extracted.adviser);
  const aiTitle = resolveDocumentTitle(aiMetadata.title, null, aiMetadata.adviser || extracted.adviser);

  return {
    title: localTitle || aiTitle || titleFromFilename(file),
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
  const pageLimit = pdf.numPages;

  for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = joinPdfTextItems(content.items, content.styles);
    pages.push(pageNumber === 1 ? pageText : `--- Page ${pageNumber} ---\n${pageText}`);
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
  const blocks = html.match(/<(p|h[1-6])\b[^>]*>[\s\S]*?<\/\1>/gi) || [];

  for (const block of blocks) {
    const isHeading = /^<h[1-6]\b/i.test(block);
    if (!isHeading && !/<strong\b|<b\b/i.test(block)) continue;

    const text = block
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

const LINE_ITEM_OVERLAP_EPSILON = 0.5;

function joinPdfTextItems(items, styles = {}) {
  const lines = [];
  const baseFontSize = getBaseFontSize(items);
  for (const item of items) {
    const text = item.str?.trim();
    if (!text) continue;
    const y = item.transform?.[5] ?? 0;
    const fontSize = getPdfFontSize(item);
    const x = item.transform?.[4] ?? 0;
    const width = item.width ?? 0;
    const line = lines.find((candidate) => (
      Math.abs(candidate.y - y) < 3
      && candidate.items.every((existingItem) => (
        x >= existingItem.x + existingItem.width - LINE_ITEM_OVERLAP_EPSILON
        || x + width <= existingItem.x + LINE_ITEM_OVERLAP_EPSILON
      ))
    ));
    if (line) {
      line.items.push({ x, text, width, bold: isPdfBoldItem(item, styles, fontSize, baseFontSize) });
    } else {
      lines.push({ y, items: [{ x, text, width, bold: isPdfBoldItem(item, styles, fontSize, baseFontSize) }] });
    }
  }

  const joined = lines
    .sort((a, b) => b.y - a.y)
    .map((line) => {
      const itemsInOrder = line.items.sort((a, b) => a.x - b.x);
      const text = itemsInOrder.reduce((result, item, index) => {
        if (index === 0) return item.text;
        const previous = itemsInOrder[index - 1];
        const gap = item.x - (previous.x + previous.width);
        return `${result}${gap > 1 ? " " : ""}${item.text}`;
      }, "");
      return line.items.some((item) => item.bold) ? `__PDF_BOLD__${text}` : text;
    })
    .join("\n");

  return collapseHyphenSpacing(joined);
}

function isPdfBoldItem(item, styles, fontSize, baseFontSize) {
  const style = styles?.[item.fontName] || {};
  const fontName = `${item.fontName || ""} ${style.fontFamily || ""}`;
  if (/bold|black|semibold|demi/i.test(fontName)) return true;
  if (baseFontSize <= 0) return false;
  return fontSize >= baseFontSize * 1.08;
}

function getPdfFontSize(item) {
  return Math.hypot(item.transform?.[0] ?? 0, item.transform?.[1] ?? 0);
}

function getBaseFontSize(items) {
  const counts = new Map();
  for (const item of items) {
    const text = item.str?.trim();
    if (!text) continue;
    const size = Math.round(getPdfFontSize(item) * 100) / 100;
    counts.set(size, (counts.get(size) || 0) + text.length);
  }
  let baseSize = 0;
  let bestCount = -1;
  for (const [size, count] of counts) {
    if (count > bestCount) {
      bestCount = count;
      baseSize = size;
    }
  }
  return baseSize;
}

function collapseHyphenSpacing(text) {
  return text.replace(/(\w)[ \t]*[-–—][ \t]*(\w)/g, "$1-$2");
}

function isDocx(file) {
  return file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || /\.docx$/i.test(file.name);
}

export function extractDocumentFields(text) {
  if (!text) return { title: "", abstract: "", keywords: "", authors: [], adviser: "", panelMembers: [] };

  const lines = normalizeThesisBoilerplate(text)
    .split("\n")
    .flatMap((line) => splitConcatenatedNames(line).split("\n"))
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const abstractIndex = findAbstractIndex(lines);
  const keywordsIndex = findKeywordsIndex(lines, abstractIndex);
  const abstract = extractSection(lines, abstractIndex, ["keywords?", "introduction", "chapter", "table of contents"]);
  const keywordsLine = extractKeywords(lines, keywordsIndex);
  const title = extractTitle(lines);
  const authors = extractAuthors(lines);
  const adviser = extractAdviser(lines);
  const panelMembers = extractPanelMembers(lines);

  return {
    title,
    authors,
    adviser,
    panelMembers,
    abstract,
    keywords: cleanMetadataLine(keywordsLine).replace(/[.;]+$/, "").trim(),
  };
}

function extractTitle(lines) {
  const titleIndex = lines.slice(0, 12).findIndex((line) => /^title\s*(?:[:\-].*|)$/i.test(cleanMetadataLine(line)));
  if (titleIndex >= 0) {
    const inlineTitle = cleanMetadataLine(lines[titleIndex]).replace(/^title\s*[:\-]?\s*/i, "").trim();
    if (inlineTitle) return inlineTitle;
    const nextTitleLine = cleanMetadataLine(lines[titleIndex + 1] || "");
    if (nextTitleLine && !isDocumentHeading(nextTitleLine)) return nextTitleLine;
  }

  const hasBoldMarkers = lines.some(isBoldMetadataLine);
  if (!hasBoldMarkers) return firstPageTitle(lines);

  const boldTitleIndex = lines
    .slice(0, 12)
    .findIndex((line) => isBoldMetadataLine(line) && !isDocumentHeading(cleanMetadataLine(line)));
  if (boldTitleIndex >= 0) {
    const titleLines = [];
    for (let index = boldTitleIndex; index < Math.min(lines.length, 12); index += 1) {
      if (!isBoldMetadataLine(lines[index])) break;
      titleLines.push(cleanMetadataLine(lines[index]));
    }
    if (titleLines.length > 0) return titleLines.join(" ").replace(/\s+/g, " ").trim();
  }

  const authorLabelIndex = lines.findIndex((line) => /^(authors?|researchers?|prepared by|by)\s*[:\-]?\s*/i.test(line));
  if (authorLabelIndex > 0) {
    const beforeAuthors = lines.slice(0, authorLabelIndex).filter((line) => !isPageMarkerLine(line));
    if (beforeAuthors.length > 0) return beforeAuthors.slice(-3).join(" ").trim();
  }

  return firstPageTitle(lines);
}

function resolveDocumentTitle(title, file, adviser = "") {
  const cleanedTitle = cleanMetadataLine(String(title || "")).replace(/\s+/g, " ").trim();
  if (cleanedTitle && !isPlaceholderTitle(cleanedTitle) && !isLikelyNonTitle(cleanedTitle, adviser)) return cleanedTitle;
  return file ? titleFromFilename(file) : "";
}

function isPlaceholderTitle(title) {
  return /^(string|title|document|manuscript|research paper|untitled|unknown|n\/a|null|undefined)$/i.test(title.trim());
}

function titleFromFilename(file) {
  const filename = String(file?.name || "")
    .replace(/\.[^.]+$/, "")
    .replace(/[._+\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!filename || /^(document|manuscript|research|thesis|paper|file|untitled)(\s*\d+)?$/i.test(filename)) return "";
  return filename;
}

function extractSection(lines, startIndex, stopPatterns) {
  if (startIndex < 0) return "";
  const content = [];
  for (let index = startIndex; index < lines.length; index += 1) {
    if (index === startIndex) {
      const inline = stripAbstractHeading(cleanMetadataLine(lines[index]));
      if (inline) content.push(inline);
      continue;
    }
    const line = cleanMetadataLine(lines[index]);
    const keywordPosition = line.search(/\*?\s*key\s*(?:words?|wrods?|wods?)\s*\*?\s*[:\-]/i);
    if (stopPatterns.includes("keywords?") && keywordPosition >= 0) {
      const beforeKeywords = line.slice(0, keywordPosition).trim();
      if (beforeKeywords) content.push(beforeKeywords);
      break;
    }
    if (stopPatterns.some((pattern) => pattern !== "keywords?" && new RegExp(`^${pattern}\\b`, "i").test(line))) break;
    content.push(line);
  }
  return content.join(" ").replace(/\s+/g, " ").trim();
}

function extractKeywords(lines, startIndex) {
  if (startIndex < 0) return "";

  const firstLine = cleanMetadataLine(lines[startIndex]);
  const keywordStart = firstLine.search(/\*?\s*key\s*(?:words?|wrods?|wods?)\s*\*?\s*[:\-]/i);
  const segments = [stripKeywordsHeading(keywordStart >= 0 ? firstLine.slice(keywordStart) : firstLine)];
  let index = startIndex + 1;
  while (
    index < lines.length
    && segments.length < 6
    && !/\.\s*$/.test(segments[segments.length - 1].trim())
  ) {
    const nextLine = cleanMetadataLine(lines[index]);
    if (
      !nextLine
      || isPageMarkerLine(nextLine)
      || isDocumentHeading(nextLine)
      || isAbstractHeading(nextLine)
      || isKeywordsHeading(nextLine)
      || /^\d+$/.test(nextLine)
    ) break;
    segments.push(nextLine);
    index += 1;
  }

  return segments
    .join(" ")
    .replace(/\*+\s*$/, "")
    .replace(/[.;]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function findKeywordsIndex(lines, abstractIndex) {
  if (abstractIndex >= 0 && /\*?\s*key\s*(?:words?|wrods?|wods?)\s*\*?\s*[:\-]/i.test(cleanMetadataLine(lines[abstractIndex]))) {
    return abstractIndex;
  }
  const startIndex = abstractIndex >= 0 ? abstractIndex + 1 : 0;
  return lines.findIndex((line, index) => index >= startIndex && /\*?\s*key\s*(?:words?|wrods?|wods?)\s*\*?\s*[:\-]/i.test(cleanMetadataLine(line)));
}

function findAbstractIndex(lines) {
  return lines.findIndex((line) => isAbstractHeading(cleanMetadataLine(line)));
}

function isAbstractHeading(line) {
  const normalized = line.toLowerCase().replace(/[^a-z]/g, "");
  return /^(abstract|abstrac|abstrct)/.test(normalized);
}

function stripAbstractHeading(line) {
  return line.replace(/^\s*[*_\s-]*(?:abstract|abstrac|abstrct)\s*[:\-]?\s*/i, "").trim();
}

function isKeywordsHeading(line) {
  return /^\s*[*_\s-]*key\s*(?:words?|wrods?|wods?)\s*[*_\s]*[:\-]?/i.test(line);
}

function stripKeywordsHeading(line) {
  return line.replace(/^\s*[*_\s-]*key\s*(?:words?|wrods?|wods?)\s*[*_\s]*[:\-]?\s*[*_\s]*/i, "").trim();
}

function isDocumentHeading(line) {
  return /^(introduction|background|methodology|methods?|results?|discussion|conclusion|references?|chapter|table of contents|acknowledgement|approval sheet|dedication)\b/i.test(line);
}

function isPageMarkerLine(line) {
  return /^-{2,}\s*page\s*\d+\s*-{2,}$/i.test(line.trim());
}

function firstPageTitle(lines) {
  const firstPageLines = getFirstPageLines(lines);
  const inlineTitle = extractInlineFirstPageTitle(firstPageLines);
  if (inlineTitle) return inlineTitle;

  const titleLines = [];

  for (let index = 0; index < firstPageLines.length && index < 20; index += 1) {
    const line = cleanMetadataLine(firstPageLines[index]).replace(/^(title\s*[:\-]?\s*)/i, "").trim();
    if (!line) continue;
    if (isPageMarkerLine(line)) continue;
    if (/^(abstract|keywords?)\b/i.test(line)) break;
    if (isTitlePageAuthorBoundary(firstPageLines, index)) break;
    if (titleLines.length > 0 && isInstitutionLine(line) && !isAllCapsLine(line)) break;
    titleLines.push(line);
  }

  return titleLines.join(" ").replace(/\s+/g, " ").trim();
}

function getFirstPageLines(lines) {
  const firstPage = [];
  for (const line of lines) {
    if (isPageMarkerLine(line) && /page\s+[2-9]\d*/i.test(line)) break;
    firstPage.push(line);
  }
  return firstPage;
}

function extractInlineFirstPageTitle(lines) {
  const contentLines = getFirstPageLines(lines).filter((line) => !isPageMarkerLine(line));
  if (contentLines[0]?.length <= 100) return "";

  const pageText = contentLines
    .map((line) => cleanMetadataLine(line))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (!pageText) return "";

  const institutionMatch = pageText.search(/\b(?:Notre Dame of Marbel University|University|College|Institute|Bachelor of|Master of)\b/i);
  const titlePageText = institutionMatch >= 0 ? pageText.slice(0, institutionMatch).trim() : pageText;
  if (!titlePageText || titlePageText.includes("\n")) return "";

  const authorMatch = titlePageText.search(/\b(?!Pair\b|Language\b|Translation\b|Machine\b|Neural\b|Speech\b|Text\b|Low\b|Resource\b|End\b|the\b|for\b|and\b|of\b)[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}\s+[A-Z]\.\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?/);
  if (authorMatch > 0) {
    const title = titlePageText.slice(0, authorMatch).trim();
    if (title && !isDocumentHeading(title)) return title;
  }

  return "";
}

function isTitlePageAuthorBoundary(lines, index) {
  const line = cleanMetadataLine(lines[index]);
  if (!isLikelyAuthorNameLine(line)) return false;
  if (/\b(?:a|an|and|for|from|in|of|on|the|to|with)\b/i.test(line)) return false;
  if (/[A-Za-z]-[A-Za-z]/.test(line)) return false;

  for (let nextIndex = index + 1; nextIndex <= index + 3 && nextIndex < lines.length; nextIndex += 1) {
    const nextLine = cleanMetadataLine(lines[nextIndex]);
    if (isInstitutionLine(nextLine) || /^(bachelor|master|bs\b|ms\b|approval sheet)\b/i.test(nextLine)) return true;
    if (isLikelyAuthorNameLine(nextLine)) continue;
    if (isDocumentHeading(nextLine)) break;
  }

  return false;
}

function extractInlineFirstPageAuthors(lines, title) {
  if (!title) return [];

  const contentLines = getFirstPageLines(lines).filter((line) => !isPageMarkerLine(line));
  if (contentLines[0]?.length <= 100) return [];

  const pageText = contentLines
    .map((line) => cleanMetadataLine(line))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  const titleEnd = pageText.indexOf(title);
  if (titleEnd < 0) return [];

  const afterTitle = pageText.slice(titleEnd + title.length);
  const institutionMatch = afterTitle.search(/\b(?:Notre Dame of Marbel University|University|College|Institute|Bachelor of|Master of)\b/i);
  const authorText = (institutionMatch >= 0 ? afterTitle.slice(0, institutionMatch) : afterTitle).trim();
  const authors = splitConcatenatedNames(authorText)
    .split("\n")
    .map((line) => cleanMetadataLine(line).trim())
    .filter((line) => isAuthorCandidate(line) || isLikelyAuthorNameLine(line));

  return [...new Set(authors)].slice(0, 6);
}

function extractAuthors(lines) {
  const labeledAuthors = extractLabeledAuthors(lines);
  if (labeledAuthors.length > 0) return labeledAuthors;

  const titleIndex = lines.findIndex((line) => isBoldMetadataLine(line));
  const title = extractTitle(lines);
  const inlineAuthors = extractInlineFirstPageAuthors(lines, title);
  if (inlineAuthors.length > 0) return inlineAuthors;
  const universityIndex = lines.findIndex((line, index) => index > 0 && /\b(university|college|institute)\b/i.test(cleanMetadataLine(line)));
  let authorStart = 0;
  if (titleIndex >= 0) {
    authorStart = titleIndex + 1;
    while (authorStart < lines.length && isBoldMetadataLine(lines[authorStart])) {
      authorStart += 1;
    }
  }
  if (authorStart === 0) {
    const titleEndIndex = findTitleEndIndex(lines, title);
    if (titleEndIndex > 0) authorStart = titleEndIndex;
  }
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

function findTitleEndIndex(lines, title) {
  if (!title) return -1;

  let combined = "";
  for (let index = 0; index < Math.min(lines.length, 20); index += 1) {
    const line = cleanMetadataLine(lines[index]);
    if (isPageMarkerLine(line)) continue;
    combined = `${combined} ${line}`.trim();
    if (combined === title) return index + 1;
    if (!title.startsWith(combined)) return -1;
  }

  return -1;
}

function cleanMetadataLine(line) {
  return line.replace(/^__(?:DOCX|PDF)_(?:BOLD|ITALIC)__/, "").trim();
}

function isBoldMetadataLine(line) {
  return /^__(?:DOCX|PDF)_BOLD__/.test(line);
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
  return words.every((word) => {
    const letters = word.replace(/[^A-Za-z.'-]/g, "");
    return letters.length >= 2 || /^[A-Za-z]\.?$/.test(word);
  });
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
  for (let index = 0; index < lines.length; index += 1) {
    const line = cleanMetadataLine(lines[index]);
    const nextLine = cleanMetadataLine(lines[index + 1] || "");

    const sameLine = extractSameLineAdviser(line);
    if (sameLine) return sameLine;
    if (!isPageMarkerLine(line) && isAdviserCaption(nextLine) && !extractSameLineAdviser(nextLine)) {
      return line.replace(/[\s,:;-]+$/, "").trim();
    }
  }

  return "";
}

function extractPanelMembers(lines) {
  const panelMembers = [];
  const panelRolePattern = /^(?:panel\s*(?:chair|member)|chair(?:person)?\s*of\s*the\s*panel)$/i;
  const inlinePanelPattern = /^(.*?)\s+(?:panel\s*(?:chair|member)|chair(?:person)?\s*of\s*the\s*panel)$/i;

  for (let index = 0; index < lines.length; index += 1) {
    const line = cleanMetadataLine(lines[index]);
    const nextLine = cleanMetadataLine(lines[index + 1] || "");
    const inlineMatch = line.match(inlinePanelPattern);
    const name = panelRolePattern.test(nextLine) ? line : inlineMatch?.[1] || "";
    if (name && isLikelyAuthorNameLine(name)) panelMembers.push(name.trim());
  }

  return [...new Set(panelMembers)];
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
    return (letters.length >= 2 || /^[A-Za-z]\.?$/.test(word)) && /[A-Za-z]{1,}/.test(letters);
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

function isAdviserCaption(line) {
  const normalized = line.toLowerCase().replace(/[^a-z]/g, "");
  return normalized.includes("thesisadviser")
    || normalized.includes("thesisadvisor")
    || normalized.includes("thesisadviscr")
    || normalized.includes("thesisadviaer");
}

function extractSameLineAdviser(line) {
  const match = line.match(/^(.*?)\bthesis\s+advis(?:er|or|cr|aer)\b\s*[:\-,]?\s*(.*)$/i);
  if (!match) {
    const reversed = line.match(/^\s*thesis\s+advis(?:er|or|cr|aer)\b\s*[:\-,]?\s*(.+)$/i);
    return reversed?.[1]?.trim() || "";
  }
  return (match[1].trim() || match[2].trim()).replace(/[\s,:;-]+$/, "").trim();
}