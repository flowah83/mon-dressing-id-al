import { describe, expect, it } from "vitest";
import { copyToPersonal } from "./garment-copy";
import type { Garment } from "./wardrobe";

const demo: Garment = {
  id: "demo-1",
  mode: "demo",
  name: "Robe midi olive",
  category: "robe",
  colors: ["kaki"],
  pattern: "uni",
  style: "chic",
  seasons: ["ete"],
  available: true,
  favorite: true,
  notes: "douce",
  imageUrl: "/robe.jpg",
  imagePath: "secret/robe.jpg",
  createdAt: 1,
};

describe("copie vers mon dressing", () => {
  it("crée une pièce personnelle sans le chemin du compte démo", () => {
    const copy = copyToPersonal(demo, "new-id", 50);
    expect(copy.mode).toBe("perso");
    expect(copy.id).toBe("new-id");
    expect(copy.name).toBe("Robe midi olive");
    expect(copy.favorite).toBe(true);
    expect(copy.imageUrl).toBe("/robe.jpg");
    expect(copy.imagePath).toBeUndefined();
    expect(copy.createdAt).toBe(50);
  });
});
