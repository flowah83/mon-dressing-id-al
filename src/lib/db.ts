import { wornFromBackup } from "./wear";
import type { Garment, Mode, Outfit, WornEntry } from "./wardrobe";

const DB_NAME = "vestiaire";
const VERSION = 2;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined")
    return Promise.reject(new Error("Stockage indisponible sur ce navigateur."));
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("garments"))
          db.createObjectStore("garments", { keyPath: "id" }).createIndex("mode", "mode");
        if (!db.objectStoreNames.contains("outfits"))
          db.createObjectStore("outfits", { keyPath: "id" }).createIndex("mode", "mode");
        if (!db.objectStoreNames.contains("worn"))
          db.createObjectStore("worn", { keyPath: "id" }).createIndex("mode", "mode");
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        dbPromise = null;
        reject(req.error ?? new Error("Impossible d'ouvrir le stockage local."));
      };
    });
  }
  return dbPromise;
}

function tx<T>(
  store: string,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        let result: T;
        if (req) req.onsuccess = () => (result = req.result);
        t.oncomplete = () => resolve(result);
        t.onerror = () => reject(t.error ?? new Error("Erreur de stockage."));
        t.onabort = () => reject(t.error ?? new Error("Stockage plein ou refusé."));
      }),
  );
}

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export async function listGarmentsRaw(mode: Mode): Promise<Garment[]> {
  const rows = await tx<Garment[]>("garments", "readonly", (s) => s.index("mode").getAll(mode));
  return rows ?? [];
}
export async function listOutfitsRaw(mode: Mode): Promise<Outfit[]> {
  const rows = await tx<Outfit[]>("outfits", "readonly", (s) => s.index("mode").getAll(mode));
  return rows ?? [];
}

export async function listGarments(mode: Mode) {
  const rows = await listGarmentsRaw(mode);
  return rows.filter((garment) => !garment.deletedAt).sort((a, b) => b.createdAt - a.createdAt);
}
export const getGarmentRaw = (id: string) =>
  tx<Garment | undefined>("garments", "readonly", (s) => s.get(id));
export async function getGarment(id: string) {
  const garment = await getGarmentRaw(id);
  if (!garment || garment.deletedAt) return undefined;
  return garment;
}
export const putGarment = (g: Garment) => tx("garments", "readwrite", (s) => s.put(g));
export const deleteGarment = (id: string) => tx("garments", "readwrite", (s) => s.delete(id));

export async function listOutfits(mode: Mode) {
  const rows = await listOutfitsRaw(mode);
  return rows.filter((outfit) => !outfit.deletedAt).sort((a, b) => b.createdAt - a.createdAt);
}
export const getOutfitRaw = (id: string) =>
  tx<Outfit | undefined>("outfits", "readonly", (s) => s.get(id));
export const putOutfit = (o: Outfit) => tx("outfits", "readwrite", (s) => s.put(o));
export const deleteOutfitHard = (id: string) => tx("outfits", "readwrite", (s) => s.delete(id));

export async function deleteOutfit(id: string) {
  const existing = await getOutfitRaw(id);
  if (!existing) return;
  if (existing.mode === "perso") {
    const now = Date.now();
    await putOutfit({ ...existing, deletedAt: now, updatedAt: now });
    return;
  }
  await deleteOutfitHard(id);
}

export async function listWornRaw(mode: Mode): Promise<WornEntry[]> {
  const rows = await tx<WornEntry[]>("worn", "readonly", (s) => s.index("mode").getAll(mode));
  return rows ?? [];
}
export async function listWorn(mode: Mode) {
  const rows = await listWornRaw(mode);
  return rows
    .filter((entry) => !entry.deletedAt)
    .sort((a, b) =>
      a.wornOn < b.wornOn ? 1 : a.wornOn > b.wornOn ? -1 : b.createdAt - a.createdAt,
    );
}
export const getWornRaw = (id: string) =>
  tx<WornEntry | undefined>("worn", "readonly", (s) => s.get(id));
export const putWorn = (entry: WornEntry) => tx("worn", "readwrite", (s) => s.put(entry));
export const deleteWornHard = (id: string) => tx("worn", "readwrite", (s) => s.delete(id));

