import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { browserEnv, readSupabaseConfig } from "@/lib/supabase-env";

// Browser client for Lovable Cloud.
// Lovable writes VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY
// (VITE_SUPABASE_ANON_KEY is still accepted). The app keeps working when they
// are missing: getSupabase() returns null instead of throwing.

let client: SupabaseClient | null | undefined;

function browserStorage(): Storage | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const config = readSupabaseConfig(browserEnv());
  if (!config) {
    client = null;
    return null;
  }
  const storage = browserStorage();
  client = createClient(config.url, config.publishableKey, {
    auth: {
      flowType: "implicit",
      persistSession: Boolean(storage),
      autoRefreshToken: Boolean(storage),
      detectSessionInUrl: Boolean(storage),
      ...(storage ? { storage } : {}),
    },
  });
  return client;
}

export function resetBrowserSupabaseForTests() {
  client = undefined;
}

export function isCloudConfigured(): boolean {
  return readSupabaseConfig(browserEnv()) !== null;
}
