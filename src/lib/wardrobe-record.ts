import { parseISODate } from "./wear";
import type { Category, Garment, Outfit, Season, StyleTag, WornEntry } from "./wardrobe";
import { CATEGORIES, SEASONS, STYLES } from "./wardrobe";

export interface GarmentRow {
  id: string;
  user_id: string;
  name: string;
  category: string;
  colors: string[];
  pattern: string;
  style: string;
  seasons: string[];
  available: boolean;
  favorite: boolean;
  notes: string;
  image_path: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface OutfitRow {
  id: string;
  user_id: string;
  name: string;
  item_ids: string[];
  source: string;
  explanation: string | null;
  feedback: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

function asCategory(value: string): Category {
  return CATEGORIES.some((item) => item.value === value) ? (value as Category) : "haut";
}

function asStyle(value: string): StyleTag {
  return STYLES.some((item) => item.value === value) ? (value as StyleTag) : "classique";
}

function asSeasons(value: unknown): Season[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Season => SEASONS.some((season) => season.value === item));
}

function asStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function parseTime(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return fallback;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function garmentStamp(garment: Pick<Garment, "createdAt" | "updatedAt">): number {
  return garment.updatedAt ?? garment.createdAt;
}

export function outfitStamp(outfit: Pick<Outfit, "createdAt" | "updatedAt">): number {
  return outfit.updatedAt ?? outfit.createdAt;
}

export function asGarmentRow(value: unknown, userId: string): GarmentRow | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row["id"] !== "string" || typeof row["name"] !== "string") return null;
  const created =
    typeof row["created_at"] === "string" ? row["created_at"] : new Date(0).toISOString();
  const updated = typeof row["updated_at"] === "string" ? row["updated_at"] : created;
  return {
    id: row["id"],
    user_id: typeof row["user_id"] === "string" ? row["user_id"] : userId,
    name: row["name"],
    category: typeof row["category"] === "string" ? row["category"] : "haut",
    colors: asStrings(row["colors"]),
    pattern: typeof row["pattern"] === "string" ? row["pattern"] : "uni",
    style: typeof row["style"] === "string" ? row["style"] : "classique",
    seasons: asStrings(row["seasons"]),
    available: row["available"] !== false,
    favorite: row["favorite"] === true,
    notes: typeof row["notes"] === "string" ? row["notes"] : "",
    image_path: typeof row["image_path"] === "string" ? row["image_path"] : null,
    created_at: created,
    updated_at: updated,
    deleted_at: typeof row["deleted_at"] === "string" ? row["deleted_at"] : null,
  };
}

export function asOutfitRow(value: unknown, userId: string): OutfitRow | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row["id"] !== "string" || typeof row["name"] !== "string") return null;
  const created =
    typeof row["created_at"] === "string" ? row["created_at"] : new Date(0).toISOString();
  const updated = typeof row["updated_at"] === "string" ? row["updated_at"] : created;
  const feedback = row["feedback"];
  return {
    id: row["id"],
    user_id: typeof row["user_id"] === "string" ? row["user_id"] : userId,
    name: row["name"],
    item_ids: asStrings(row["item_ids"]),
    source: row["source"] === "conseiller" ? "conseiller" : "manuel",
    explanation: typeof row["explanation"] === "string" ? row["explanation"] : null,
    feedback: feedback === "like" || feedback === "dislike" ? feedback : null,
    created_at: created,
    updated_at: updated,
    deleted_at: typeof row["deleted_at"] === "string" ? row["deleted_at"] : null,
  };
}

export function garmentToRow(
  garment: Garment,
  userId: string,
  imagePath: string | null,
): GarmentRow {
  return {
    id: garment.id,
    user_id: userId,
    name: garment.name,
    category: garment.category,
    colors: garment.colors,
    pattern: garment.pattern,
    style: garment.style,
    seasons: garment.seasons,
    available: garment.available,
    favorite: garment.favorite,
    notes: garment.notes ?? "",
    image_path: imagePath,
    created_at: new Date(garment.createdAt).toISOString(),
    updated_at: new Date(garmentStamp(garment)).toISOString(),
    deleted_at: garment.deletedAt ? new Date(garment.deletedAt).toISOString() : null,
  };
}

