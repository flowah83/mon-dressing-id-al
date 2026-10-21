/** Météo locale pour le conseiller : Open-Meteo (prévision) et BigDataCloud (nom du lieu), sans clé. */

export const WEATHER_CACHE_MS = 30 * 60 * 1000;
export const WEATHER_CACHE_KEY = "vestiaire.weather.v1";
export const TEMP_MIN = -15;
export const TEMP_MAX = 40;

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const REVERSE_URL = "https://api.bigdatacloud.net/data/reverse-geocode-client";

export type WeatherFailure = "denied" | "unavailable" | "timeout" | "offline" | "api";
export type Precipitation = "none" | "rain" | "snow";

export interface DailyForecast {
  tempMin: number;
  tempMax: number;
  precipitationSumMm: number;
  precipitationProbability: number | null;
  windMaxKmh: number;
  weatherCode: number;
}

export interface WeatherSnapshot {
  fetchedAt: number;
  latitude: number;
  longitude: number;
  placeName: string | null;
  temperature: number;
  feelsLike: number;
  precipitationMm: number;
  weatherCode: number;
  windKmh: number;
  today: DailyForecast;
}

/** Ce que le moteur de tenues consomme (pluie / vent), en plus de la température choisie. */
export interface WeatherHints {
  precipitation: Precipitation;
  windKmh: number;
}

/** Contexte météo transmis au conseil IA, déjà nettoyé. */
export interface AdviceWeather {
  place?: string;
  temperature: number;
  feelsLike: number;
  precipitation: Precipitation;
  precipitationProbability?: number;
  windKmh: number;
  conditions: string;
}

export class WeatherError extends Error {
  readonly reason: WeatherFailure;
  constructor(reason: WeatherFailure) {
    super(reason);
    this.name = "WeatherError";
    this.reason = reason;
  }
}

export interface GeoReader {
  getCurrentPosition(
    success: (pos: { coords: { latitude: number; longitude: number } }) => void,
    error?: ((err: { code: number }) => void) | null,
    options?: PositionOptions,
  ): void;
}

export interface WeatherClient {
  geolocation: GeoReader | null;
  online: boolean;
  fetch: typeof fetch;
  storage: Pick<Storage, "getItem" | "setItem"> | null;
  now: () => number;
}

export type WeatherLoad =
  | { ok: true; snapshot: WeatherSnapshot; fromCache: boolean }
  | { ok: false; reason: WeatherFailure };

export function browserWeatherClient(): WeatherClient {
  const nav = typeof navigator === "undefined" ? undefined : navigator;
  return {
    geolocation: nav?.geolocation ?? null,
    online: nav ? nav.onLine : true,
    fetch: globalThis.fetch.bind(globalThis),
    storage: typeof localStorage === "undefined" ? null : localStorage,
    now: () => Date.now(),
  };
}

export function roundCoord(n: number): number {
  return Math.round(n * 100) / 100;
}

export function adviceTemperature(snapshot: WeatherSnapshot): number {
  return clamp(Math.round(snapshot.feelsLike), TEMP_MIN, TEMP_MAX);
}

export function temperatureWasClamped(snapshot: WeatherSnapshot): boolean {
  const rounded = Math.round(snapshot.feelsLike);
  return rounded < TEMP_MIN || rounded > TEMP_MAX;
}

export function weatherLabel(code: number): string {
  if (code === 0) return "Ciel dégagé";
  if (code === 1) return "Peu nuageux";
  if (code === 2) return "Partiellement nuageux";
  if (code === 3) return "Couvert";
  if (code === 45 || code === 48) return "Brouillard";
  if (code >= 51 && code <= 55) return "Bruine";
  if (code >= 56 && code <= 57) return "Bruine verglaçante";
  if (code >= 61 && code <= 65) return "Pluie";
  if (code >= 66 && code <= 67) return "Pluie verglaçante";
  if (code >= 71 && code <= 77) return "Neige";
  if (code >= 80 && code <= 82) return "Averses";
  if (code === 85 || code === 86) return "Averses de neige";
  if (code >= 95) return "Orage";
  return "Temps variable";
}

