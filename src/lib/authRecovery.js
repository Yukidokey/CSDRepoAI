export function parseRecoveryParams(hash = window.location.hash || "") {
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
