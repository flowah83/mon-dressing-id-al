import { compressImage, flattenOnNeutral } from "./image";

/**
 * Largest side sent to the segmentation model.
 * iPhone Safari has a small WASM heap, so the photo is reduced before the model runs.
 */
export function cutoutMaxSide(env: {
  deviceMemory?: number | undefined;
  width?: number | undefined;
  ios?: boolean | undefined;
}): number {
  if (env.ios) return 640;
  if (typeof env.deviceMemory === "number" && env.deviceMemory > 0 && env.deviceMemory <= 4)
    return 640;
  if (typeof env.width === "number" && env.width > 0 && env.width < 900) return 768;
  return 1024;
}

/** Stored JPEG size. Low-memory phones keep the same small file the model saw. */
export function storageMaxSide(env: {
  deviceMemory?: number | undefined;
  width?: number | undefined;
  ios?: boolean | undefined;
}): number {
  const cut = cutoutMaxSide(env);
  if (env.ios) return cut;
  if (typeof env.deviceMemory === "number" && env.deviceMemory > 0 && env.deviceMemory <= 4)
    return cut;
  return 1400;
}

/**
 * Threaded WASM needs cross-origin isolation, which this app does not enable
 * (it would block fonts, the account and the model CDN). One thread still runs on iPhone.
 */
export function cutoutThreadCount(isolated: boolean, cores: number): number {
  if (!isolated) return 1;
  if (!Number.isFinite(cores) || cores < 1) return 1;
  return Math.min(4, Math.floor(cores));
}

export function cutoutProgressLabel(key: string, current: number, total: number): string {
  const ratio = total > 0 ? Math.min(100, Math.max(0, Math.round((current / total) * 100))) : 0;
  if (ratio > 0) return `Détourage en cours… ${ratio} %`;
  if (key.startsWith("fetch")) return "Détourage en cours…";
  return "Détourage en cours…";
}

export function isIosDevice(ua: string, platform = "", touchPoints = 0): boolean {
  return /iPad|iPhone|iPod/.test(ua) || (platform === "MacIntel" && touchPoints > 1);
}

export interface PhotoPrep {
  display: Blob;
  source: Blob;
  removed: boolean;
  skipped: boolean;
}

export interface CutoutDeps {
  compress: (file: Blob, max: number) => Promise<Blob>;
  flatten: (file: Blob, max: number) => Promise<Blob>;
  remove: (file: Blob, report: (label: string) => void) => Promise<Blob>;
}

function readLimits(): { maxSide: number; storageMax: number } {
  const nav =
    typeof navigator === "undefined"
      ? undefined
      : (navigator as Navigator & { deviceMemory?: number });
  const env = {
    deviceMemory: nav?.deviceMemory,
    width: typeof window === "undefined" ? undefined : window.innerWidth,
    ios:
      typeof navigator === "undefined"
        ? false
        : isIosDevice(navigator.userAgent, navigator.platform, navigator.maxTouchPoints),
  };
  return { maxSide: cutoutMaxSide(env), storageMax: storageMaxSide(env) };
}

function abortError(): DOMException {
  return new DOMException("Aborted", "AbortError");
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";
}

function limitThreads(): () => void {
  if (typeof navigator === "undefined") return () => {};
  const isolated = typeof crossOriginIsolated === "boolean" && crossOriginIsolated;
  const cores = navigator.hardwareConcurrency || 1;
  const next = cutoutThreadCount(isolated, cores);
  if (next === cores) return () => {};
  const previous = cores;
  try {
    Object.defineProperty(navigator, "hardwareConcurrency", {
      configurable: true,
      get: () => next,
    });
  } catch {
    return () => {};
  }
  return () => {
    try {
      Object.defineProperty(navigator, "hardwareConcurrency", {
        configurable: true,
        get: () => previous,
      });
    } catch {
      /* The single-thread value stays in place for the rest of the page. */
    }
  };
}

async function removeWithImgly(file: Blob, report: (label: string) => void): Promise<Blob> {
  const restore = limitThreads();
  try {
    const { removeBackground } = await import("@imgly/background-removal");
    report("Détourage en cours…");
    return await removeBackground(file, {
      model: "isnet_quint8",
      device: "cpu",
      proxyToWorker: false,
      output: { format: "image/png", quality: 0.8 },
      progress: (key, current, total) => report(cutoutProgressLabel(key, current, total)),
    });
  } finally {
    restore();
  }
}

async function raceAbort<T>(work: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return work;
  if (signal.aborted) throw abortError();
  return await new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener("abort", onAbort);
      reject(abortError());
    };
    signal.addEventListener("abort", onAbort);
    work.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

/**
 * Downscale, then remove the background on-device.
 * Any failure (model, memory, offline) keeps the compressed original.
 */
export async function prepareGarmentPhoto(
  file: Blob,
  options: {
    maxSide?: number;
    storageMax?: number;
    signal?: AbortSignal;
    onProgress?: (label: string) => void;
    deps?: Partial<CutoutDeps>;
  } = {},
): Promise<PhotoPrep> {
  const limits = readLimits();
  const maxSide = options.maxSide ?? limits.maxSide;
  const storageMax = options.storageMax ?? limits.storageMax;
  const compress = options.deps?.compress ?? compressImage;
  const flatten =
    options.deps?.flatten ?? ((blob: Blob, max: number) => flattenOnNeutral(blob, max));
  const remove = options.deps?.remove ?? removeWithImgly;
  const report = (label: string) => options.onProgress?.(label);

  report("Préparation de la photo…");
  const source = await compress(file, storageMax);
  if (options.signal?.aborted) return { display: source, source, removed: false, skipped: true };

  const input = maxSide < storageMax ? await compress(source, maxSide) : source;
  if (options.signal?.aborted) return { display: source, source, removed: false, skipped: true };

  report("Détourage en cours…");
  try {
    const cut = await raceAbort(remove(input, report), options.signal);
    if (!cut || cut.size === 0) return { display: source, source, removed: false, skipped: false };
    if (options.signal?.aborted) return { display: source, source, removed: false, skipped: true };
    const display = await flatten(cut, maxSide);
    if (options.signal?.aborted) return { display: source, source, removed: false, skipped: true };
    return { display, source, removed: true, skipped: false };
  } catch (error) {
    if (isAbort(error) || options.signal?.aborted)
      return { display: source, source, removed: false, skipped: true };
    return { display: source, source, removed: false, skipped: false };
  }
}
