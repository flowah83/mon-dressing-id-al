import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { WornEntry } from "./wardrobe";

/** Days during which a worn outfit or garment should not be proposed again. */
export const RECENT_WEAR_DAYS = 4;

export function localDateISO(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseISODate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day)
    return null;
  return date;
}

export function shiftISODate(iso: string, days: number): string | null {
  const date = parseISODate(iso);
  if (!date) return null;
  date.setDate(date.getDate() + days);
  return localDateISO(date);
}

export function daysBetween(from: string, to: string): number | null {
  const start = parseISODate(from);
  const end = parseISODate(to);
  if (!start || !end) return null;
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

export function isWithinRecentDays(
  wornOn: string,
  today: string,
  days = RECENT_WEAR_DAYS,
): boolean {
  const delta = daysBetween(wornOn, today);
  return delta !== null && delta >= 0 && delta <= days;
}

export function outfitWearKey(itemIds: string[]): string {
  return itemIds.slice().sort().join("|");
}

export function sameDayWear<
  T extends { itemIds: string[]; wornOn: string; deletedAt?: number | undefined },
>(entries: T[], itemIds: string[], wornOn: string): T | undefined {
  const key = outfitWearKey(itemIds);
  return entries.find(
    (entry) => !entry.deletedAt && entry.wornOn === wornOn && outfitWearKey(entry.itemIds) === key,
  );
}

export function wearStats(
  itemId: string,
  entries: { itemIds: string[]; wornOn: string; deletedAt?: number | undefined }[],
): { count: number; lastOn?: string } {
  const days = entries
    .filter(
      (entry) => !entry.deletedAt && entry.itemIds.includes(itemId) && parseISODate(entry.wornOn),
    )
    .map((entry) => entry.wornOn)
    .sort();
  const lastOn = days.at(-1);
  if (!lastOn) return { count: 0 };
  return { count: days.length, lastOn };
}

export function formatWearLine(
  stats: { count: number; lastOn?: string | undefined },
  today: string,
): string {
  if (stats.count <= 0 || !stats.lastOn) return "Jamais portée";
  const fois = stats.count === 1 ? "1 fois" : `${stats.count} fois`;
  if (stats.lastOn === today) return `Portée ${fois} · dernière fois aujourd'hui`;
  const date = parseISODate(stats.lastOn);
  const label = date ? format(date, "d MMMM yyyy", { locale: fr }) : stats.lastOn;
  return `Portée ${fois} · dernière fois le ${label}`;
}

export function formatWornHeading(wornOn: string, today: string): string {
  if (wornOn === today) return "Aujourd'hui";
  const yesterday = shiftISODate(today, -1);
  if (yesterday && wornOn === yesterday) return "Hier";
  const date = parseISODate(wornOn);
  if (!date) return wornOn;
  const label = format(date, "EEEE d MMMM yyyy", { locale: fr });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function neverWornIds(
  garmentIds: string[],
  entries: { itemIds: string[]; deletedAt?: number | undefined }[],
): string[] {
  const used = new Set(
    entries.filter((entry) => !entry.deletedAt).flatMap((entry) => entry.itemIds),
  );
  return garmentIds.filter((id) => !used.has(id));
}

export function neverWornHint(names: string[]): string | null {
  if (names.length === 0) return null;
  const shown = names.slice(0, 3);
  const extra = names.length - shown.length;
  const tail = extra > 0 ? ` et ${extra} autre${extra > 1 ? "s" : ""}` : "";
  const prefix =
    names.length === 1 ? "1 pièce jamais portée" : `${names.length} pièces jamais portées`;
  return `${prefix} : ${shown.join(", ")}${tail}.`;
}

export function groupWornByDate<T extends { wornOn: string; createdAt: number }>(
  entries: T[],
): { wornOn: string; entries: T[] }[] {
  const groups = new Map<string, T[]>();
  const ordered = entries.slice().sort((a, b) => b.createdAt - a.createdAt);
  for (const entry of ordered) {
    const list = groups.get(entry.wornOn) ?? [];
    list.push(entry);
    groups.set(entry.wornOn, list);
  }
  return [...groups.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0))
    .map(([wornOn, items]) => ({ wornOn, entries: items }));
}

export function wornFromBackup(raw: unknown, now = Date.now()): WornEntry {
  if (!raw || typeof raw !== "object")
    throw new Error("Ce fichier n'est pas une sauvegarde Vestiaire.");
  const row = raw as Record<string, unknown>;
  const wornOn = row["wornOn"];
  if (
    typeof row["id"] !== "string" ||
    typeof wornOn !== "string" ||
    !parseISODate(wornOn) ||
    !Array.isArray(row["itemIds"])
  ) {
    throw new Error("Ce fichier n'est pas une sauvegarde Vestiaire.");
  }
  const itemIds = row["itemIds"].filter((id): id is string => typeof id === "string").slice(0, 12);
  if (!itemIds.length) throw new Error("Ce fichier n'est pas une sauvegarde Vestiaire.");
  const entry: WornEntry = {
    id: row["id"],
    mode: "perso",
    wornOn,
    itemIds,
    name:
      typeof row["name"] === "string" && row["name"].trim()
        ? row["name"].trim().slice(0, 200)
        : "Tenue portée",
    createdAt: typeof row["createdAt"] === "number" ? row["createdAt"] : now,
  };
  if (typeof row["outfitId"] === "string" && row["outfitId"]) entry.outfitId = row["outfitId"];
  return entry;
}
