import * as db from "./db";
import { getSupabase, readCacheOwner } from "./cloud";
import { PHOTO_BUCKET, photoObjectPath, photoOwnedBy, planAccountSync, type SyncItem } from "./sync-plan";
import type { Garment, Outfit } from "./wardrobe";
import {
  asGarmentRow,
  asOutfitRow,
  garmentStamp,
  garmentToRow,
  outfitStamp,
  outfitToRow,
  rowToGarment,
  rowToOutfit,
  type GarmentRow,
  type OutfitRow,
} from "./wardrobe-record";

export const CLOUD_SAVE_ERROR =
  "La copie en ligne n'a pas abouti. Vos ajouts restent sur cet appareil et seront renvoyés plus tard.";

export interface LocalPort {
  listGarments(): Promise<Garment[]>;
  listOutfits(): Promise<Outfit[]>;
  writeGarment(garment: Garment): Promise<void>;
  writeOutfit(outfit: Outfit): Promise<void>;
  removeGarment(id: string): Promise<void>;
  removeOutfit(id: string): Promise<void>;
}

export interface CloudPort {
  listGarments(): Promise<GarmentRow[]>;
  listOutfits(): Promise<OutfitRow[]>;
  upsertGarment(row: GarmentRow): Promise<void>;
  upsertOutfit(row: OutfitRow): Promise<void>;
  uploadPhoto(path: string, body: Blob): Promise<void>;
  downloadPhoto(path: string): Promise<Blob | null>;
  deletePhoto(path: string): Promise<void>;
}

export type SyncOutcome =
  | {
      ok: true;
      pushed: number;
      pulled: number;
      claimedLocal: boolean;
      changedLocal: boolean;
      nextCacheOwner: string;
    }
  | { ok: false; message: string };

function garmentItem(garment: Garment): SyncItem {
  const item: SyncItem = { id: garment.id, updatedAt: garmentStamp(garment) };
  if (garment.deletedAt) item.deletedAt = garment.deletedAt;
  return item;
}

function outfitItem(outfit: Outfit): SyncItem {
  const item: SyncItem = { id: outfit.id, updatedAt: outfitStamp(outfit) };
  if (outfit.deletedAt) item.deletedAt = outfit.deletedAt;
  return item;
}

function rowItem(row: { id: string; updated_at: string; created_at: string; deleted_at: string | null }): SyncItem {
  const updatedAt = Date.parse(row.updated_at);
  const createdAt = Date.parse(row.created_at);
  const item: SyncItem = { id: row.id, updatedAt: Number.isFinite(updatedAt) ? updatedAt : Number.isFinite(createdAt) ? createdAt : 0 };
  if (row.deleted_at) {
    const deletedAt = Date.parse(row.deleted_at);
    if (Number.isFinite(deletedAt)) item.deletedAt = deletedAt;
  }
  return item;
}