export function outfitToRow(outfit: Outfit, userId: string): OutfitRow {
  return {
    id: outfit.id,
    user_id: userId,
    name: outfit.name,
    item_ids: outfit.itemIds,
    source: outfit.source,
    explanation: outfit.explanation ?? null,
    feedback: outfit.feedback ?? null,
    created_at: new Date(outfit.createdAt).toISOString(),
    updated_at: new Date(outfitStamp(outfit)).toISOString(),
    deleted_at: outfit.deletedAt ? new Date(outfit.deletedAt).toISOString() : null,
  };
}

export function rowToGarment(row: GarmentRow, image?: Blob | undefined): Garment {
  const garment: Garment = {
    id: row.id,
    mode: "perso",
    name: row.name,
    category: asCategory(row.category),
    colors: row.colors,
    pattern: row.pattern,
    style: asStyle(row.style),
    seasons: asSeasons(row.seasons),
    available: row.available,
    favorite: row.favorite,
    notes: row.notes,
    createdAt: parseTime(row.created_at),
    updatedAt: parseTime(row.updated_at, parseTime(row.created_at)),
  };
  if (image) garment.image = image;
  if (row.image_path) garment.imagePath = row.image_path;
  const deletedAt = row.deleted_at ? parseTime(row.deleted_at) : 0;
  if (deletedAt) garment.deletedAt = deletedAt;
  return garment;
}

export interface WornRow {
  id: string;
  user_id: string;
  worn_on: string;
  item_ids: string[];
  outfit_id: string | null;
  name: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export function wornStamp(entry: Pick<WornEntry, "createdAt" | "updatedAt">): number {
  return entry.updatedAt ?? entry.createdAt;
}

export function asWornRow(value: unknown, userId: string): WornRow | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row["id"] !== "string") return null;
  const wornOn = typeof row["worn_on"] === "string" ? row["worn_on"] : "";
  if (!parseISODate(wornOn)) return null;
  const itemIds = asStrings(row["item_ids"]).slice(0, 12);
  if (!itemIds.length) return null;
  const created =
    typeof row["created_at"] === "string" ? row["created_at"] : new Date(0).toISOString();
  const updated = typeof row["updated_at"] === "string" ? row["updated_at"] : created;
  const name = typeof row["name"] === "string" ? row["name"].slice(0, 200) : "";
  return {
    id: row["id"],
    user_id: typeof row["user_id"] === "string" ? row["user_id"] : userId,
    worn_on: wornOn,
    item_ids: itemIds,
    outfit_id: typeof row["outfit_id"] === "string" && row["outfit_id"] ? row["outfit_id"] : null,
    name,
    created_at: created,
    updated_at: updated,
    deleted_at: typeof row["deleted_at"] === "string" ? row["deleted_at"] : null,
  };
}

export function wornToRow(entry: WornEntry, userId: string): WornRow {
  return {
    id: entry.id,
    user_id: userId,
    worn_on: entry.wornOn,
    item_ids: entry.itemIds.slice(0, 12),
    outfit_id: entry.outfitId ?? null,
    name: entry.name,
    created_at: new Date(entry.createdAt).toISOString(),
    updated_at: new Date(wornStamp(entry)).toISOString(),
    deleted_at: entry.deletedAt ? new Date(entry.deletedAt).toISOString() : null,
  };
}

export function rowToWorn(row: WornRow): WornEntry {
  const entry: WornEntry = {
    id: row.id,
    mode: "perso",
    wornOn: row.worn_on,
    itemIds: row.item_ids,
    name: row.name || "Tenue portée",
    createdAt: parseTime(row.created_at),
    updatedAt: parseTime(row.updated_at, parseTime(row.created_at)),
  };
  if (row.outfit_id) entry.outfitId = row.outfit_id;
  const deletedAt = row.deleted_at ? parseTime(row.deleted_at) : 0;
  if (deletedAt) entry.deletedAt = deletedAt;
  return entry;
}

export function rowToOutfit(row: OutfitRow): Outfit {
  const outfit: Outfit = {
    id: row.id,
    mode: "perso",
    name: row.name,
    itemIds: row.item_ids,
    source: row.source === "conseiller" ? "conseiller" : "manuel",
    createdAt: parseTime(row.created_at),
    updatedAt: parseTime(row.updated_at, parseTime(row.created_at)),
  };
  if (row.explanation) outfit.explanation = row.explanation;
  if (row.feedback === "like" || row.feedback === "dislike") outfit.feedback = row.feedback;
  const deletedAt = row.deleted_at ? parseTime(row.deleted_at) : 0;
  if (deletedAt) outfit.deletedAt = deletedAt;
  return outfit;
}
