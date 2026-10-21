import { describe, expect, it } from "vitest";
import { findOutfitByPieces, outfitKey } from "./outfit-match";

describe("tenues déjà gardées", () => {
  it("reconnaît les mêmes pièces dans un autre ordre", () => {
    expect(outfitKey(["b", "a"])).toBe(outfitKey(["a", "b"]));
    const outfits = [{ id: "1", itemIds: ["veste", "jean", "pull"], deletedAt: undefined }];
    expect(findOutfitByPieces(outfits, ["pull", "veste", "jean"])?.id).toBe("1");
  });

  it("ignore une tenue supprimée et une sélection vide", () => {
    const outfits = [{ id: "1", itemIds: ["a"], deletedAt: 10 }];
    expect(findOutfitByPieces(outfits, ["a"])).toBeUndefined();
    expect(findOutfitByPieces(outfits, [])).toBeUndefined();
  });
});
