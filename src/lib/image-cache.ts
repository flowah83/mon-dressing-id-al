import { flattenCatalogue } from "./catalogue-photo";

const objectUrls = new Map<string, string>();
const thumbs = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();

let active = 0;
const waiters: Array<() => void> = [];
const CONCURRENCY = 4;

export function imageCacheKey(g: {
  id?: string;
  image?: Blob;
  imageUrl?: string;
  updatedAt?: number;
}): string {
  if (g.image) return `b:${g.id ?? "x"}:${g.updatedAt ?? 0}:${g.image.size}:${g.image.type}`;
  return `u:${g.imageUrl ?? ""}`;
}

/** Une URL stable par photo. On ne la révoque pas : l'onglet suivant réutilise le décodage. */
export function cachedObjectUrl(key: string, blob: Blob): string {
  const hit = objectUrls.get(key);
  if (hit) return hit;
  const url = URL.createObjectURL(blob);
  objectUrls.set(key, url);
  return url;
}

export function peekThumbnail(key: string): string | undefined {
  return thumbs.get(key);
}

function enqueue<T>(job: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const run = () => {
      active += 1;
      job()
        .then(resolve, reject)
        .finally(() => {
          active -= 1;
          const next = waiters.shift();
          if (next) next();
        });
    };
    if (active < CONCURRENCY) run();
    else waiters.push(run);
  });
}

async function drawThumb(src: string, maxEdge: number): Promise<string> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return src;
  const response = await fetch(src);
  if (!response.ok) return src;
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);
  try {
    const edge = Math.max(bitmap.width, bitmap.height) || 1;
    const scale = Math.min(1, maxEdge / edge);
    if (scale > 0.92) return src;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return src;
    ctx.drawImage(bitmap, 0, 0, width, height);
    const out = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((value) => resolve(value), "image/jpeg", 0.82),
    );
    if (!out) return src;
    return URL.createObjectURL(out);
  } finally {
    bitmap.close?.();
  }
}

/** Vignette mémoire. Les photos du catalogue sont aplaties une seule fois, puis réduites. */
export function loadDisplayUrl(key: string, src: string, maxEdge: number): Promise<string> {
  const cacheKey = `${key}@${maxEdge}`;
  const hit = thumbs.get(cacheKey);
  if (hit) return Promise.resolve(hit);
  const pending = inflight.get(cacheKey);
  if (pending) return pending;
  const task = enqueue(async () => {
    const ready = thumbs.get(cacheKey);
    if (ready) return ready;
    let source = src;
    if (!src.startsWith("blob:") && !src.startsWith("data:")) source = await flattenCatalogue(src);
    const url = await drawThumb(source, maxEdge);
    thumbs.set(cacheKey, url);
    return url;
  }).finally(() => {
    inflight.delete(cacheKey);
  });
  inflight.set(cacheKey, task);
  return task;
}
