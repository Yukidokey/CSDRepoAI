export function parseRecoveryParams(hash = typeof window !== "undefined" ? window.location.hash || "" : "") {
  const fragment = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(fragment);

  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  const type = params.get("type");
  const expiresAt = params.get("expires_at");

  return {
    accessToken,
    refreshToken,
    expiresAt,
    type,
    isRecovery: type === "recovery" && Boolean(accessToken),
  };
}

export function parseRecoveryCode(search = typeof window !== "undefined" ? window.location.search || "" : "") {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const code = params.get("code");
  return { code, isRecovery: Boolean(code) };
}
