export const ACCESS_COOKIE = "vestiaire-access-token";

/** Reads the Supabase access token from the request without trusting it. */
export function readAccessToken(
  cookieHeader: string | null | undefined,
  authorizationHeader?: string | null,
): string | null {
  const authorization = authorizationHeader?.trim();
  if (authorization && authorization.toLowerCase().startsWith("bearer ")) {
    const token = authorization.slice(7).trim();
    if (token) return token;
  }
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    if (trimmed.slice(0, eq) !== ACCESS_COOKIE) continue;
    try {
      const value = decodeURIComponent(trimmed.slice(eq + 1)).trim();
      return value || null;
    } catch {
      return null;
    }
  }
  return null;
}

export function syncAccessCookie(token: string | null, expiresAtSeconds?: number) {
  if (typeof document === "undefined") return;
  if (!token) {
    document.cookie = `${ACCESS_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
    return;
  }
  const maxAge = expiresAtSeconds ? Math.max(60, expiresAtSeconds - Math.floor(Date.now() / 1000)) : 3600;
  const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${ACCESS_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}