export function precipitationKind(input: {
  currentCode?: number;
  dailyCode?: number;
  precipitationMm?: number;
  dailyPrecipitationMm?: number;
  probability?: number | null;
}): Precipitation {
  const codes = [input.currentCode, input.dailyCode].filter(
    (c): c is number => typeof c === "number",
  );
  if (codes.some(isSnowCode)) return "snow";
  if (codes.some(isRainCode)) return "rain";
  if (
    (input.precipitationMm ?? 0) >= 0.5 ||
    (input.dailyPrecipitationMm ?? 0) >= 1 ||
    (input.probability ?? 0) >= 40
  ) {
    return "rain";
  }
  return "none";
}

export function toWeatherHints(snapshot: WeatherSnapshot): WeatherHints {
  return {
    precipitation: precipitationKind({
      currentCode: snapshot.weatherCode,
      dailyCode: snapshot.today.weatherCode,
      precipitationMm: snapshot.precipitationMm,
      dailyPrecipitationMm: snapshot.today.precipitationSumMm,
      probability: snapshot.today.precipitationProbability,
    }),
    windKmh: Math.max(snapshot.windKmh, snapshot.today.windMaxKmh),
  };
}

export function toAdviceWeather(snapshot: WeatherSnapshot): AdviceWeather {
  const hints = toWeatherHints(snapshot);
  const advice: AdviceWeather = {
    temperature: snapshot.temperature,
    feelsLike: snapshot.feelsLike,
    precipitation: hints.precipitation,
    windKmh: hints.windKmh,
    conditions: weatherLabel(snapshot.weatherCode),
  };
  if (snapshot.placeName) advice.place = snapshot.placeName;
  if (snapshot.today.precipitationProbability != null) {
    advice.precipitationProbability = snapshot.today.precipitationProbability;
  }
  return advice;
}

export function sanitizeAdviceWeather(input: unknown): AdviceWeather | undefined {
  if (!input || typeof input !== "object") return undefined;
  const w = input as Record<string, unknown>;
  const temperature = finite(w["temperature"]);
  const feelsLike = finite(w["feelsLike"]);
  const windKmh = finite(w["windKmh"]);
  if (temperature == null || feelsLike == null || windKmh == null) return undefined;
  const precipitation: Precipitation =
    w["precipitation"] === "rain" || w["precipitation"] === "snow" ? w["precipitation"] : "none";
  const advice: AdviceWeather = {
    temperature,
    feelsLike,
    precipitation,
    windKmh,
    conditions:
      typeof w["conditions"] === "string" ? w["conditions"].trim().slice(0, 40) : "Temps variable",
  };
  if (typeof w["place"] === "string" && w["place"].trim())
    advice.place = w["place"].trim().slice(0, 80);
  const probability = finite(w["precipitationProbability"]);
  if (probability != null) advice.precipitationProbability = clamp(probability, 0, 100);
  return advice;
}

export function placeNameFromReverse(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  const city = text(o["city"]);
  if (city) return city;
  const locality = text(o["locality"]);
  if (locality) return locality;
  return text(o["principalSubdivision"]);
}

export function formatWeatherLines(snapshot: WeatherSnapshot): {
  title: string;
  detail: string;
  meta: string;
} {
  const place = snapshot.placeName ?? "Près de vous";
  const kind = toWeatherHints(snapshot).precipitation;
  const bits = [weatherLabel(snapshot.weatherCode)];
  if (kind === "snow") bits.push("neige");
  else if (snapshot.today.precipitationProbability != null) {
    bits.push(`risque de pluie ${Math.round(snapshot.today.precipitationProbability)} %`);
  } else if (kind === "rain") bits.push("pluie");
  bits.push(`vent ${Math.round(snapshot.windKmh)} km/h`);
  if (snapshot.today.windMaxKmh >= snapshot.windKmh + 5) {
    bits.push(`jusqu'à ${Math.round(snapshot.today.windMaxKmh)} km/h aujourd'hui`);
  }
  return {
    title: `${place} · ${Math.round(snapshot.temperature)} °C`,
    detail: `Ressenti ${Math.round(snapshot.feelsLike)} °C · aujourd'hui ${Math.round(snapshot.today.tempMin)} à ${Math.round(snapshot.today.tempMax)} °C`,
    meta: bits.join(" · "),
  };
}

export function freshnessLabel(fetchedAt: number, now: number): string {
  const minutes = Math.max(0, Math.floor((now - fetchedAt) / 60000));
  if (minutes < 1) return "à l'instant";
  if (minutes === 1) return "il y a 1 minute";
  return `il y a ${minutes} minutes`;
}

