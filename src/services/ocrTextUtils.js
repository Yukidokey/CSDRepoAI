export function stripPageMarkers(text) {
  if (!text) return "";

  return text
    .replace(/\r/g, "")
    .replace(/^-{2,}\s*page\s*\d+\s*-{2,}$/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
