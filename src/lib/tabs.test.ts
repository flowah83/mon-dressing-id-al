import { describe, expect, it } from "vitest";
import { isTabPath, isTabSwitch, shouldUseViewTransition } from "./tabs";

describe("onglets", () => {
  it("reconnaît les cinq onglets du bas", () => {
    expect(isTabPath("/")).toBe(true);
    expect(isTabPath("/composer")).toBe(true);
    expect(isTabPath("/ajouter")).toBe(true);
    expect(isTabPath("/conseiller")).toBe(true);
    expect(isTabPath("/favoris")).toBe(true);
    expect(isTabPath("/piece/abc")).toBe(false);
    expect(isTabPath("/bienvenue")).toBe(false);
  });

  it("ne lance pas de view transition entre onglets", () => {
    expect(isTabSwitch("/", "/favoris")).toBe(true);
    expect(isTabSwitch("/favoris", "/favoris")).toBe(false);
    expect(isTabSwitch("/", "/piece/1")).toBe(false);
    expect(shouldUseViewTransition("/", "/conseiller", false)).toBe(false);
    expect(shouldUseViewTransition("/favoris", "/piece/1", false)).toBe(false);
    expect(shouldUseViewTransition("/", "/composer", true)).toBe(false);
  });
});
