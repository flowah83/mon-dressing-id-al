import { describe, expect, it } from "vitest";
import { generateOutfits, seasonsForTemperature } from "./rules";
import type { Garment } from "./wardrobe";

const g = (
  id: string,
  category: Garment["category"],
  colors: string[],
  extra: Partial<Garment> = {},
): Garment => ({
  id,
  mode: "perso",
  name: id,
  category,
  colors,
  pattern: "uni",
  style: "classique",
  seasons: [],
  available: true,
  favorite: false,
  notes: "",
  createdAt: 0,
  ...extra,
});

describe("conseiller", () => {
  it("indique les catégories manquantes au lieu d'inventer", () => {
    const r = generateOutfits({
      items: [g("t", "haut", ["blanc"])],
      occasion: "quotidien",
      style: "any",
      temperature: 20,
      level: "simple",
    });
    expect(r.proposals).toHaveLength(0);
    expect(r.missing.join(" ")).toMatch(/Chaussures/);
    expect(r.missing.join(" ")).toMatch(/Un bas/);
  });

  it("n'utilise que les pièces disponibles", () => {
    const items = [
      g("t", "haut", ["blanc"]),
      g("b", "bas", ["denim"]),
      g("s", "chaussures", ["blanc"], { available: false }),
    ];
    const r = generateOutfits({
      items,
      occasion: "quotidien",
      style: "any",
      temperature: 20,
      level: "simple",
    });
    expect(r.proposals).toHaveLength(0);
    expect(r.missing[0]).toMatch(/Chaussures/);
  });

  it("propose au plus 3 tenues distinctes", () => {
    const items = [
      g("t1", "haut", ["blanc"]),
      g("t2", "haut", ["bleu"]),
      g("t3", "haut", ["noir"]),
      g("b1", "bas", ["denim"]),
      g("b2", "bas", ["beige"]),
      g("b3", "bas", ["noir"]),
      g("s1", "chaussures", ["blanc"]),
      g("s2", "chaussures", ["marron"]),
    ];
    const r = generateOutfits({
      items,
      occasion: "quotidien",
      style: "any",
      temperature: 20,
      level: "simple",
    });
    expect(r.proposals.length).toBe(3);
    const ids = r.proposals.map((p) => p.itemIds.join());
    expect(new Set(ids).size).toBe(3);
  });

  it("inclut toujours la pièce imposée", () => {
    const items = [
      g("t1", "haut", ["blanc"]),
      g("t2", "haut", ["bleu"]),
      g("b1", "bas", ["denim"]),
      g("s1", "chaussures", ["blanc"]),
    ];
    const r = generateOutfits({
      items,
      occasion: "quotidien",
      style: "any",
      temperature: 20,
      level: "simple",
      anchorId: "t2",
    });
    expect(r.proposals.every((p) => p.itemIds.includes("t2"))).toBe(true);
  });

  it("ajoute une veste quand il fait froid", () => {
    const items = [
      g("t", "haut", ["blanc"]),
      g("b", "bas", ["noir"]),
      g("s", "chaussures", ["noir"]),
      g("v", "veste", ["marine"]),
    ];
    const r = generateOutfits({
      items,
      occasion: "travail",
      style: "any",
      temperature: 5,
      level: "simple",
    });
    expect(r.proposals[0]!.itemIds).toContain("v");
  });

  it("exclut les pièces sport pour une occasion chic", () => {
    const items = [
      g("t", "haut", ["blanc"], { style: "sport" }),
      g("b", "bas", ["noir"]),
      g("s", "chaussures", ["noir"]),
    ];
    const r = generateOutfits({
      items,
      occasion: "chic",
      style: "any",
      temperature: 20,
      level: "simple",
    });
    expect(r.proposals).toHaveLength(0);
  });

  it("mappe la température en saisons", () => {
    expect(seasonsForTemperature(2)).toEqual(["hiver"]);
    expect(seasonsForTemperature(28)).toEqual(["ete"]);
  });

  it("inclut une veste quand la pluie est prévue, même s'il fait doux", () => {
    const items = [
      g("t", "haut", ["blanc"]),
      g("b", "bas", ["noir"]),
      g("s", "chaussures", ["noir"]),
      g("v", "veste", ["marine"]),
    ];
    const r = generateOutfits({
      items,
      occasion: "quotidien",
      style: "any",
      temperature: 24,
      level: "simple",
      weather: { precipitation: "rain", windKmh: 12 },
    });
    expect(r.proposals[0]!.itemIds).toContain("v");
    expect(r.proposals[0]!.reasons.join(" ")).toMatch(/pluie/);
    expect(r.notes.join(" ")).toMatch(/pluie/i);
  });

  it("laisse la veste de côté par temps doux et sec", () => {
    const items = [
      g("t", "haut", ["blanc"]),
      g("b", "bas", ["noir"]),
      g("s", "chaussures", ["noir"]),
      g("v", "veste", ["marine"]),
    ];
    const r = generateOutfits({
      items,
      occasion: "quotidien",
      style: "any",
      temperature: 24,
      level: "simple",
    });
    expect(r.proposals[0]!.itemIds).not.toContain("v");
  });

  it("signale le vent et privilégie une veste", () => {
    const items = [
      g("t", "haut", ["blanc"]),
      g("b", "bas", ["noir"]),
      g("s", "chaussures", ["noir"]),
      g("v", "veste", ["marine"]),
    ];
    const r = generateOutfits({
      items,
      occasion: "quotidien",
      style: "any",
      temperature: 18,
      level: "simple",
      weather: { precipitation: "none", windKmh: 45 },
    });
    expect(r.notes.join(" ")).toMatch(/45 km\/h/);
    expect(r.proposals[0]!.itemIds).toContain("v");
  });

  it("prévient s'il neige et qu'aucune veste n'est disponible", () => {
    const items = [
      g("t", "haut", ["blanc"]),
      g("b", "bas", ["noir"]),
      g("s", "chaussures", ["noir"]),
    ];
    const r = generateOutfits({
      items,
      occasion: "quotidien",
      style: "any",
      temperature: 3,
      level: "simple",
      weather: { precipitation: "snow", windKmh: 10 },
    });
    expect(r.notes.join(" ")).toMatch(/neige/i);
    expect(r.notes.join(" ")).toMatch(/aucune veste/i);
  });

  it("ne repropose pas une tenue portée ces derniers jours", () => {
    const items = [
      g("t1", "haut", ["blanc"]),
      g("t2", "haut", ["blanc"]),
      g("b", "bas", ["noir"]),
      g("s", "chaussures", ["noir"]),
    ];
    const r = generateOutfits({
      items,
      occasion: "quotidien",
      style: "any",
      temperature: 20,
      level: "simple",
      today: "2026-10-22",
      recentWears: [{ itemIds: ["t1", "b", "s"], wornOn: "2026-10-21" }],
    });
    expect(r.proposals.length).toBeGreaterThan(0);
    expect(
      r.proposals.some(
        (proposal) => proposal.itemIds.includes("t1") && proposal.itemIds.includes("b"),
      ),
    ).toBe(false);
    expect(r.proposals[0]!.itemIds).toContain("t2");
    expect(r.notes.join(" ")).toMatch(/derniers jours/);
  });

  it("propose quand même l'unique tenue déjà portée", () => {
    const items = [
      g("t", "haut", ["blanc"]),
      g("b", "bas", ["noir"]),
      g("s", "chaussures", ["noir"]),
    ];
    const r = generateOutfits({
      items,
      occasion: "quotidien",
      style: "any",
      temperature: 20,
      level: "simple",
      today: "2026-10-22",
      recentWears: [{ itemIds: ["t", "b", "s"], wornOn: "2026-10-22" }],
    });
    expect(r.proposals).toHaveLength(1);
    expect(r.notes.join(" ")).toMatch(/portées récemment/);
  });

  it("ignore un port plus ancien que la fenêtre", () => {
    const items = [
      g("t", "haut", ["blanc"]),
      g("b", "bas", ["noir"]),
      g("s", "chaussures", ["noir"]),
    ];
    const r = generateOutfits({
      items,
      occasion: "quotidien",
      style: "any",
      temperature: 20,
      level: "simple",
      today: "2026-10-22",
      recentWears: [{ itemIds: ["t", "b", "s"], wornOn: "2026-10-01" }],
    });
    expect(r.proposals).toHaveLength(1);
    expect(r.proposals[0]!.itemIds).toContain("t");
    expect(r.notes.join(" ")).not.toMatch(/récemment|derniers jours/);
  });
});
