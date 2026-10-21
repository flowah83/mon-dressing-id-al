import { describe, expect, it, vi } from "vitest";
import {
  adviceTemperature,
  fetchWeatherAt,
  formatWeatherLines,
  freshnessLabel,
  loadAdvisorWeather,
  placeNameFromReverse,
  precipitationKind,
  readWeatherCache,
  roundCoord,
  sanitizeAdviceWeather,
  temperatureWasClamped,
  toAdviceWeather,
  toWeatherHints,
  weatherLabel,
  writeWeatherCache,
  type WeatherClient,
  type WeatherSnapshot,
} from "./weather";

const NOW = 1_700_000_000_000;

function snapshot(extra: Partial<WeatherSnapshot> = {}): WeatherSnapshot {
  return {
    fetchedAt: NOW,
    latitude: 45.76,
    longitude: 4.84,
    placeName: "Lyon",
    temperature: 14,
    feelsLike: 10.9,
    precipitationMm: 0.3,
    weatherCode: 80,
    windKmh: 17.2,
    today: {
      tempMin: 8.4,
      tempMax: 14.5,
      precipitationSumMm: 2.3,
      precipitationProbability: 35,
      windMaxKmh: 22.5,
      weatherCode: 80,
    },
    ...extra,
  };
}

function memory(initial?: Record<string, string>) {
  const map = new Map(Object.entries(initial ?? {}));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
}

