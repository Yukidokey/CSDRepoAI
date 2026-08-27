import { SDG_LIST } from "../lib/sdgList";

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