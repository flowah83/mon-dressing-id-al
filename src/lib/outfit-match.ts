/** Same pieces, whatever the order they were picked in. */
export function outfitKey(itemIds: string[]): string {
  return [...itemIds].sort().join("|");
}

export function findOutfitByPieces<T extends { itemIds: string[]; deletedAt?: number | undefined }>(
  outfits: T[],
  itemIds: string[],
): T | undefined {
  const key = outfitKey(itemIds);
  if (!key) return undefined;
  return outfits.find((outfit) => !outfit.deletedAt && outfitKey(outfit.itemIds) === key);
}
