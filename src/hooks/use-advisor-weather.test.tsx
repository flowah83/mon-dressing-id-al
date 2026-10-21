import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WEATHER_CACHE_KEY, type WeatherClient, type WeatherSnapshot } from "@/lib/weather";
import { useAdvisorWeather } from "./use-advisor-weather";

const NOW = 1_700_000_000_000;

const snapshot: WeatherSnapshot = {
  fetchedAt: NOW,
  latitude: 45.76,
  longitude: 4.84,
  placeName: "Lyon",
  temperature: 14,
  feelsLike: 11,
  precipitationMm: 0,
  weatherCode: 2,
  windKmh: 10,
  today: {
    tempMin: 8,
    tempMax: 15,
    precipitationSumMm: 0,
    precipitationProbability: 10,
    windMaxKmh: 12,
    weatherCode: 2,
  },
};

function storage(raw?: string) {
  const map = new Map<string, string>();
  if (raw) map.set(WEATHER_CACHE_KEY, raw);
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
}

function client(partial: Partial<WeatherClient>): WeatherClient {
  return {
    geolocation: { getCurrentPosition: vi.fn() },
    online: true,
    fetch: vi.fn(),
    storage: storage(),
    now: () => NOW + 1000,
    ...partial,
  };
}

describe("useAdvisorWeather", () => {
  it("préremplit depuis le cache sans géolocalisation", async () => {
    const geo = { getCurrentPosition: vi.fn() };
    const { result } = renderHook(() =>
      useAdvisorWeather({
        client: client({ geolocation: geo, storage: storage(JSON.stringify(snapshot)) }),
      }),
    );
    await waitFor(() => expect(result.current.state.phase).toBe("ready"));
    expect(result.current.state.fromCache).toBe(true);
    expect(result.current.state.snapshot?.placeName).toBe("Lyon");
    expect(geo.getCurrentPosition).not.toHaveBeenCalled();
  });

  it("reste utilisable si la position est refusée", async () => {
    const { result } = renderHook(() =>
      useAdvisorWeather({
        client: client({
          geolocation: { getCurrentPosition: (_success, error) => error?.({ code: 1 }) },
        }),
      }),
    );
    await waitFor(() => expect(result.current.state.phase).toBe("error"));
    expect(result.current.state.reason).toBe("denied");
    expect(result.current.state.snapshot).toBeNull();
  });

  it("relance la localisation depuis le bouton", async () => {
    let calls = 0;
    const { result } = renderHook(() =>
      useAdvisorWeather({
        client: client({
          geolocation: {
            getCurrentPosition: (_success, error) => {
              calls += 1;
              error?.({ code: 1 });
            },
          },
        }),
      }),
    );
    await waitFor(() => expect(calls).toBe(1));
    act(() => result.current.retry());
    await waitFor(() => expect(calls).toBe(2));
  });
});
