export const PHOTO_BUCKET = "garment-photos";

export interface SyncItem {
  id: string;
  updatedAt: number;
  deletedAt?: number | null;
}

export type SyncAction = { type: "push" | "pull"; id: string };

export function isSafeStorageId(value: string): boolean {
  return /^[A-Za-z0-9_-]{1,80}$/.test(value);
}

/** Private object path: `{userId}/{garmentId}.jpg`. */
export function photoObjectPath(userId: string, garmentId: string): string | null {
  if (!isSafeStorageId(userId) || !isSafeStorageId(garmentId)) return null;
  return `${userId}/${garmentId}.jpg`;
}

/** True only when the object sits in that user's own folder. */
export function photoOwnedBy(path: string, userId: string): boolean {
  if (!isSafeStorageId(userId)) return false;
  const parts = path.split("/");
  if (parts.length !== 2) return false;
  const folder = parts[0];
  const file = parts[1];
  if (!folder || !file || folder !== userId || file.includes("..")) return false;
  return /^[A-Za-z0-9_-]{1,80}\.jpg$/.test(file);
}

function timeOf(item: SyncItem): number {
  return Number.isFinite(item.updatedAt) ? item.updatedAt : 0;
}

/** Last-writer-wins merge. Local-only rows are uploaded, never dropped. */
export function planSync(local: SyncItem[], remote: SyncItem[]): SyncAction[] {
  const localMap = new Map(local.map((item) => [item.id, item]));
  const remoteMap = new Map(remote.map((item) => [item.id, item]));
  const ids = [...new Set([...localMap.keys(), ...remoteMap.keys()])].sort();
  const actions: SyncAction[] = [];
  for (const id of ids) {
    const left = localMap.get(id);
    const right = remoteMap.get(id);
    if (left && !right) {
      actions.push({ type: "push", id });
      continue;
    }
    if (!left && right) {
      actions.push({ type: "pull", id });
      continue;
    }
    if (!left || !right) continue;
    const localTime = timeOf(left);
    const remoteTime = timeOf(right);
    if (localTime > remoteTime) actions.push({ type: "push", id });
    else if (remoteTime > localTime) actions.push({ type: "pull", id });
    else if (Boolean(left.deletedAt) !== Boolean(right.deletedAt)) {
      actions.push({ type: left.deletedAt ? "push" : "pull", id });
    }
  }
  return actions;
}

/**
 * A null owner means this phone has not been linked yet: the personal
 * wardrobe already on the device is copied into the account.
 * A different owner means the phone still holds someone else's copy:
 * that copy is replaced locally and never uploaded.
 */
export function planAccountSync(input: {
  cacheOwner: string | null;
  userId: string;
  localGarments: SyncItem[];
  remoteGarments: SyncItem[];
  localOutfits: SyncItem[];
  remoteOutfits: SyncItem[];
  localWorn?: SyncItem[];
  remoteWorn?: SyncItem[];
}): {
  wipeLocal: boolean;
  garmentActions: SyncAction[];
  outfitActions: SyncAction[];
  wornActions: SyncAction[];
} {
  const localWorn = input.localWorn ?? [];
  const remoteWorn = input.remoteWorn ?? [];
  const otherAccount = input.cacheOwner !== null && input.cacheOwner !== input.userId;
  if (otherAccount) {
    return {
      wipeLocal: true,
      garmentActions: input.remoteGarments.map((item) => ({ type: "pull" as const, id: item.id })),
      outfitActions: input.remoteOutfits.map((item) => ({ type: "pull" as const, id: item.id })),
      wornActions: remoteWorn.map((item) => ({ type: "pull" as const, id: item.id })),
    };
  }
  return {
    wipeLocal: false,
    garmentActions: planSync(input.localGarments, input.remoteGarments),
    outfitActions: planSync(input.localOutfits, input.remoteOutfits),
    wornActions: planSync(localWorn, remoteWorn),
  };
}
