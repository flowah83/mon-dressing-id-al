import { describe, expect, it } from "vitest";
import {
  formatWearLine,
  formatWornHeading,
  groupWornByDate,
  isWithinRecentDays,
  localDateISO,
  neverWornHint,
  neverWornIds,
  outfitWearKey,
  sameDayWear,
  shiftISODate,
  wearStats,
  wearStreak,
  weekDates,
  wornFromBackup,
} from "./wear";

describe("historique des tenues", () => {
  it("calcule le jour local et la fenêtre récente", () => {
    expect(localDateISO(new Date(2026, 9, 22))).toBe("2026-10-22");
    expect(shiftISODate("2026-10-01", -1)).toBe("2026-09-30");
    expect(isWithinRecentDays("2026-10-18", "2026-10-22")).toBe(true);
    expect(isWithinRecentDays("2026-10-17", "2026-10-22")).toBe(false);
    expect(isWithinRecentDays("2026-10-23", "2026-10-22")).toBe(false);
    expect(isWithinRecentDays("hier", "2026-10-22")).toBe(false);
    expect(weekDates("2026-10-22")).toEqual([
      "2026-10-19",
      "2026-10-20",
      "2026-10-21",
      "2026-10-22",
      "2026-10-23",
      "2026-10-24",
      "2026-10-25",
    ]);
    expect(wearStreak([{ wornOn: "2026-10-21" }, { wornOn: "2026-10-20" }], "2026-10-22")).toBe(2);
    expect(wearStreak([{ wornOn: "2026-10-22" }, { wornOn: "2026-10-21" }], "2026-10-22")).toBe(2);
    expect(wearStreak([{ wornOn: "2026-10-20" }], "2026-10-22")).toBe(0);
  });

  it("reconnaît la même tenue le même jour, quel que soit l'ordre", () => {
    const key = outfitWearKey(["s", "t", "b"]);
    expect(key).toBe(outfitWearKey(["b", "t", "s"]));
    const entries = [{ id: "a", wornOn: "2026-10-22", itemIds: ["b", "s", "t"] }];
    expect(sameDayWear(entries, ["t", "b", "s"], "2026-10-22")?.id).toBe("a");
    expect(sameDayWear(entries, ["t", "b", "s"], "2026-10-21")).toBeUndefined();
    expect(
      sameDayWear([{ ...entries[0]!, deletedAt: 1 }], ["t", "b", "s"], "2026-10-22"),
    ).toBeUndefined();
  });

  it("compte les ports et formule la dernière fois", () => {
    const entries = [
      { itemIds: ["manteau", "jean"], wornOn: "2026-10-20" },
      { itemIds: ["manteau"], wornOn: "2026-10-22" },
      { itemIds: ["robe"], wornOn: "2026-10-01", deletedAt: 5 },
    ];
    expect(wearStats("manteau", entries)).toEqual({ count: 2, lastOn: "2026-10-22" });
    expect(wearStats("robe", entries)).toEqual({ count: 0 });
    expect(formatWearLine({ count: 0 }, "2026-10-22")).toBe("Jamais portée");
    expect(formatWearLine({ count: 1, lastOn: "2026-10-22" }, "2026-10-22")).toBe(
      "Portée 1 fois · dernière fois aujourd'hui",
    );
    expect(formatWearLine({ count: 2, lastOn: "2026-10-20" }, "2026-10-22")).toBe(
      "Portée 2 fois · dernière fois le 20 octobre 2026",
    );
  });

  it("signale les pièces jamais portées et groupe les jours", () => {
    expect(
      neverWornIds(["a", "b", "c"], [{ itemIds: ["b"] }, { itemIds: ["a"], deletedAt: 1 }]),
    ).toEqual(["a", "c"]);
    expect(neverWornHint([])).toBeNull();
    expect(neverWornHint(["Pull gris"])).toBe("1 pièce jamais portée : Pull gris.");
    expect(neverWornHint(["A", "B", "C", "D"])).toBe(
      "4 pièces jamais portées : A, B, C et 1 autre.",
    );
    expect(formatWornHeading("2026-10-22", "2026-10-22")).toBe("Aujourd'hui");
    expect(formatWornHeading("2026-10-21", "2026-10-22")).toBe("Hier");
    expect(formatWornHeading("2026-10-19", "2026-10-22")).toBe("Lundi 19 octobre 2026");
    const groups = groupWornByDate([
      { wornOn: "2026-10-20", createdAt: 2, id: "old" },
      { wornOn: "2026-10-22", createdAt: 4, id: "new" },
      { wornOn: "2026-10-22", createdAt: 3, id: "mid" },
    ]);
    expect(groups.map((group) => group.wornOn)).toEqual(["2026-10-22", "2026-10-20"]);
    expect(groups[0]?.entries.map((entry) => entry.id)).toEqual(["new", "mid"]);
  });

  it("relit une ligne d'historique de sauvegarde", () => {
    expect(
      wornFromBackup({
        id: "j",
        wornOn: "2026-10-22",
        itemIds: ["a", 1, "b"],
        name: " Bureau ",
        outfitId: "tenue",
      }),
    ).toMatchObject({
      id: "j",
      mode: "perso",
      wornOn: "2026-10-22",
      itemIds: ["a", "b"],
      name: "Bureau",
      outfitId: "tenue",
    });
    expect(() => wornFromBackup({ id: "j", wornOn: "2026-13-01", itemIds: ["a"] })).toThrow(
      /sauvegarde/,
    );
    expect(() => wornFromBackup({ id: "j", wornOn: "2026-10-22", itemIds: [] })).toThrow(
      /sauvegarde/,
    );
  });
});