const forecastJson = {
  current: {
    temperature_2m: 14,
    apparent_temperature: 10.9,
    precipitation: 0.3,
    weather_code: 80,
    wind_speed_10m: 17.2,
  },
  daily: {
    temperature_2m_max: [14.5],
    temperature_2m_min: [8.4],
    precipitation_sum: [2.3],
    precipitation_probability_max: [35],
    wind_speed_10m_max: [22.5],
    weather_code: [80],
  },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("météo", () => {
  it("arrondit la position au centième de degré", () => {
    expect(roundCoord(48.8566)).toBe(48.86);
    expect(roundCoord(2.3522)).toBe(2.35);
  });

  it("propose le ressenti, borné au curseur", () => {
    expect(adviceTemperature(snapshot())).toBe(11);
    expect(adviceTemperature(snapshot({ feelsLike: -18.2 }))).toBe(-15);
    expect(adviceTemperature(snapshot({ feelsLike: 46 }))).toBe(40);
    expect(temperatureWasClamped(snapshot({ feelsLike: -18.2 }))).toBe(true);
    expect(temperatureWasClamped(snapshot())).toBe(false);
  });

  it("reconnaît la pluie, la neige et le temps sec", () => {
    expect(precipitationKind({ currentCode: 80, probability: 10 })).toBe("rain");
    expect(precipitationKind({ currentCode: 0, probability: 40 })).toBe("rain");
    expect(precipitationKind({ currentCode: 71, probability: 80, precipitationMm: 4 })).toBe(
      "snow",
    );
    expect(precipitationKind({ currentCode: 1, dailyCode: 61, probability: 10 })).toBe("rain");
    expect(precipitationKind({ currentCode: 2, probability: 10, precipitationMm: 0 })).toBe("none");
  });

  it("préfère la ville au quartier", () => {
    expect(placeNameFromReverse({ city: "Paris", locality: "Saint-Merri" })).toBe("Paris");
    expect(placeNameFromReverse({ city: "  ", locality: "Lyon" })).toBe("Lyon");
    expect(placeNameFromReverse({ principalSubdivision: "Bretagne" })).toBe("Bretagne");
    expect(placeNameFromReverse(null)).toBeNull();
  });

  it("décrit le temps en français", () => {
    expect(weatherLabel(80)).toBe("Averses");
    expect(weatherLabel(71)).toBe("Neige");
    expect(weatherLabel(0)).toBe("Ciel dégagé");
    const lines = formatWeatherLines(snapshot());
    expect(lines.title).toBe("Lyon · 14 °C");
    expect(lines.detail).toBe("Ressenti 11 °C · aujourd'hui 8 à 15 °C");
    expect(lines.meta).toContain("Averses");
    expect(lines.meta).toContain("risque de pluie 35 %");
    expect(freshnessLabel(NOW, NOW + 30_000)).toBe("à l'instant");
    expect(freshnessLabel(NOW, NOW + 5 * 60_000)).toBe("il y a 5 minutes");
  });

  it("prépare un contexte pluie et vent pour le conseil", () => {
    const hints = toWeatherHints(snapshot());
    expect(hints).toEqual({ precipitation: "rain", windKmh: 22.5 });
    const advice = toAdviceWeather(snapshot());
    expect(advice.place).toBe("Lyon");
    expect(advice.conditions).toBe("Averses");
    expect(advice.feelsLike).toBe(10.9);
    expect(
      sanitizeAdviceWeather({
        temperature: 14,
        feelsLike: 11,
        windKmh: 20,
        precipitation: "rain",
        place: "  Lyon  ",
        precipitationProbability: 140,
      }),
    ).toMatchObject({
      place: "Lyon",
      precipitation: "rain",
      precipitationProbability: 100,
    });
    expect(sanitizeAdviceWeather({ temperature: "chaud" })).toBeUndefined();
  });

  it("garde la météo 30 minutes et ignore un cache illisible ou périmé", () => {
    const storage = memory();
    writeWeatherCache(storage, snapshot());
    expect(readWeatherCache(storage, NOW + 10 * 60_000)?.placeName).toBe("Lyon");
    expect(readWeatherCache(storage, NOW + 31 * 60_000)).toBeNull();
    expect(readWeatherCache(memory({ "vestiaire.weather.v1": "{" }), NOW)).toBeNull();
    expect(
      readWeatherCache(memory({ "vestiaire.weather.v1": JSON.stringify({ fetchedAt: NOW }) }), NOW),
    ).toBeNull();
    expect(() =>
      writeWeatherCache(
        {
          setItem: () => {
            throw new Error("quota");
          },
        },
        snapshot(),
      ),
    ).not.toThrow();
  });

  it("lit la prévision et le nom du lieu, même si le lieu échoue", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("open-meteo.com")) {
        expect(url).toContain("latitude=48.86");
        expect(url).toContain("longitude=2.35");
        return jsonResponse(forecastJson);
      }
      if (url.includes("bigdatacloud"))
        return jsonResponse({ city: "Paris", locality: "Saint-Merri" });
      throw new Error(url);
    });
    const snap = await fetchWeatherAt(48.8566, 2.3522, { fetch: fetchMock, now: () => NOW });
    expect(snap.placeName).toBe("Paris");
    expect(snap.feelsLike).toBe(10.9);
    expect(snap.today.tempMin).toBe(8.4);
    expect(adviceTemperature(snap)).toBe(11);

    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("open-meteo.com")) return jsonResponse(forecastJson);
      return jsonResponse({ error: true }, 500);
    });
    const withoutPlace = await fetchWeatherAt(48.85, 2.35, { fetch: fetchMock, now: () => NOW });
    expect(withoutPlace.placeName).toBeNull();
    expect(withoutPlace.temperature).toBe(14);
  });

  it("signale une météo injoignable", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ error: true }, 503));
    await expect(
      fetchWeatherAt(48.85, 2.35, { fetch: fetchMock, now: () => NOW }),
    ).rejects.toMatchObject({ reason: "api" });
  });

  it("réutilise le cache et sinon gère refus, hors-ligne et succès", async () => {
    const cached = snapshot();
    const storage = memory();
    writeWeatherCache(storage, cached);
    const geo = { getCurrentPosition: vi.fn() };
    const client: WeatherClient = {
      geolocation: geo,
      online: true,
      fetch: vi.fn(),
      storage,
      now: () => NOW + 1000,
    };
    const hit = await loadAdvisorWeather(client);
    expect(hit).toMatchObject({ ok: true, fromCache: true });
    expect(geo.getCurrentPosition).not.toHaveBeenCalled();

    const denied = await loadAdvisorWeather(
      {
        ...client,
        storage: memory(),
        geolocation: {
          getCurrentPosition: (_success, error) => error?.({ code: 1 }),
        },
      },
      { force: true },
    );
    expect(denied).toEqual({ ok: false, reason: "denied" });

    const timeout = await loadAdvisorWeather(
      {
        ...client,
        storage: memory(),
        geolocation: { getCurrentPosition: (_s, error) => error?.({ code: 3 }) },
      },
      { force: true },
    );
    expect(timeout).toEqual({ ok: false, reason: "timeout" });

    const offline = await loadAdvisorWeather({
      ...client,
      storage: memory(),
      online: false,
      geolocation: geo,
    });
    expect(offline).toEqual({ ok: false, reason: "offline" });
    expect(geo.getCurrentPosition).not.toHaveBeenCalled();

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("open-meteo.com")) return jsonResponse(forecastJson);
      return jsonResponse({ locality: "Nantes" });
    });
    const freshStorage = memory();
    const loaded = await loadAdvisorWeather({
      geolocation: {
        getCurrentPosition: (success) =>
          success({ coords: { latitude: 47.218, longitude: -1.554 } }),
      },
      online: true,
      fetch: fetchMock,
      storage: freshStorage,
      now: () => NOW,
    });
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(loaded.fromCache).toBe(false);
      expect(loaded.snapshot.placeName).toBe("Nantes");
      expect(readWeatherCache(freshStorage, NOW)?.placeName).toBe("Nantes");
    }
  });
});
