const productionOrigin = "https://csd-repo-ai.vercel.app";

export function getPasswordResetRedirectTo() {
  return `${productionOrigin}/login`;
}
