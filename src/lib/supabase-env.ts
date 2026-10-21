const URL_KEYS = ["SUPABASE_URL", "VITE_SUPABASE_URL"] as const;
const KEY_KEYS = [
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_ANON_KEY",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "VITE_SUPABASE_ANON_KEY",
] as const;

export interface SupabasePublicConfig {
  url: string;
  publishableKey: string;
}

function first(env: Record<string, string | undefined>, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = env[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function isAcceptableUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:") return true;
    if (parsed.protocol === "http:" && (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")) return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * Reads the variable names Lovable Cloud writes.
 * Browser builds receive the `VITE_` pair. TanStack server code also receives
 * `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` (or the older anon key).
 * Returns null when Cloud has not been enabled yet.
 */
export function readSupabaseConfig(env: Record<string, string | undefined>): SupabasePublicConfig | null {
  const url = first(env, URL_KEYS);
  const publishableKey = first(env, KEY_KEYS);
  if (!url || !publishableKey || !isAcceptableUrl(url)) return null;
  return { url, publishableKey };
}

export function browserEnv(): Record<string, string | undefined> {
  const env = import.meta.env as unknown as Record<string, string | undefined>;
  return {
    VITE_SUPABASE_URL: env["VITE_SUPABASE_URL"],
    VITE_SUPABASE_PUBLISHABLE_KEY: env["VITE_SUPABASE_PUBLISHABLE_KEY"],
    VITE_SUPABASE_ANON_KEY: env["VITE_SUPABASE_ANON_KEY"],
    VITE_SUPABASE_PROJECT_ID: env["VITE_SUPABASE_PROJECT_ID"],
  };
}

export function serverEnv(): Record<string, string | undefined> {
  const merged: Record<string, string | undefined> = { ...browserEnv() };
  if (typeof process !== "undefined" && process.env) {
    for (const key of [...URL_KEYS, ...KEY_KEYS]) {
      const value = process.env[key];
      if (typeof value === "string" && value.trim()) merged[key] = value.trim();
    }
  }
  return merged;
}
