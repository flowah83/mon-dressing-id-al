import { describe, expect, it } from "vitest";
import { sliderChangeIsDeliberate } from "./slider-intent";

describe("curseur de température", () => {
  it("ignore un toucher léger et accepte un glissement ou le clavier", () => {
    expect(sliderChangeIsDeliberate({ pointerActive: true, pointerMovedPx: 2 })).toBe(false);
    expect(sliderChangeIsDeliberate({ pointerActive: true, pointerMovedPx: 8 })).toBe(true);
    expect(sliderChangeIsDeliberate({ pointerActive: false, pointerMovedPx: 0 })).toBe(true);
  });
});
