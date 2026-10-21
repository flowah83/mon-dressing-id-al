import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AdvisorWeatherState } from "@/hooks/use-advisor-weather";
import type { WeatherSnapshot } from "@/lib/weather";
import { WeatherCard } from "./WeatherCard";

const NOW = 1_700_000_000_000;

const snapshot: WeatherSnapshot = {
  fetchedAt: NOW,
  latitude: 45.76,
  longitude: 4.84,
  placeName: "Lyon",
  temperature: 14,
  feelsLike: 10.9,
  precipitationMm: 0.3,
  weatherCode: 80,
  windKmh: 17,
  today: {
    tempMin: 8.4,
    tempMax: 14.5,
    precipitationSumMm: 2.3,
    precipitationProbability: 35,
    windMaxKmh: 22.5,
    weatherCode: 80,
  },
};

function state(
  partial: Partial<AdvisorWeatherState> & Pick<AdvisorWeatherState, "phase">,
): AdvisorWeatherState {
  return { snapshot: null, fromCache: false, reason: null, ...partial };
}

describe("carte météo", () => {
  it("explique pourquoi la position est demandée", () => {
    render(
      <WeatherCard
        state={state({ phase: "loading" })}
        manual={false}
        onRetry={vi.fn()}
        onUseForecast={vi.fn()}
      />,
    );
    expect(screen.getByText(/uniquement pour connaître le temps/i)).toBeInTheDocument();
    expect(screen.getByText(/curseur de température reste utilisable/i)).toBeInTheDocument();
  });

  it("affiche la ville, le ressenti et la source", () => {
    render(
      <WeatherCard
        state={state({ phase: "ready", snapshot, fromCache: true })}
        manual={false}
        now={NOW + 60_000}
        onRetry={vi.fn()}
        onUseForecast={vi.fn()}
      />,
    );
    expect(screen.getByText("Lyon · 14 °C")).toBeInTheDocument();
    expect(screen.getByText(/Ressenti 11 °C/)).toBeInTheDocument();
    expect(screen.getByText(/Open-Meteo/)).toBeInTheDocument();
    expect(screen.getByText(/il y a 1 minute/)).toBeInTheDocument();
  });

  it("explique un refus et relance depuis le bouton", () => {
    const onRetry = vi.fn();
    render(
      <WeatherCard
        state={state({ phase: "error", reason: "denied" })}
        manual={false}
        onRetry={onRetry}
        onUseForecast={vi.fn()}
      />,
    );
    expect(screen.getByText(/localisation a été refusée/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Utiliser ma position" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("permet de revenir au ressenti après un réglage manuel", () => {
    const onUseForecast = vi.fn();
    render(
      <WeatherCard
        state={state({ phase: "ready", snapshot })}
        manual
        now={NOW}
        onRetry={vi.fn()}
        onUseForecast={onUseForecast}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Revenir au ressenti (11 °C)" }));
    expect(onUseForecast).toHaveBeenCalledOnce();
  });

  it("reste sur la saisie manuelle hors ligne", () => {
    render(
      <WeatherCard
        state={state({ phase: "error", reason: "offline" })}
        manual={false}
        onRetry={vi.fn()}
        onUseForecast={vi.fn()}
      />,
    );
    expect(screen.getByText(/hors ligne/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Réessayer" })).toBeInTheDocument();
  });
});
