import { describe, expect, it, vi } from "vitest";
import {
  cutoutMaxSide,
  cutoutProgressLabel,
  cutoutThreadCount,
  prepareGarmentPhoto,
  storageMaxSide,
} from "./cutout";

describe("détourage", () => {
  it("réduit plus fort sur iPhone et sur un téléphone peu de mémoire", () => {
    expect(cutoutMaxSide({ ios: true, width: 390, deviceMemory: 4 })).toBe(640);
    expect(cutoutMaxSide({ width: 390 })).toBe(768);
    expect(cutoutMaxSide({ deviceMemory: 2, width: 1280 })).toBe(640);
    expect(cutoutMaxSide({ width: 1280, deviceMemory: 8 })).toBe(1024);
    expect(storageMaxSide({ ios: true })).toBe(640);
    expect(storageMaxSide({ width: 1280, deviceMemory: 8 })).toBe(1400);
  });

  it("n'utilise qu'un fil sans isolation cross-origin", () => {
    expect(cutoutThreadCount(false, 8)).toBe(1);
    expect(cutoutThreadCount(true, 8)).toBe(4);
    expect(cutoutThreadCount(true, 2)).toBe(2);
  });

  it("annonce le détourage, avec un pourcentage quand il est connu", () => {
    expect(cutoutProgressLabel("fetch:model", 0, 10)).toBe("Détourage en cours…");
    expect(cutoutProgressLabel("compute:mask", 1, 4)).toBe("Détourage en cours… 25 %");
  });

  it("garde la photo d'origine si le modèle échoue", async () => {
    const source = new Blob(["src"], { type: "image/jpeg" });
    const labels: string[] = [];
    const result = await prepareGarmentPhoto(new Blob(["raw"]), {
      maxSide: 640,
      storageMax: 640,
      onProgress: (label) => labels.push(label),
      deps: {
        compress: async () => source,
        flatten: async () => source,
        remove: async () => {
          throw new Error("wasm");
        },
      },
    });
    expect(result.removed).toBe(false);
    expect(result.skipped).toBe(false);
    expect(result.display).toBe(source);
    expect(labels.some((label) => label.startsWith("Détourage en cours"))).toBe(true);
  });

  it("ignore le détourage quand on l'interrompt", async () => {
    const source = new Blob(["src"], { type: "image/jpeg" });
    const controller = new AbortController();
    const remove = vi.fn(async () => new Blob(["png"]));
    const result = await prepareGarmentPhoto(new Blob(["raw"]), {
      maxSide: 640,
      storageMax: 640,
      signal: controller.signal,
      deps: {
        compress: async () => {
          controller.abort();
          return source;
        },
        flatten: async () => source,
        remove,
      },
    });
    expect(result.skipped).toBe(true);
    expect(result.display).toBe(source);
    expect(remove).not.toHaveBeenCalled();
  });

  it("pose le détourage sur un fond neutre et réduit avant le modèle", async () => {
    const source = new Blob(["src"], { type: "image/jpeg" });
    const png = new Blob(["png"], { type: "image/png" });
    const jpeg = new Blob(["jpg"], { type: "image/jpeg" });
    const sizes: number[] = [];
    let flattened: Blob | null = null;
    const result = await prepareGarmentPhoto(new Blob(["raw"]), {
      maxSide: 640,
      storageMax: 1400,
      deps: {
        compress: async (_file, max) => {
          sizes.push(max);
          return source;
        },
        remove: async () => png,
        flatten: async (blob) => {
          flattened = blob;
          return jpeg;
        },
      },
    });
    expect(sizes).toEqual([1400, 640]);
    expect(flattened).toBe(png);
    expect(result).toMatchObject({ display: jpeg, source, removed: true, skipped: false });
  });
});