export function weatherErrorText(reason: WeatherFailure): string {
  switch (reason) {
    case "denied":
      return "La localisation a été refusée. Indiquez la température avec le curseur. Pour la météo automatique, autorisez la position dans les réglages du navigateur, puis touchez Utiliser ma position.";
    case "offline":
      return "Vous êtes hors ligne. La météo n'a pas pu être lue : indiquez la température avec le curseur.";
    case "timeout":
      return "La localisation a pris trop de temps. Indiquez la température avec le curseur, ou touchez Utiliser ma position.";
    case "unavailable":
      return "La localisation n'est pas disponible sur cet appareil. Indiquez la température avec le curseur.";
    case "api":
      return "Le service météo ne répond pas. Indiquez la température avec le curseur.";
  }
}

export function weatherRefreshErrorText(reason: WeatherFailure): string {
  switch (reason) {
    case "offline":
      return "Pas de connexion : la météo affichée n'a pas pu être mise à jour.";
    case "denied":
      return "Localisation refusée : la météo affichée n'a pas pu être mise à jour.";
    default:
      return "La météo n'a pas pu être mise à jour. Les informations affichées restent les dernières reçues.";
  }
}

export function readWeatherCache(
  storage: Pick<Storage, "getItem"> | null,
  now: number,
  maxAge = WEATHER_CACHE_MS,
): WeatherSnapshot | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(WEATHER_CACHE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isSnapshot(parsed)) return null;
    if (now - parsed.fetchedAt > maxAge) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeWeatherCache(
  storage: Pick<Storage, "setItem"> | null,
  snapshot: WeatherSnapshot,
): void {
  if (!storage) return;
  try {
    storage.setItem(WEATHER_CACHE_KEY, JSON.stringify(snapshot));
  } catch {
    /* quota ou navigation privée : la météo reste valable pour cette visite */
  }
}

export function parseForecast(
  json: unknown,
  meta: { latitude: number; longitude: number; placeName: string | null; fetchedAt: number },
): WeatherSnapshot {
  const root = record(json);
  const current = record(root?.["current"]);
  const daily = record(root?.["daily"]);
  if (!current || !daily) throw new WeatherError("api");

  const temperature = finite(current["temperature_2m"]);
  const feelsLike = finite(current["apparent_temperature"]);
  const precipitationMm = finite(current["precipitation"]);
  const weatherCode = finite(current["weather_code"]);
  const windKmh = finite(current["wind_speed_10m"]);
  const tempMin = finite(first(daily["temperature_2m_min"]));
  const tempMax = finite(first(daily["temperature_2m_max"]));
  const precipitationSumMm = finite(first(daily["precipitation_sum"]));
  const windMaxKmh = finite(first(daily["wind_speed_10m_max"]));
  const dailyCode = finite(first(daily["weather_code"]));
  const probabilityRaw = first(daily["precipitation_probability_max"]);
  const precipitationProbability = probabilityRaw == null ? null : finite(probabilityRaw);

  if (
    temperature == null ||
    feelsLike == null ||
    precipitationMm == null ||
    weatherCode == null ||
    windKmh == null ||
    tempMin == null ||
    tempMax == null ||
    precipitationSumMm == null ||
    windMaxKmh == null ||
    dailyCode == null ||
    (probabilityRaw != null && precipitationProbability == null)
  ) {
    throw new WeatherError("api");
  }

  return {
    fetchedAt: meta.fetchedAt,
    latitude: meta.latitude,
    longitude: meta.longitude,
    placeName: meta.placeName,
    temperature,
    feelsLike,
    precipitationMm,
    weatherCode,
    windKmh,
    today: {
      tempMin,
      tempMax,
      precipitationSumMm,
      precipitationProbability,
      windMaxKmh,
      weatherCode: dailyCode,
    },
  };
}

