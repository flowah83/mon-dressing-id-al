import { describe, expect, it } from "vitest";
import { cachedObjectUrl, imageCacheKey, peekThumbnail } from "./image-cache";

describe("cache des photos", () => {
  it("réutilise la même URL pour la même photo", () => {
    const blob = new Blob(["photo-a"], { type: "image/jpeg" });
    const key = imageCacheKey({ id: "a", image: blob, updatedAt: 5 });
    const first = cachedObjectUrl(key, blob);
    const second = cachedObjectUrl(key, new Blob(["photo-a"], { type: "image/jpeg" }));
    expect(second).toBe(first);
    expect(first.startsWith("blob:")).toBe(true);
  });

  it("change de clé quand la photo change", () => {
    const small = new Blob(["a"], { type: "image/jpeg" });
    const large = new Blob(["aaaa"], { type: "image/jpeg" });
    expect(imageCacheKey({ id: "a", image: small, updatedAt: 1 })).not.toBe(
      imageCacheKey({ id: "a", image: large, updatedAt: 2 }),
    );
    expect(imageCacheKey({ imageUrl: "/demo/robe.jpg" })).toBe("u:/demo/robe.jpg");
    expect(peekThumbnail("absent")).toBeUndefined();
  });
});
