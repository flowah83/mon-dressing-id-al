/** Warm white used behind a cut-out garment. */
export const NEUTRAL_BACKGROUND = "#f7f5f2";

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error("Format de photo non pris en charge. Essayez une photo JPEG ou PNG."));
    image.src = url;
  });
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Compression impossible."))),
      "image/jpeg",
      quality,
    );
  });
}

function drawScaled(
  file: Blob,
  max: number,
  paint: (
    ctx: CanvasRenderingContext2D,
    image: HTMLImageElement,
    width: number,
    height: number,
  ) => void,
  quality: number,
): Promise<Blob> {
  const url = URL.createObjectURL(file);
  return loadImage(url)
    .then((image) => {
      const scale = Math.min(1, max / Math.max(image.naturalWidth, image.naturalHeight));
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Impossible de traiter la photo sur cet appareil.");
      paint(ctx, image, width, height);
      return canvasToJpeg(canvas, quality);
    })
    .finally(() => URL.revokeObjectURL(url));
}

/** Resize + recompress a photo to JPEG (max side `max` px). */
export function compressImage(file: Blob, max = 1400, quality = 0.84): Promise<Blob> {
  return drawScaled(
    file,
    max,
    (ctx, image, width, height) => ctx.drawImage(image, 0, 0, width, height),
    quality,
  );
}

/** Place a transparent cut-out on a neutral background and recompress to JPEG. */
export function flattenOnNeutral(
  file: Blob,
  max = 1400,
  quality = 0.86,
  background = NEUTRAL_BACKGROUND,
): Promise<Blob> {
  return drawScaled(
    file,
    max,
    (ctx, image, width, height) => {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(image, 0, 0, width, height);
    },
    quality,
  );
}

export const blobToDataUrl = (b: Blob) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(b);
  });
