import { describe, expect, it } from "vitest";
import { syncWardrobe, type CloudPort, type LocalPort } from "./sync-engine";
import type { Garment, Outfit } from "./wardrobe";
import { garmentToRow, outfitToRow, rowToGarment, rowToOutfit, type GarmentRow, type OutfitRow } from "./wardrobe-record";

function garment(partial: Partial<Garment> & { id: string }): Garment {
  return {
    mode: "perso",
    name: partial.id,
    category: "haut",
    colors: ["noir"],
    pattern: "uni",
    style: "classique",
    seasons: ["hiver"],
    available: true,
    favorite: false,
    notes: "",
    createdAt: partial.updatedAt ?? 1,
    ...partial,
  };
}

function outfit(partial: Partial<Outfit> & { id: string }): Outfit {
  return {
    mode: "perso",
    name: partial.id,
    itemIds: [],
    source: "manuel",
    createdAt: partial.updatedAt ?? 1,
    ...partial,
  };
}

function memory() {
  const garments: GarmentRow[] = [];
  const outfits: OutfitRow[] = [];
  const photos = new Map<string, Blob>();
  const localG: Garment[] = [];
  const localO: Outfit[] = [];
  const cloud: CloudPort = {
    listGarments: async () => garments.map((row) => ({ ...row, colors: [...row.colors], seasons: [...row.seasons] })),
    listOutfits: async () => outfits.map((row) => ({ ...row, item_ids: [...row.item_ids] })),
    upsertGarment: async (row) => {
      const index = garments.findIndex((item) => item.id === row.id);
      if (index >= 0) garments[index] = row;
      else garments.push(row);
    },
    upsertOutfit: async (row) => {
      const index = outfits.findIndex((item) => item.id === row.id);
      if (index >= 0) outfits[index] = row;
      else outfits.push(row);
    },
    uploadPhoto: async (path, body) => {
      photos.set(path, body);
    },
    downloadPhoto: async (path) => photos.get(path) ?? null,
    deletePhoto: async (path) => {
      photos.delete(path);
    },
  };
  const local: LocalPort = {
    listGarments: async () => localG.map((item) => ({ ...item })),
    listOutfits: async () => localO.map((item) => ({ ...item })),
    writeGarment: async (item) => {
      const index = localG.findIndex((row) => row.id === item.id);
      if (index >= 0) localG[index] = item;
      else localG.push(item);
    },
    writeOutfit: async (item) => {
      const index = localO.findIndex((row) => row.id === item.id);
      if (index >= 0) localO[index] = item;
      else localO.push(item);
    },
    removeGarment: async (id) => {
      const index = localG.findIndex((row) => row.id === id);
      if (index >= 0) localG.splice(index, 1);
    },
    removeOutfit: async (id) => {
      const index = localO.findIndex((row) => row.id === id);
      if (index >= 0) localO.splice(index, 1);
    },
  };
  return { garments, outfits, photos, localG, localO, cloud, local };
}

