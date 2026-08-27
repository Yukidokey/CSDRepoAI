export function getPasswordResetRedirectTo(origin = typeof window !== "undefined" ? window.location.origin : "") {
  if (!origin) return "/login";
  return `${origin}/login`;
}
