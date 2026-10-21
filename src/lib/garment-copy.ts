import type { Garment } from "./wardrobe";

export async function blobFromGarment(
  g: Pick<Garment, "image" | "imageUrl">,
): Promise<Blob | undefined> {
  if (g.image && g.image.size > 0) return g.image;
  if (!g.imageUrl || typeof fetch === "undefined") return undefined;
  const res = await fetch(g.imageUrl);
  if (!res.ok) throw new Error("La photo n'a pas pu être copiée.");
  return await res.blob();
}

/** A personal copy. The demo original is left as it is. */
export function copyToPersonal(g: Garment, id: string, now: number, image?: Blob): Garment {
  const copy: Garment = {
    id,
    mode: "perso",
    name: g.name,
    category: g.category,
    colors: [...g.colors],
    pattern: g.pattern,
    style: g.style,
    seasons: [...g.seasons],
    available: g.available,
    favorite: g.favorite,
    notes: g.notes,
    createdAt: now,
    updatedAt: now,
  };
  if (image) copy.image = image;
  else if (g.imageUrl) copy.imageUrl = g.imageUrl;
  return copy;
}
