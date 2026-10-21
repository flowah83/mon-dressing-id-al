import { useCallback, useEffect, useRef, useState } from "react";
import {
  browserWeatherClient,
  isAbortError,
  loadAdvisorWeather,
  type WeatherClient,
  type WeatherFailure,
  type WeatherSnapshot,
} from "@/lib/weather";

export interface AdvisorWeatherState {
  phase: "idle" | "loading" | "ready" | "error";
  snapshot: WeatherSnapshot | null;
  fromCache: boolean;
  reason: WeatherFailure | null;
}

const INITIAL: AdvisorWeatherState = {
  phase: "idle",
  snapshot: null,
  fromCache: false,
  reason: null,
};

/**
 * Quand `enabled` devient vrai, lit le cache (30 min) ou demande la position puis la météo.
 * `retry` relance tout de suite, dans le geste du bouton : sur iPhone la demande de
 * position doit partir du toucher, pas d'un effet lancé après.
 */
export function useAdvisorWeather(options?: { enabled?: boolean; client?: WeatherClient }) {
  const enabled = options?.enabled ?? true;
  const clientRef = useRef(options?.client);
  clientRef.current = options?.client;
  const abortRef = useRef<AbortController | null>(null);
  const [state, setState] = useState<AdvisorWeatherState>(INITIAL);

  const run = useCallback((force: boolean) => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const client = clientRef.current ?? browserWeatherClient();
    setState((prev) => ({ ...prev, phase: "loading", reason: null }));
    void loadAdvisorWeather(client, { force, signal: ac.signal })
      .then((result) => {
        if (ac.signal.aborted) return;
        if (result.ok) {
          setState({
            phase: "ready",
            snapshot: result.snapshot,
            fromCache: result.fromCache,
            reason: null,
          });
          return;
        }
        setState((prev) =>
          prev.snapshot
            ? {
                phase: "ready",
                snapshot: prev.snapshot,
                fromCache: prev.fromCache,
                reason: result.reason,
              }
            : { phase: "error", snapshot: null, fromCache: false, reason: result.reason },
        );
      })
      .catch((error: unknown) => {
        if (ac.signal.aborted || isAbortError(error)) return;
        setState((prev) =>
          prev.snapshot
            ? { ...prev, phase: "ready", reason: "api" }
            : { phase: "error", snapshot: null, fromCache: false, reason: "api" },
        );
      });
  }, []);

  useEffect(() => {
    if (!enabled) return;
    run(false);
    return () => abortRef.current?.abort();
  }, [enabled, run]);

  return { state, retry: () => run(true) };
}
