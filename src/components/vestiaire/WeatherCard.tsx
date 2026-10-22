import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Loader2,
  Sun,
  type LucideIcon,
} from "lucide-react";
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

function weatherKind(code: number): "sun" | "cloud" | "fog" | "rain" | "snow" | "storm" {
  if (code === 0 || code === 1) return "sun";
  if (code === 45 || code === 48) return "fog";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code >= 95) return "storm";
  return "cloud";
}

function weatherIcon(code: number): LucideIcon {
  if (code === 0) return Sun;
  if (code === 1 || code === 2) return CloudSun;
  if (code === 45 || code === 48) return CloudFog;
  if (code >= 51 && code <= 57) return CloudDrizzle;
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return CloudRain;
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return CloudSnow;
  if (code >= 95) return CloudLightning;
  return Cloud;
}

export function WeatherGlyph({ code }: { code: number }) {
  const Icon = weatherIcon(code);
  return (
    <span className="weather-glyph" data-kind={weatherKind(code)}>
      <Icon className="size-3.5" strokeWidth={1.75} aria-hidden />
    </span>
  );
}

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
        {snapshot ? (
          <WeatherGlyph code={snapshot.weatherCode} />
        ) : (
          <CloudSun className="size-4 text-primary" strokeWidth={1.75} aria-hidden />
        )}
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
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {manual && snapshot && (
            <Button type="button" className="min-h-11 w-full sm:w-auto" onClick={onUseForecast}>
              Revenir au ressenti ({adviceTemperature(snapshot)} °C)
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={onRetry}
            disabled={state.phase === "loading"}
          >
            {state.phase === "loading" ? "Mise à jour…" : retryLabel}
          </Button>
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
