import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { readAccessToken } from "./access-cookie";
import { authorizeAiCall, interpretQuotaPayload, type QuotaDecision } from "./ai-guard";
import type { AiKind } from "./quota";
import { readSupabaseConfig, serverEnv } from "./supabase-env";

async function verifyUser(url: string, key: string, accessToken: string): Promise<{ id: string } | null> {
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) return null;
  return { id: data.user.id };
}

async function consumeQuota(url: string, key: string, accessToken: string, kind: AiKind): Promise<QuotaDecision> {
  const supabase = createClient(url, key, {
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        headers.set("Authorization", `Bearer ${accessToken}`);
        return fetch(input, { ...init, headers });
      },
    },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await supabase.rpc("consume_ai_quota", { kind });
  if (error) return { ok: false, code: "unavailable" };
  return interpretQuotaPayload(data);
}

/** Verifies the caller and consumes one daily credit. Never reuses a client across requests. */
export async function gateAiCall(kind: AiKind) {
  const config = readSupabaseConfig(serverEnv());
  let token: string | null = null;
  try {
    const headers = getRequest().headers;
    token = readAccessToken(headers.get("cookie"), headers.get("authorization"));
  } catch {
    token = null;
  }
  return authorizeAiCall({
    token,
    kind,
    configured: Boolean(config),
    verify: (accessToken) => (config ? verifyUser(config.url, config.publishableKey, accessToken) : Promise.resolve(null)),
    consume: (accessToken, aiKind) =>
      config ? consumeQuota(config.url, config.publishableKey, accessToken, aiKind) : Promise.resolve({ ok: false, code: "unavailable" }),
  });
}
