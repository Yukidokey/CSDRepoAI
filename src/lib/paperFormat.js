export const PAPER_FORMAT_SECTIONS = [
  { key: "introduction", label: "Introduction", pattern: /^(?:chapter\s*[ivx0-9]+\s*[:.-]?\s*)?(?:\d+(?:\.\d+)*\s*[:.-]?\s*)?introduction(?:\s+of\s+the\s+study)?\b/i },
  { key: "relatedWork", label: "Review of Related Literature/Studies", pattern: /^(?:chapter\s*[ivx0-9]+\s*[:.-]?\s*)?(?:\d+(?:\.\d+)*\s*[:.-]?\s*)?(?:review\s+of\s+related\s+(?:literature|studies)|related\s+(?:literature|studies)|literature\s+review)\b/i },
  { key: "methodology", label: "Methodology", pattern: /^(?:chapter\s*[ivx0-9]+\s*[:.-]?\s*)?(?:\d+(?:\.\d+)*\s*[:.-]?\s*)?(?:research\s+)?methodolog(?:y|ies)\b|^(?:chapter\s*[ivx0-9]+\s*[:.-]?\s*)?(?:\d+(?:\.\d+)*\s*[:.-]?\s*)?research\s+design\b/i },
  { key: "results", label: "Results and Discussion", pattern: /^(?:chapter\s*[ivx0-9]+\s*[:.-]?\s*)?(?:\d+(?:\.\d+)*\s*[:.-]?\s*)?(?:results?(?:\s+and\s+discussion)?|presentation,?\s+analysis\s+and\s+interpretation\s+of\s+data)\b/i },
  { key: "conclusion", label: "Summary, Conclusions, and Recommendations", pattern: /^(?:chapter\s*[ivx0-9]+\s*[:.-]?\s*)?(?:\d+(?:\.\d+)*\s*[:.-]?\s*)?(?:summary(?:\s+of\s+findings)?|conclusions?|recommendations?)\b/i },
];

const HEADING_NOISE = /^(?:page\s*\d+|\d+|chapter\s+[ivx0-9]+|table\s+of\s+contents)$/i;

export function detectPaperFormat(text) {
  const lines = String(text || "")
    .replace(/---\s*page\s+\d+\s*---/gi, "\n")
    .split(/\r?\n/)
    .map((line) => line.replace(/__DOCX_(?:BOLD|ITALIC)__/g, "").replace(/^\s*[#*\d.):-]+\s*/, "").trim())
    .filter((line) => line.length > 1 && line.length < 140 && !HEADING_NOISE.test(line));
  const sections = [];
  for (const line of lines) {
    const section = PAPER_FORMAT_SECTIONS.find(({ pattern }) => pattern.test(line));
    if (section && !sections.includes(section.key)) sections.push(section.key);
  }
  return sections;
}

export function comparePaperFormats(candidateText, referenceTexts) {
  const candidateSections = detectPaperFormat(candidateText);
  const references = (referenceTexts || [])
    .map(detectPaperFormat)
    .filter((sections) => sections.length >= 3);

  if (candidateSections.length < 3 || references.length < 5) {
    return {
      status: "insufficient",
      candidateSections,
      commonSections: [],
      unusualSections: [],
      comparedPapers: references.length,
    };
  }

  const commonSections = PAPER_FORMAT_SECTIONS
    .filter(({ key }) => references.filter((sections) => sections.includes(key)).length / references.length >= 0.6)
    .map(({ key }) => key);
  const missingSections = commonSections.filter((key) => !candidateSections.includes(key));
  const unusualSections = candidateSections.filter((key) => !commonSections.includes(key));
  const isDifferent = missingSections.length >= 2 || unusualSections.length >= 2;

  return {
    status: isDifferent ? "different" : "match",
    candidateSections,
    commonSections,
    missingSections,
    unusualSections,
    comparedPapers: references.length,
  };
}

export function formatSectionLabels(sectionKeys) {
  return (sectionKeys || [])
    .map((key) => PAPER_FORMAT_SECTIONS.find((section) => section.key === key)?.label)
    .filter(Boolean);
}
