import type { Session } from "@supabase/supabase-js";
import { syncAccessCookie } from "./access-cookie";
import { supabase } from "@/integrations/supabase/client";
import { browserEnv, readSupabaseConfig } from "./supabase-env";
import { parisDay } from "./quota";

export { supabase };
export const CACHE_OWNER_KEY = "vestiaire-cache-user";

export type CloudClient = typeof supabase;

let configured: boolean | undefined;

/** True when Lovable Cloud has written its public variables. */
export function isCloudConfigured(): boolean {
  if (configured === undefined) configured = readSupabaseConfig(browserEnv()) !== null;
  return configured;
}

export function resetBrowserSupabaseForTests() {
  configured = undefined;
}

/** The Cloud client, or null when no backend is connected. */
export function getSupabase(): CloudClient | null {
  return isCloudConfigured() ? supabase : null;
}

export function readCacheOwner(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(CACHE_OWNER_KEY);
  } catch {
    return null;
  }
}

export function writeCacheOwner(userId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CACHE_OWNER_KEY, userId);
  } catch {
    /* the next sign-in will merge again; nothing is deleted remotely */
  }
}

export async function ensureAccessCookie(): Promise<void> {
  const client = getSupabase();
  if (!client) return;
  try {
    const { data } = await client.auth.getSession();
    let session = data.session;
    const expiresAt = session?.expires_at ?? 0;
    if (session && expiresAt * 1000 < Date.now() + 60_000) {
      const refreshed = await client.auth.refreshSession();
      session = refreshed.data.session ?? session;
    }
    syncAccessCookie(session?.access_token ?? null, session?.expires_at);
  } catch {
    syncAccessCookie(null);
  }
}

export function applySessionCookie(session: Session | null) {
  syncAccessCookie(session?.access_token ?? null, session?.expires_at);
}

export async function fetchTodayUsage(): Promise<{ analyses: number; advice: number } | null> {
  const client = getSupabase();
  if (!client) return null;
  const { data, error } = await client.from("ai_usage").select("analyses, advice").eq("day", parisDay()).maybeSingle();
  if (error) return null;
  if (!data) return { analyses: 0, advice: 0 };
  const row = data as { analyses?: number; advice?: number };
  return { analyses: row.analyses ?? 0, advice: row.advice ?? 0 };
}
