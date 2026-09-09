const productionOrigin = "https://csd-repo-ai.vercel.app";

export function getPasswordResetRedirectTo(origin = typeof window !== "undefined" ? window.location.origin : "") {
  if (!origin || /^https?:\/\/localhost(?::\d+)?$/i.test(origin)) {
    return `${productionOrigin}/login`;
  }

  return `${origin}/login`;
}
