import { CloudSun, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AdvisorWeatherState } from "@/hooks/use-advisor-weather";
import {
  adviceTemperature,
  formatWeatherLines,
  freshnessLabel,
  temperatureWasClamped,
  weatherErrorText,
  weatherRefreshErrorText,
  type WeatherFailure,
} from "@/lib/weather";

export function WeatherCard({
  state,
  manual,
  now = Date.now(),
  onRetry,
  onUseForecast,
}: {
  state: AdvisorWeatherState;
  manual: boolean;
  now?: number;
  onRetry: () => void;
  onUseForecast: () => void;
}) {
  const snapshot = state.snapshot;
  const retryLabel = snapshot ? "Actualiser" : positionLabel(state.reason);

  return (
    <section aria-live="polite" className="rounded-3xl bg-card p-5 shadow-soft">
      <div className="flex items-center gap-2">
        <CloudSun className="size-4 text-primary" aria-hidden />
        <p className="eyebrow">Météo du jour</p>
      </div>

      {snapshot ? (
        <WeatherSummary state={state} now={now} />
      ) : state.phase === "error" && state.reason ? (
        <p className="mt-3 text-sm leading-relaxed">{weatherErrorText(state.reason)}</p>
      ) : (
        <div className="mt-3 space-y-2">
          <p className="flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Localisation en cours pour lire la météo près de vous…
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Vestiaire demande votre position uniquement pour connaître le temps qu'il fait. Elle
            n'est pas enregistrée dans votre dressing. Vous pouvez refuser : le curseur de
            température reste utilisable.
          </p>
        </div>
      )}

      {(snapshot || state.phase === "error") && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRetry}
            disabled={state.phase === "loading"}
          >
            {state.phase === "loading" ? "Mise à jour…" : retryLabel}
          </Button>
          {manual && snapshot && (
            <Button type="button" variant="outline" size="sm" onClick={onUseForecast}>
              Revenir au ressenti ({adviceTemperature(snapshot)} °C)
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

function WeatherSummary({ state, now }: { state: AdvisorWeatherState; now: number }) {
  const snapshot = state.snapshot!;
  const lines = formatWeatherLines(snapshot);
  return (
    <div className="mt-3 space-y-1">
      <p className="text-2xl leading-tight">{lines.title}</p>
      <p className="text-sm">{lines.detail}</p>
      <p className="text-sm text-muted-foreground">{lines.meta}</p>
      {temperatureWasClamped(snapshot) && (
        <p className="text-sm text-muted-foreground">
          Le ressenti ({Math.round(snapshot.feelsLike)} °C) dépasse le curseur : la température
          proposée est {adviceTemperature(snapshot)} °C.
        </p>
      )}
      {state.phase === "loading" && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Mise à jour…
        </p>
      )}
      {state.reason && (
        <p className="text-sm text-muted-foreground">{weatherRefreshErrorText(state.reason)}</p>
      )}
      <p className="pt-2 text-xs text-muted-foreground">
        Météo Open-Meteo · lieu BigDataCloud · mise à jour {freshnessLabel(snapshot.fetchedAt, now)}
        . La position n'est pas gardée dans le dressing.
      </p>
    </div>
  );
}

function positionLabel(reason: WeatherFailure | null): string {
  if (reason === "denied" || reason === "unavailable" || reason === "timeout")
    return "Utiliser ma position";
  return "Réessayer";
}