describe("copie du dressing", () => {
  it("envoie les pièces locales, leurs photos, et ne les efface pas", async () => {
    const store = memory();
    const photo = new Blob(["photo"], { type: "image/jpeg" });
    store.localG.push(garment({ id: "manteau", name: "Manteau marine", image: photo, updatedAt: 5, favorite: true, notes: "chaud" }));
    store.localO.push(outfit({ id: "sortie", name: "Sortie", itemIds: ["manteau"], updatedAt: 6 }));

    const result = await syncWardrobe({ userId: "user-1", cacheOwner: null, local: store.local, cloud: store.cloud });

    expect(result).toMatchObject({ ok: true, claimedLocal: true, pushed: 2 });
    expect(store.garments.map((row) => row.name)).toEqual(["Manteau marine"]);
    expect(store.garments[0]?.user_id).toBe("user-1");
    expect(store.garments[0]?.favorite).toBe(true);
    expect(store.garments[0]?.notes).toBe("chaud");
    expect(store.photos.has("user-1/manteau.jpg")).toBe(true);
    expect(store.localG.map((item) => item.id)).toEqual(["manteau"]);
    expect(store.outfits[0]?.item_ids).toEqual(["manteau"]);
  });

  it("réunit les deux côtés sans perdre une pièce", async () => {
    const store = memory();
    store.localG.push(garment({ id: "local", name: "Local", updatedAt: 2 }));
    store.garments.push(garmentToRow(garment({ id: "distant", name: "Distant", updatedAt: 3, createdAt: 3 }), "user-1", "user-1/distant.jpg"));
    store.photos.set("user-1/distant.jpg", new Blob(["loin"]));

    const result = await syncWardrobe({ userId: "user-1", cacheOwner: "user-1", local: store.local, cloud: store.cloud });

    expect(result.ok).toBe(true);
    expect(store.garments.map((row) => row.id).sort()).toEqual(["distant", "local"]);
    expect(store.localG.map((item) => item.name).sort()).toEqual(["Distant", "Local"]);
    expect(store.localG.find((item) => item.id === "distant")?.image).toBeInstanceOf(Blob);
  });

  it("prend la fiche la plus récente et propage une suppression", async () => {
    const store = memory();
    store.localG.push(garment({ id: "piece", name: "Ancien", updatedAt: 1, imagePath: "user-1/piece.jpg" }));
    store.garments.push(garmentToRow(garment({ id: "piece", name: "Nouveau", updatedAt: 4, createdAt: 1 }), "user-1", "user-1/piece.jpg"));
    store.photos.set("user-1/piece.jpg", new Blob(["img"]));

    await syncWardrobe({ userId: "user-1", cacheOwner: "user-1", local: store.local, cloud: store.cloud });
    expect(store.localG[0]?.name).toBe("Nouveau");

    const current = store.localG[0]!;
    const { image: _image, ...rest } = current;
    store.localG[0] = { ...rest, deletedAt: 9, updatedAt: 9 };
    await syncWardrobe({ userId: "user-1", cacheOwner: "user-1", local: store.local, cloud: store.cloud });
    expect(store.garments[0]?.deleted_at).toBeTruthy();
    expect(store.photos.has("user-1/piece.jpg")).toBe(false);
  });

  it("ne copie pas le dressing local dans un autre compte et laisse la démo", async () => {
    const store = memory();
    store.localG.push(garment({ id: "secret", name: "Secret", updatedAt: 8, image: new Blob(["secret"]) }));
    store.localG.push(garment({ id: "demo-0", name: "Démo", mode: "demo", updatedAt: 8 }));
    store.localO.push(outfit({ id: "secret-tenue", updatedAt: 8 }));
    store.garments.push(garmentToRow(garment({ id: "chemise", name: "Chemise", updatedAt: 2, createdAt: 2 }), "user-b", null));

    const result = await syncWardrobe({ userId: "user-b", cacheOwner: "user-a", local: store.local, cloud: store.cloud });

    expect(result).toMatchObject({ ok: true, pushed: 0 });
    expect(store.garments.map((row) => row.id)).toEqual(["chemise"]);
    expect(store.photos.size).toBe(0);
    expect(store.localG.map((item) => item.id).sort()).toEqual(["chemise", "demo-0"]);
    expect(store.localO).toEqual([]);
    expect(store.outfits).toEqual([]);
  });

  it("garde la photo en ligne quand on corrige la fiche sans la reprendre", async () => {
    const store = memory();
    store.localG.push(garment({ id: "piece", name: "Retouché", notes: "ourlet", updatedAt: 5, createdAt: 1 }));
    store.garments.push(
      garmentToRow(garment({ id: "piece", name: "Ancien", updatedAt: 2, createdAt: 1 }), "user-1", "user-1/piece.jpg"),
    );
    store.photos.set("user-1/piece.jpg", new Blob(["img"]));

    await syncWardrobe({ userId: "user-1", cacheOwner: "user-1", local: store.local, cloud: store.cloud });

    expect(store.garments[0]?.image_path).toBe("user-1/piece.jpg");
    expect(store.garments[0]?.notes).toBe("ourlet");
    expect(store.photos.has("user-1/piece.jpg")).toBe(true);
    expect(store.localG[0]?.image).toBeInstanceOf(Blob);
  });

  it("ne télécharge pas la photo d'un autre dossier", async () => {
    const store = memory();
    store.garments.push(garmentToRow(garment({ id: "piece", name: "Pièce", updatedAt: 2, createdAt: 2 }), "user-1", "autre/piece.jpg"));
    store.photos.set("autre/piece.jpg", new Blob(["non"]));
    const downloads: string[] = [];
    store.cloud.downloadPhoto = async (path) => {
      downloads.push(path);
      return store.photos.get(path) ?? null;
    };

    await syncWardrobe({ userId: "user-1", cacheOwner: "user-1", local: store.local, cloud: store.cloud });

    expect(downloads).toEqual([]);
    expect(store.localG[0]?.image).toBeUndefined();
    expect(store.localG[0]?.imagePath).toBeUndefined();
  });
});

describe("fiche", () => {
  it("conserve les champs dans les deux sens", () => {
    const source = garment({
      id: "robe",
      name: "Robe midi",
      category: "robe",
      colors: ["kaki"],
      seasons: ["ete"],
      favorite: true,
      notes: "été",
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_100_000,
    });
    const row = garmentToRow(source, "user-1", "user-1/robe.jpg");
    const back = rowToGarment(row, new Blob(["x"]));
    expect(back.name).toBe("Robe midi");
    expect(back.colors).toEqual(["kaki"]);
    expect(back.favorite).toBe(true);
    expect(back.notes).toBe("été");
    expect(back.createdAt).toBe(source.createdAt);
    expect(back.updatedAt).toBe(source.updatedAt);
    expect(back.image).toBeInstanceOf(Blob);
    expect(back.mode).toBe("perso");

    const tenue = outfitToRow(outfit({ id: "t", name: "Soir", itemIds: ["robe"], source: "conseiller", explanation: "Douce", feedback: "like", updatedAt: 4, createdAt: 3 }), "user-1");
    expect(rowToOutfit(tenue)).toMatchObject({ name: "Soir", itemIds: ["robe"], source: "conseiller", explanation: "Douce", feedback: "like" });
  });
});
