import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { syncAccessCookie } from "./access-cookie";
import { getSupabase } from "@/integrations/supabase/client";
import { parisDay } from "./quota";

export { getSupabase, isCloudConfigured } from "@/integrations/supabase/client";

export const CACHE_OWNER_KEY = "vestiaire-cache-user";

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
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const { data } = await supabase.auth.getSession();
    let session = data.session;
    const expiresAt = session?.expires_at ?? 0;
    if (session && expiresAt * 1000 < Date.now() + 60_000) {
      const refreshed = await supabase.auth.refreshSession();
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
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.from("ai_usage").select("analyses, advice").eq("day", parisDay()).maybeSingle();
  if (error) return null;
  if (!data) return { analyses: 0, advice: 0 };
  const row = data as { analyses?: number; advice?: number };
  return { analyses: row.analyses ?? 0, advice: row.advice ?? 0 };
}

export type { SupabaseClient };