export async function fetchWeatherAt(
  latitude: number,
  longitude: number,
  client: Pick<WeatherClient, "fetch" | "now">,
  signal?: AbortSignal,
): Promise<WeatherSnapshot> {
  const lat = roundCoord(latitude);
  const lon = roundCoord(longitude);
  const url = new URL(FORECAST_URL);
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set(
    "current",
    "temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m",
  );
  url.searchParams.set(
    "daily",
    "temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,weather_code",
  );
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "1");
  url.searchParams.set("wind_speed_unit", "kmh");

  let response: Response;
  try {
    response = await client.fetch(url, signal ? { signal } : undefined);
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new WeatherError("api");
  }
  if (!response.ok) throw new WeatherError("api");
  let json: unknown;
  try {
    json = await response.json();
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new WeatherError("api");
  }
  const placeName = await reversePlace(lat, lon, client.fetch, signal);
  return parseForecast(json, { latitude: lat, longitude: lon, placeName, fetchedAt: client.now() });
}

export function requestPosition(
  geo: GeoReader,
  signal?: AbortSignal,
): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const onAbort = () => {
      reject(abortError());
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    geo.getCurrentPosition(
      (pos) => {
        signal?.removeEventListener("abort", onAbort);
        resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      },
      (err) => {
        signal?.removeEventListener("abort", onAbort);
        reject(new WeatherError(positionErrorReason(err.code)));
      },
      { enableHighAccuracy: false, timeout: 20000, maximumAge: WEATHER_CACHE_MS },
    );
  });
}

export async function loadAdvisorWeather(
  client: WeatherClient,
  options?: { force?: boolean; signal?: AbortSignal },
): Promise<WeatherLoad> {
  const now = client.now();
  if (!options?.force) {
    const cached = readWeatherCache(client.storage, now);
    if (cached) return { ok: true, snapshot: cached, fromCache: true };
  }
  if (!client.online) return { ok: false, reason: "offline" };
  if (!client.geolocation) return { ok: false, reason: "unavailable" };
  try {
    const coords = await requestPosition(client.geolocation, options?.signal);
    const snapshot = await fetchWeatherAt(
      coords.latitude,
      coords.longitude,
      client,
      options?.signal,
    );
    writeWeatherCache(client.storage, snapshot);
    return { ok: true, snapshot, fromCache: false };
  } catch (error) {
    if (isAbortError(error)) throw error;
    if (error instanceof WeatherError) return { ok: false, reason: error.reason };
    return { ok: false, reason: "api" };
  }
}

export function isAbortError(error: unknown): boolean {
  return (error instanceof DOMException || error instanceof Error) && error.name === "AbortError";
}

function positionErrorReason(code: number): WeatherFailure {
  if (code === 1) return "denied";
  if (code === 3) return "timeout";
  return "unavailable";
}

async function reversePlace(
  lat: number,
  lon: number,
  fetchImpl: typeof fetch,
  signal?: AbortSignal,
): Promise<string | null> {
  try {
    const url = new URL(REVERSE_URL);
    url.searchParams.set("latitude", String(lat));
    url.searchParams.set("longitude", String(lon));
    url.searchParams.set("localityLanguage", "fr");
    const response = await fetchImpl(url, signal ? { signal } : undefined);
    if (!response.ok) return null;
    return placeNameFromReverse(await response.json());
  } catch (error) {
    if (isAbortError(error)) throw error;
    return null;
  }
}

function isRainCode(code: number): boolean {
  return (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95;
}

function isSnowCode(code: number): boolean {
  return (code >= 71 && code <= 77) || code === 85 || code === 86;
}

function isSnapshot(value: unknown): value is WeatherSnapshot {
  if (!value || typeof value !== "object") return false;
  const s = value as WeatherSnapshot;
  return (
    typeof s.fetchedAt === "number" &&
    typeof s.latitude === "number" &&
    typeof s.longitude === "number" &&
    (s.placeName === null || typeof s.placeName === "string") &&
    typeof s.temperature === "number" &&
    typeof s.feelsLike === "number" &&
    typeof s.precipitationMm === "number" &&
    typeof s.weatherCode === "number" &&
    typeof s.windKmh === "number" &&
    !!s.today &&
    typeof s.today.tempMin === "number" &&
    typeof s.today.tempMax === "number" &&
    typeof s.today.precipitationSumMm === "number" &&
    (s.today.precipitationProbability === null ||
      typeof s.today.precipitationProbability === "number") &&
    typeof s.today.windMaxKmh === "number" &&
    typeof s.today.weatherCode === "number"
  );
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function first(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : undefined;
}

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function abortError(): DOMException {
  return new DOMException("aborted", "AbortError");
}
