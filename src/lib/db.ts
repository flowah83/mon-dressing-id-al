import type { Garment, Mode, Outfit } from "./wardrobe";

const DB_NAME = "vestiaire";
const VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("Stockage indisponible sur ce navigateur."));
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("garments")) db.createObjectStore("garments", { keyPath: "id" }).createIndex("mode", "mode");
        if (!db.objectStoreNames.contains("outfits")) db.createObjectStore("outfits", { keyPath: "id" }).createIndex("mode", "mode");
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

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
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
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const listGarments = (mode: Mode) =>
  tx<Garment[]>("garments", "readonly", (s) => s.index("mode").getAll(mode)).then((r) =>
    (r ?? []).sort((a, b) => b.createdAt - a.createdAt),
  );
export const getGarment = (id: string) => tx<Garment | undefined>("garments", "readonly", (s) => s.get(id));
export const putGarment = (g: Garment) => tx("garments", "readwrite", (s) => s.put(g));
export const deleteGarment = (id: string) => tx("garments", "readwrite", (s) => s.delete(id));

export const listOutfits = (mode: Mode) =>
  tx<Outfit[]>("outfits", "readonly", (s) => s.index("mode").getAll(mode)).then((r) =>
    (r ?? []).sort((a, b) => b.createdAt - a.createdAt),
  );
export const putOutfit = (o: Outfit) => tx("outfits", "readwrite", (s) => s.put(o));
export const deleteOutfit = (id: string) => tx("outfits", "readwrite", (s) => s.delete(id));

export async function clearMode(mode: Mode) {
  const [g, o] = await Promise.all([listGarments(mode), listOutfits(mode)]);
  await Promise.all([...g.map((x) => deleteGarment(x.id)), ...o.map((x) => deleteOutfit(x.id))]);
}

/** Remove a garment and drop it from any saved outfit of the same mode. */
export async function removeGarmentEverywhere(g: Garment) {
  await deleteGarment(g.id);
  const outfits = await listOutfits(g.mode);
  for (const o of outfits) {
    if (!o.itemIds.includes(g.id)) continue;
    const itemIds = o.itemIds.filter((i) => i !== g.id);
    if (itemIds.length === 0) await deleteOutfit(o.id);
    else await putOutfit({ ...o, itemIds });
  }
}

// ---------- export / import (personal data only) ----------
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
  const g = await Promise.all(
    garments.map(async ({ image, ...rest }) => ({ ...rest, imageData: image ? await blobToDataUrl(image) : null })),
  );
  return new Blob([JSON.stringify({ app: "vestiaire", version: 1, exportedAt: new Date().toISOString(), garments: g, outfits })], {
    type: "application/json",
  });
}

export async function importPersonal(file: File): Promise<{ garments: number; outfits: number }> {
  const data = JSON.parse(await file.text());
  if (data?.app !== "vestiaire" || !Array.isArray(data.garments)) throw new Error("Ce fichier n'est pas une sauvegarde Vestiaire.");
  let gc = 0;
  for (const raw of data.garments) {
    const { imageData, ...rest } = raw;
    const image = imageData ? await (await fetch(imageData)).blob() : undefined;
    await putGarment({ ...rest, mode: "perso", image });
    gc++;
  }
  let oc = 0;
  for (const o of data.outfits ?? []) {
    await putOutfit({ ...o, mode: "perso" });
    oc++;
  }
  return { garments: gc, outfits: oc };
}
