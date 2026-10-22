const STATIC_EXT = /\.(png|jpe?g|webp|svg|ico|webmanifest|css|js|woff2)$/i;
const SHELL_DESTINATIONS = new Set(["document", "script", "style", "image", "font", "manifest"]);

/** Requests the service worker may store so the home-screen app opens offline. */
export function isAppShellRequest(input: {
  method: string;
  origin: string;
  appOrigin: string;
  pathname: string;
  destination: string;
  search: string;
}): boolean {
  if (input.method !== "GET") return false;
  if (input.origin !== input.appOrigin) return false;
  if (input.pathname.startsWith("/_server") || input.search.includes("_serverFn")) return false;
  if (SHELL_DESTINATIONS.has(input.destination)) return true;
  if (input.pathname.startsWith("/assets/")) return true;
  return STATIC_EXT.test(input.pathname);
}

export function shouldRegisterServiceWorker(prod: boolean, supported: boolean): boolean {
  return prod && supported;
}

export type ShellCachePolicy = "cache-first" | "stale-while-revalidate";

/** Fichiers hachés : cache d'abord. Documents : réponse en cache, puis mise à jour. */
export function shellCachePolicy(input: {
  method: string;
  origin: string;
  appOrigin: string;
  pathname: string;
  destination: string;
  search: string;
}): ShellCachePolicy | null {
  if (!isAppShellRequest(input)) return null;
  if (input.pathname === "/sw.js") return "stale-while-revalidate";
  if (input.pathname.startsWith("/assets/") || STATIC_EXT.test(input.pathname))
    return "cache-first";
  return "stale-while-revalidate";
}
