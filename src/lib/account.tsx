import { useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { applySessionCookie, getSupabase, isCloudConfigured, writeCacheOwner } from "./cloud";
import { registerSync, requestSync, requestSyncNow } from "./sync-bridge";
import { syncPersonalAccount, type SyncOutcome } from "./sync-engine";

export interface AccountUser {
  id: string;
  email: string | null;
}

interface AccountCtx {
  ready: boolean;
  configured: boolean;
  user: AccountUser | null;
  recovery: boolean;
  syncState: "idle" | "saving" | "error";
  syncMessage: string | null;
  lastSyncAt: number | null;
  signOut: () => Promise<void>;
  syncNow: () => Promise<void>;
  clearRecovery: () => void;
}

const Ctx = createContext<AccountCtx>({
  ready: false,
  configured: false,
  user: null,
  recovery: false,
  syncState: "idle",
  syncMessage: null,
  lastSyncAt: null,
  signOut: async () => {},
  syncNow: async () => {},
  clearRecovery: () => {},
});

export function AccountProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [ready, setReady] = useState(false);
  const [configured] = useState(() => isCloudConfigured());
  const [user, setUser] = useState<AccountUser | null>(null);
  const [recovery, setRecovery] = useState(() => {
    if (typeof sessionStorage === "undefined") return false;
    try {
      return sessionStorage.getItem("vestiaire-recovery") === "1";
    } catch {
      return false;
    }
  });
  const [syncState, setSyncState] = useState<AccountCtx["syncState"]>("idle");
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const userIdRef = useRef<string | null>(null);
  const flight = useRef<Promise<SyncOutcome> | null>(null);
  const pending = useRef(false);

  const applySession = useCallback((session: Session | null) => {
    applySessionCookie(session);
    if (session?.user) {
      userIdRef.current = session.user.id;
      setUser({ id: session.user.id, email: session.user.email ?? null });
    } else {
      userIdRef.current = null;
      setUser(null);
    }
  }, []);

  const execute = useCallback(
    async (id: string): Promise<SyncOutcome> => {
      if (flight.current) {
        pending.current = true;
        return flight.current;
      }
      const job = (async () => {
        let outcome: SyncOutcome = { ok: false, message: "Sauvegarde interrompue." };
        do {
          pending.current = false;
          setSyncState("saving");
          outcome = await syncPersonalAccount(id);
          if (!outcome.ok) {
            setSyncState("error");
            setSyncMessage(outcome.message);
            break;
          }
          writeCacheOwner(outcome.nextCacheOwner);
          setSyncState("idle");
          setSyncMessage(null);
          setLastSyncAt(Date.now());
          if (outcome.changedLocal) await queryClient.invalidateQueries();
          if (outcome.claimedLocal) toast.success("Votre dressing a été copié dans votre compte.");
        } while (pending.current);
        return outcome;
      })().finally(() => {
        flight.current = null;
      });
      flight.current = job;
      return job;
    },
    [queryClient],
  );

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setReady(true);
      return;
    }
    let active = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        applySession(data.session);
        setReady(true);
      })
      .catch(() => {
        if (active) setReady(true);
      });
    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      applySession(session);
      if (event === "PASSWORD_RECOVERY") {
        try {
          sessionStorage.setItem("vestiaire-recovery", "1");
        } catch {
          /* the form still opens if we are already on the account page */
        }
        setRecovery(true);
        if (typeof window !== "undefined" && !window.location.pathname.startsWith("/compte")) {
          window.location.assign("/compte");
        }
      }
      if (event === "SIGNED_OUT") setRecovery(false);
    });
    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [applySession]);

  const userId = user?.id ?? null;
  useEffect(() => {
    if (!userId) return;
    const run = () => {
      void execute(userId);
    };
    const unregister = registerSync(run);
    run();
    const onVisible = () => {
      if (document.visibilityState === "visible") requestSync();
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") requestSyncNow();
    };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      unregister();
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [execute, userId]);

  const signOut = useCallback(async () => {
    const supabase = getSupabase();
    applySessionCookie(null);
    if (supabase) await supabase.auth.signOut();
    setUser(null);
    userIdRef.current = null;
  }, []);

  const syncNow = useCallback(async () => {
    const id = userIdRef.current;
    if (!id) return;
    const outcome = await execute(id);
    if (outcome.ok) toast.success("Sauvegarde en ligne à jour");
    else toast.error(outcome.message);
  }, [execute]);

  const value = useMemo<AccountCtx>(
    () => ({
      ready,
      configured,
      user,
      recovery,
      syncState,
      syncMessage,
      lastSyncAt,
      signOut,
      syncNow,
      clearRecovery: () => {
        try {
          sessionStorage.removeItem("vestiaire-recovery");
        } catch {
          /* ignore */
        }
        setRecovery(false);
      },
    }),
    [ready, configured, user, recovery, syncState, syncMessage, lastSyncAt, signOut, syncNow],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}
