import { describe, expect, it } from "vitest";
import { photoObjectPath, photoOwnedBy, planAccountSync, planSync } from "./sync-plan";

describe("fusion du dressing", () => {
  it("copie le dressing local vers un compte vide sans rien effacer", () => {
    const plan = planAccountSync({
      cacheOwner: null,
      userId: "user-1",
      localGarments: [{ id: "manteau", updatedAt: 10 }],
      remoteGarments: [],
      localOutfits: [{ id: "tenue", updatedAt: 12 }],
      remoteOutfits: [],
    });
    expect(plan.wipeLocal).toBe(false);
    expect(plan.garmentActions).toEqual([{ type: "push", id: "manteau" }]);
    expect(plan.outfitActions).toEqual([{ type: "push", id: "tenue" }]);
    expect(plan.wornActions).toEqual([]);
  });

  it("ramène les pièces du compte et garde la version la plus récente", () => {
    expect(
      planSync(
        [
          { id: "a", updatedAt: 1 },
          { id: "b", updatedAt: 5 },
        ],
        [
          { id: "b", updatedAt: 4 },
          { id: "c", updatedAt: 3 },
        ],
      ),
    ).toEqual([
      { type: "push", id: "a" },
      { type: "push", id: "b" },
      { type: "pull", id: "c" },
    ]);
    expect(planSync([{ id: "a", updatedAt: 2 }], [{ id: "a", updatedAt: 9 }])).toEqual([
      { type: "pull", id: "a" },
    ]);
    expect(planSync([{ id: "a", updatedAt: 4 }], [{ id: "a", updatedAt: 4 }])).toEqual([]);
  });

  it("propage une suppression plus récente", () => {
    expect(
      planSync([{ id: "a", updatedAt: 8, deletedAt: 8 }], [{ id: "a", updatedAt: 2 }]),
    ).toEqual([{ type: "push", id: "a" }]);
    expect(
      planSync([{ id: "a", updatedAt: 2 }], [{ id: "a", updatedAt: 8, deletedAt: 8 }]),
    ).toEqual([{ type: "pull", id: "a" }]);
  });

  it("ne verse pas le dressing d'un autre compte", () => {
    const plan = planAccountSync({
      cacheOwner: "user-a",
      userId: "user-b",
      localGarments: [{ id: "secret", updatedAt: 99 }],
      remoteGarments: [{ id: "b1", updatedAt: 1 }],
      localOutfits: [{ id: "secret-tenue", updatedAt: 5 }],
      remoteOutfits: [],
      localWorn: [{ id: "secret-jour", updatedAt: 9 }],
      remoteWorn: [{ id: "b-jour", updatedAt: 1 }],
    });
    expect(plan.wipeLocal).toBe(true);
    expect(plan.garmentActions).toEqual([{ type: "pull", id: "b1" }]);
    expect(plan.outfitActions).toEqual([]);
    expect(plan.wornActions).toEqual([{ type: "pull", id: "b-jour" }]);
    expect(JSON.stringify(plan)).not.toContain("secret");
  });

  it("fusionne l'historique comme les tenues", () => {
    const plan = planAccountSync({
      cacheOwner: "user-1",
      userId: "user-1",
      localGarments: [],
      remoteGarments: [],
      localOutfits: [],
      remoteOutfits: [],
      localWorn: [{ id: "jour", updatedAt: 3 }],
      remoteWorn: [{ id: "autre", updatedAt: 4 }],
    });
    expect(plan.wornActions).toEqual([
      { type: "pull", id: "autre" },
      { type: "push", id: "jour" },
    ]);
  });
});

describe("photos privées", () => {
  it("n'accepte un chemin que dans le dossier de la personne", () => {
    expect(photoObjectPath("user-1", "piece-1")).toBe("user-1/piece-1.jpg");
    expect(photoObjectPath("../user-1", "piece")).toBeNull();
    expect(photoObjectPath("user-1", "a/b")).toBeNull();
    expect(photoOwnedBy("user-1/piece-1.jpg", "user-1")).toBe(true);
    expect(photoOwnedBy("user-2/piece-1.jpg", "user-1")).toBe(false);
    expect(photoOwnedBy("user-1/../user-2/piece.jpg", "user-1")).toBe(false);
    expect(photoOwnedBy("user-1/piece.jpg/extra", "user-1")).toBe(false);
  });
});
