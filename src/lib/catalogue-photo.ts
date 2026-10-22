/** Pose les photos démo sur un même fond clair, vêtement centré, pour le style Épuré. */

const WELL = [243, 241, 236] as const;
const cache = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();

function sample(data: Uint8ClampedArray, w: number, x: number, y: number) {
  const i = (y * w + x) * 4;
  return [data[i]!, data[i + 1]!, data[i + 2]!] as const;
}

export function flattenCatalogue(src: string): Promise<string> {
  if (src.startsWith("blob:") || src.startsWith("data:")) return Promise.resolve(src);
  const hit = cache.get(src);
  if (hit) return Promise.resolve(hit);
  const pending = inflight.get(src);
  if (pending) return pending;
  const task = new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const sw = img.naturalWidth;
      const sh = img.naturalHeight;
      if (!sw || !sh) {
        resolve(src);
        return;
      }
      const scale = Math.min(1, 640 / sw);
      const w = Math.max(1, Math.round(sw * scale));
      const h = Math.max(1, Math.round(sh * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        resolve(src);
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      const image = ctx.getImageData(0, 0, w, h);
      const data = image.data;
      const points = [
        sample(data, w, 2, 2),
        sample(data, w, w - 3, 2),
        sample(data, w, 2, h - 3),
        sample(data, w, w - 3, h - 3),
        sample(data, w, w >> 1, 2),
        sample(data, w, w >> 1, h - 3),
      ];
      let kr = 0;
      let kg = 0;
      let kb = 0;
      for (const point of points) {
        kr += point[0];
        kg += point[1];
        kb += point[2];
      }
      const key = [kr / points.length, kg / points.length, kb / points.length] as const;
      const near = 13;
      const far = 22;
      let minX = w;
      let minY = h;
      let maxX = 0;
      let maxY = 0;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          const dr = data[i]! - key[0]!;
          const dg = data[i + 1]! - key[1]!;
          const db = data[i + 2]! - key[2]!;
          const dist = Math.sqrt(dr * dr + dg * dg + db * db);
          if (dist <= near) {
            data[i] = WELL[0];
            data[i + 1] = WELL[1];
            data[i + 2] = WELL[2];
          } else if (dist < far) {
            const t = (dist - near) / (far - near);
            data[i] = WELL[0] * (1 - t) + data[i]! * t;
            data[i + 1] = WELL[1] * (1 - t) + data[i + 1]! * t;
            data[i + 2] = WELL[2] * (1 - t) + data[i + 2]! * t;
          }
          const er = data[i]! - WELL[0];
          const eg = data[i + 1]! - WELL[1];
          const eb = data[i + 2]! - WELL[2];
          if (er * er + eg * eg + eb * eb > 144) {
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
          }
        }
      }
      ctx.putImageData(image, 0, 0);
      if (maxX <= minX || maxY <= minY) {
        resolve(src);
        return;
      }
      const outW = 800;
      const outH = 1000;
      const out = document.createElement("canvas");
      out.width = outW;
      out.height = outH;
      const octx = out.getContext("2d");
      if (!octx) {
        resolve(src);
        return;
      }
      octx.fillStyle = "#F3F1EC";
      octx.fillRect(0, 0, outW, outH);
      const bw = maxX - minX + 1;
      const bh = maxY - minY + 1;
      const fit = Math.min((outW * 0.76) / bw, (outH * 0.78) / bh);
      const nw = bw * fit;
      const nh = bh * fit;
      octx.imageSmoothingEnabled = true;
      octx.imageSmoothingQuality = "high";
      octx.drawImage(canvas, minX, minY, bw, bh, (outW - nw) / 2, (outH - nh) / 2, nw, nh);
      out.toBlob((blob) => {
        if (!blob) {
          resolve(src);
          return;
        }
        const url = URL.createObjectURL(blob);
        cache.set(src, url);
        resolve(url);
      }, "image/png");
    };
    img.onerror = () => resolve(src);
    img.src = src;
  }).finally(() => {
    inflight.delete(src);
  });
  inflight.set(src, task);
  return task;
}