export async function deleteWorn(id: string) {
  const existing = await getWornRaw(id);
  if (!existing) return;
  if (existing.mode === "perso") {
    const now = Date.now();
    await putWorn({ ...existing, deletedAt: now, updatedAt: now });
    return;
  }
  await deleteWornHard(id);
}

export async function clearMode(mode: Mode) {
  const [g, o, w] = await Promise.all([listGarments(mode), listOutfits(mode), listWorn(mode)]);
  await Promise.all([
    ...g.map((x) => deleteGarment(x.id)),
    ...o.map((x) => deleteOutfit(x.id)),
    ...w.map((x) => deleteWorn(x.id)),
  ]);
}

/** Remove a garment and drop it from any saved outfit of the same mode. Personal rows stay as tombstones so the account can sync the deletion. */
export async function removeGarmentEverywhere(g: Garment) {
  const now = Date.now();
  if (g.mode === "demo") await deleteGarment(g.id);
  else {
    const { image: _image, sourceImage: _source, backgroundRemoved: _cutout, ...rest } = g;
    await putGarment({ ...rest, deletedAt: now, updatedAt: now });
  }
  const outfits = await listOutfitsRaw(g.mode);
  for (const outfit of outfits) {
    if (outfit.deletedAt || !outfit.itemIds.includes(g.id)) continue;
    const itemIds = outfit.itemIds.filter((id) => id !== g.id);
    if (itemIds.length === 0) await deleteOutfit(outfit.id);
    else await putOutfit({ ...outfit, itemIds, updatedAt: now });
  }
}

const blobToDataUrl = (b: Blob) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(b);
  });

export async function exportPersonal(): Promise<Blob> {
  const garments = await listGarments("perso");
  const outfits = await listOutfits("perso");
  const worn = await listWorn("perso");
  const g = await Promise.all(
    garments.map(async ({ image, sourceImage, imagePath: _path, ...rest }) => ({
      ...rest,
      imageData: image ? await blobToDataUrl(image) : null,
      sourceImageData: sourceImage ? await blobToDataUrl(sourceImage) : null,
    })),
  );
  return new Blob(
    [
      JSON.stringify({
        app: "vestiaire",
        version: 2,
        exportedAt: new Date().toISOString(),
        garments: g,
        outfits,
        worn,
      }),
    ],
    { type: "application/json" },
  );
}

export async function importPersonal(file: File): Promise<{ garments: number; outfits: number }> {
  const data = JSON.parse(await file.text());
  if (data?.app !== "vestiaire" || !Array.isArray(data.garments))
    throw new Error("Ce fichier n'est pas une sauvegarde Vestiaire.");
  const now = Date.now();
  let gc = 0;
  for (const raw of data.garments) {
    if (!raw || typeof raw !== "object" || typeof raw.id !== "string")
      throw new Error("Ce fichier n'est pas une sauvegarde Vestiaire.");
    const {
      imageData,
      sourceImageData,
      deletedAt: _deleted,
      imagePath: _path,
      image: _image,
      sourceImage: _source,
      ...rest
    } = raw;
    const image = imageData ? await (await fetch(imageData)).blob() : undefined;
    const sourceImage = sourceImageData ? await (await fetch(sourceImageData)).blob() : undefined;
    const garment: Garment = { ...rest, mode: "perso", updatedAt: now };
    if (image) garment.image = image;
    if (sourceImage) garment.sourceImage = sourceImage;
    if (garment.backgroundRemoved !== true) delete garment.backgroundRemoved;
    await putGarment(garment);
    gc++;
  }
  let oc = 0;
  for (const raw of data.outfits ?? []) {
    if (!raw || typeof raw !== "object" || typeof raw.id !== "string")
      throw new Error("Ce fichier n'est pas une sauvegarde Vestiaire.");
    const { deletedAt: _deleted, ...rest } = raw;
    await putOutfit({ ...rest, mode: "perso", updatedAt: now });
    oc++;
  }
  for (const raw of Array.isArray(data.worn) ? data.worn : []) {
    const entry = wornFromBackup(raw, now);
    await putWorn({ ...entry, updatedAt: now });
  }
  return { garments: gc, outfits: oc };
}