export async function syncWardrobe(input: {
  userId: string;
  cacheOwner: string | null;
  local: LocalPort;
  cloud: CloudPort;
}): Promise<SyncOutcome> {
  const listedGarments = await input.local.listGarments();
  const listedOutfits = await input.local.listOutfits();
  let localGarments = listedGarments.filter((garment) => garment.mode === "perso");
  let localOutfits = listedOutfits.filter((outfit) => outfit.mode === "perso");
  const hadPersonal = localGarments.some((garment) => !garment.deletedAt) || localOutfits.some((outfit) => !outfit.deletedAt);

  const remoteGarments = await input.cloud.listGarments();
  const remoteOutfits = await input.cloud.listOutfits();
  const plan = planAccountSync({
    cacheOwner: input.cacheOwner,
    userId: input.userId,
    localGarments: localGarments.map(garmentItem),
    remoteGarments: remoteGarments.map(rowItem),
    localOutfits: localOutfits.map(outfitItem),
    remoteOutfits: remoteOutfits.map(rowItem),
  });

  let changedLocal = false;
  if (plan.wipeLocal) {
    for (const garment of localGarments) await input.local.removeGarment(garment.id);
    for (const outfit of localOutfits) await input.local.removeOutfit(outfit.id);
    localGarments = [];
    localOutfits = [];
    changedLocal = true;
  }

  let pushed = 0;
  let pulled = 0;
  const garmentsById = new Map(localGarments.map((garment) => [garment.id, garment]));
  const remoteGarmentsById = new Map(remoteGarments.map((row) => [row.id, row]));

  for (const action of plan.garmentActions) {
    if (action.type === "push") {
      const garment = garmentsById.get(action.id);
      if (!garment || garment.mode !== "perso") continue;
      let imagePath: string | null = null;
      const remote = remoteGarmentsById.get(garment.id);
      if (garment.deletedAt) {
        const path =
          garment.imagePath && photoOwnedBy(garment.imagePath, input.userId)
            ? garment.imagePath
            : remote?.image_path && photoOwnedBy(remote.image_path, input.userId)
              ? remote.image_path
              : photoObjectPath(input.userId, garment.id);
        if (path) await input.cloud.deletePhoto(path);
        imagePath = path;
      } else if (garment.image) {
        const path = photoObjectPath(input.userId, garment.id);
        if (!path) continue;
        await input.cloud.uploadPhoto(path, garment.image);
        imagePath = path;
        if (garment.imagePath !== path) {
          const next = { ...garment, imagePath: path };
          await input.local.writeGarment(next);
          garmentsById.set(garment.id, next);
          changedLocal = true;
        }
      } else if (garment.imagePath && photoOwnedBy(garment.imagePath, input.userId)) {
        imagePath = garment.imagePath;
      } else if (remote?.image_path && photoOwnedBy(remote.image_path, input.userId)) {
        imagePath = remote.image_path;
        if (garment.imagePath !== imagePath) {
          const next = { ...garment, imagePath };
          await input.local.writeGarment(next);
          garmentsById.set(garment.id, next);
          changedLocal = true;
        }
      }
      await input.cloud.upsertGarment(garmentToRow(garmentsById.get(action.id) ?? garment, input.userId, imagePath));
      pushed += 1;
      continue;
    }

    const row = remoteGarmentsById.get(action.id);
    if (!row) continue;
    const safePath = row.image_path && photoOwnedBy(row.image_path, input.userId) ? row.image_path : null;
    const previous = garmentsById.get(action.id);
    let image = previous?.image;
    if (row.deleted_at) image = undefined;
    else if (safePath && !(image && previous?.imagePath === safePath)) {
      image = (await input.cloud.downloadPhoto(safePath)) ?? undefined;
    }
    const next = rowToGarment({ ...row, image_path: safePath }, image);
    await input.local.writeGarment(next);
    garmentsById.set(next.id, next);
    changedLocal = true;
    pulled += 1;
  }

  for (const garment of garmentsById.values()) {
    if (garment.deletedAt || garment.image || !garment.imagePath || !photoOwnedBy(garment.imagePath, input.userId)) continue;
    const blob = await input.cloud.downloadPhoto(garment.imagePath);
    if (!blob) continue;
    await input.local.writeGarment({ ...garment, image: blob });
    changedLocal = true;
  }

  const outfitsById = new Map(localOutfits.map((outfit) => [outfit.id, outfit]));
  const remoteOutfitsById = new Map(remoteOutfits.map((row) => [row.id, row]));
  for (const action of plan.outfitActions) {
    if (action.type === "push") {
      const outfit = outfitsById.get(action.id);
      if (!outfit || outfit.mode !== "perso") continue;
      await input.cloud.upsertOutfit(outfitToRow(outfit, input.userId));
      pushed += 1;
      continue;
    }
    const row = remoteOutfitsById.get(action.id);
    if (!row) continue;
    await input.local.writeOutfit(rowToOutfit(row));
    changedLocal = true;
    pulled += 1;
  }

  return {
    ok: true,
    pushed,
    pulled,
    claimedLocal: input.cacheOwner === null && hadPersonal && pushed > 0 && !plan.wipeLocal,
    changedLocal,
    nextCacheOwner: input.userId,
  };
}

function supabasePort(supabase: NonNullable<ReturnType<typeof getSupabase>>, userId: string): CloudPort {
  return {
    async listGarments() {
      const { data, error } = await supabase.from("garments").select("*");
      if (error) throw new Error(error.message);
      return (data ?? []).map((item) => asGarmentRow(item, userId)).filter((row): row is GarmentRow => row !== null);
    },
    async listOutfits() {
      const { data, error } = await supabase.from("outfits").select("*");
      if (error) throw new Error(error.message);
      return (data ?? []).map((item) => asOutfitRow(item, userId)).filter((row): row is OutfitRow => row !== null);
    },
    async upsertGarment(row) {
      const { error } = await supabase.from("garments").upsert(row, { onConflict: "id" });
      if (error) throw new Error(error.message);
    },
    async upsertOutfit(row) {
      const { error } = await supabase.from("outfits").upsert(row, { onConflict: "id" });
      if (error) throw new Error(error.message);
    },
    async uploadPhoto(path, body) {
      const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, body, {
        upsert: true,
        contentType: body.type || "image/jpeg",
      });
      if (error) throw new Error(error.message);
    },
    async downloadPhoto(path) {
      const { data, error } = await supabase.storage.from(PHOTO_BUCKET).download(path);
      if (error) {
        if (/not found|404/i.test(error.message)) return null;
        throw new Error(error.message);
      }
      return data;
    },
    async deletePhoto(path) {
      const { error } = await supabase.storage.from(PHOTO_BUCKET).remove([path]);
      if (error && !/not found|404/i.test(error.message)) throw new Error(error.message);
    },
  };
}

const idbPort: LocalPort = {
  listGarments: () => db.listGarmentsRaw("perso"),
  listOutfits: () => db.listOutfitsRaw("perso"),
  writeGarment: async (garment) => {
    await db.putGarment(garment);
  },
  writeOutfit: async (outfit) => {
    await db.putOutfit(outfit);
  },
  removeGarment: (id) => db.deleteGarment(id),
  removeOutfit: (id) => db.deleteOutfitHard(id),
};

export async function syncPersonalAccount(userId: string): Promise<SyncOutcome> {
  const supabase = getSupabase();
  if (!supabase) {
    return { ok: false, message: "Le compte en ligne n'est pas encore activé. Votre dressing reste sur cet appareil." };
  }
  try {
    return await syncWardrobe({
      userId,
      cacheOwner: readCacheOwner(),
      local: idbPort,
      cloud: supabasePort(supabase, userId),
    });
  } catch (error) {
    console.error(error);
    return { ok: false, message: CLOUD_SAVE_ERROR };
  }
}
