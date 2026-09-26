/** Normalize Genkit service configuration so a bare Vercel hostname is not
 * interpreted by fetch() as a path relative to the current app route. */
export function normalizeGenkitUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const withProtocol = /^https?:\/\//i.test(raw)
    ? raw
    : /^(localhost|127\.0\.0\.1)(:\d+)?(?:\/|$)/i.test(raw)
      ? `http://${raw}`
      : `https://${raw}`;

  return withProtocol
    .replace(/^http:\/\/(?!localhost(?::|\/)|127\.0\.0\.1(?::|\/))/i, "https://")
    .replace(/\/+$/, "");
}

export function toGenkitEndpoint(value, endpoint) {
  const baseUrl = normalizeGenkitUrl(value);
  if (!baseUrl) return "";
  const baseWithoutEndpoint = baseUrl.replace(/\/(?:search|check-duplicate|embed|metadata|extract-metadata|health)$/i, "");
  return `${baseWithoutEndpoint}/${endpoint}`;
}
