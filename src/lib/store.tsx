import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cachedObjectUrl, imageCacheKey } from "./image-cache";
import * as db from "./db";
import { requestSync } from "./sync-bridge";
import { localDateISO, sameDayWear, shiftISODate } from "./wear";
import type { Garment, Mode, Outfit, WornEntry } from "./wardrobe";
import tshirt from "@/assets/demo/tshirt.jpg";
import jean from "@/assets/demo/jean.jpg";
import blazer from "@/assets/demo/blazer.jpg";
import baskets from "@/assets/demo/baskets.jpg";
import chino from "@/assets/demo/chino.jpg";
import robe from "@/assets/demo/robe.jpg";
import bottines from "@/assets/demo/bottines.jpg";
import chemise from "@/assets/demo/chemise.jpg";

const MODE_KEY = "vestiaire-mode";

interface ModeCtx {
  mode: Mode;
  ready: boolean;
  setMode: (m: Mode) => void;
}
const Ctx = createContext<ModeCtx>({ mode: "perso", ready: false, setMode: () => {} });

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<Mode>("perso");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const m = window.localStorage.getItem(MODE_KEY);
    if (m === "demo") setModeState("demo");
    setReady(true);
  }, []);
  const setMode = useCallback((m: Mode) => {
    window.localStorage.setItem(MODE_KEY, m);
    setModeState(m);
  }, []);
  return <Ctx.Provider value={{ mode, ready, setMode }}>{children}</Ctx.Provider>;
}
export const useMode = () => useContext(Ctx);

const localList = {
  staleTime: Number.POSITIVE_INFINITY,
  gcTime: 30 * 60_000,
  refetchOnWindowFocus: false,
} as const;

export function useGarments() {
  const { mode, ready } = useMode();
  return useQuery({
    queryKey: ["garments", mode],
    queryFn: () => db.listGarments(mode),
    enabled: ready,
    ...localList,
  });
}
export function useOutfits() {
  const { mode, ready } = useMode();
  return useQuery({
    queryKey: ["outfits", mode],
    queryFn: () => db.listOutfits(mode),
    enabled: ready,
    ...localList,
  });
}
export function useWorn() {
  const { mode, ready } = useMode();
  return useQuery({
    queryKey: ["worn", mode],
    queryFn: () => db.listWorn(mode),
    enabled: ready,
    ...localList,
  });
}
export function useGarment(id: string) {
  const { ready } = useMode();
  return useQuery({
    queryKey: ["garment", id],
    queryFn: async () => (await db.getGarment(id)) ?? null,
    enabled: ready,
  });
}

function stamp<T extends { updatedAt?: number }>(row: T): T {
  return { ...row, updatedAt: Date.now() };
}

export function useSaveGarment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (g: Garment) => {
      const next = stamp(g);
      await db.putGarment(next);
      if (next.mode === "perso") requestSync();
    },
    onSuccess: () => qc.invalidateQueries(),
  });
}
export function useDeleteGarment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (g: Garment) => {
      await db.removeGarmentEverywhere(g);
      if (g.mode === "perso") requestSync();
    },
    onSuccess: () => qc.invalidateQueries(),
  });
}
export function useSaveOutfit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (o: Outfit) => {
      const next = stamp(o);
      await db.putOutfit(next);
      if (next.mode === "perso") requestSync();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["outfits"] }),
  });
}
export function useDeleteOutfit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const existing = await db.getOutfitRaw(id);
      await db.deleteOutfit(id);
      if (!existing || existing.mode === "perso") requestSync();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["outfits"] }),
  });
}
export function useSaveWorn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: WornEntry) => {
      const existing = await db.listWornRaw(entry.mode);
      const same = sameDayWear(existing, entry.itemIds, entry.wornOn);
      if (same) return same;
      const next = stamp(entry);
      await db.putWorn(next);
      if (next.mode === "perso") requestSync();
      return next;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["worn"] }),
  });
}
export function useDeleteWorn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const existing = await db.getWornRaw(id);
      await db.deleteWorn(id);
      if (!existing || existing.mode === "perso") requestSync();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["worn"] }),
  });
}

/** URL stable pour une photo. Le cache mémoire évite de redécoder à chaque onglet. */
export function useImageSrc(
  g?: (Pick<Garment, "image" | "imageUrl"> & Partial<Pick<Garment, "id" | "updatedAt">>) | null,
) {
  const image = g?.image;
  const imageUrl = g?.imageUrl;
  const id = g?.id;
  const updatedAt = g?.updatedAt;
  return useMemo(() => {
    if (!image) return imageUrl;
    return cachedObjectUrl(
      imageCacheKey({
        image,
        ...(id ? { id } : {}),
        ...(imageUrl ? { imageUrl } : {}),
        ...(updatedAt != null ? { updatedAt } : {}),
      }),
      image,
    );
  }, [image, imageUrl, id, updatedAt]);
}

const DEMO: Omit<Garment, "id" | "mode" | "createdAt" | "available" | "favorite" | "notes">[] = [
  {
    name: "T-shirt blanc col rond",
    category: "haut",
    colors: ["blanc"],
    pattern: "uni",
    style: "decontracte",
    seasons: ["printemps", "ete", "automne"],
    imageUrl: tshirt,
  },
  {
    name: "Chemise oxford bleu ciel",
    category: "haut",
    colors: ["bleu"],
    pattern: "uni",
    style: "classique",
    seasons: ["printemps", "ete", "automne", "hiver"],
    imageUrl: chemise,
  },
  {
    name: "Jean droit brut",
    category: "bas",
    colors: ["denim"],
    pattern: "uni",
    style: "decontracte",
    seasons: ["printemps", "automne", "hiver"],
    imageUrl: jean,
  },
  {
    name: "Chino beige",
    category: "bas",
    colors: ["beige"],
    pattern: "uni",
    style: "classique",
    seasons: ["printemps", "ete", "automne"],
    imageUrl: chino,
  },
  {
    name: "Robe midi olive",
    category: "robe",
    colors: ["kaki"],
    pattern: "uni",
    style: "chic",
    seasons: ["printemps", "ete"],
    imageUrl: robe,
  },
  {
    name: "Blazer marine",
    category: "veste",
    colors: ["marine"],
    pattern: "uni",
    style: "classique",
    seasons: ["printemps", "automne", "hiver"],
    imageUrl: blazer,
  },
  {
    name: "Baskets cuir blanc",
    category: "chaussures",
    colors: ["blanc"],
    pattern: "uni",
    style: "minimaliste",
    seasons: ["printemps", "ete", "automne"],
    imageUrl: baskets,
  },
  {
    name: "Bottines chelsea cognac",
    category: "chaussures",
    colors: ["marron"],
    pattern: "uni",
    style: "classique",
    seasons: ["automne", "hiver", "printemps"],
    imageUrl: bottines,
  },
];

export async function seedDemo() {
  const existing = await db.listGarments("demo");
  if (existing.length) return;
  const now = Date.now();
  await Promise.all(
    DEMO.map((d, i) =>
      db.putGarment({
        ...d,
        id: `demo-${i}`,
        mode: "demo",
        available: true,
        favorite: i === 0,
        notes: "",
        createdAt: now - i * 1000,
      }),
    ),
  );
  const today = localDateISO();
  const samples = [
    { shift: -1, ids: ["demo-1", "demo-3", "demo-7"], name: "Chemise et chino" },
    { shift: -2, ids: ["demo-4", "demo-7"], name: "Robe midi" },
    { shift: -4, ids: ["demo-5"], name: "Blazer marine" },
  ];
  await Promise.all(
    samples.map((sample, index) => {
      const wornOn = shiftISODate(today, sample.shift);
      if (!wornOn) return Promise.resolve();
      return db.putWorn({
        id: `demo-worn-${index}`,
        mode: "demo",
        wornOn,
        itemIds: sample.ids,
        name: sample.name,
        createdAt: now - index,
      });
    }),
  );
}

export function useDemoControls() {
  const { setMode } = useMode();
  const qc = useQueryClient();
  return useMemo(
    () => ({
      async start() {
        await seedDemo();
        setMode("demo");
        await qc.invalidateQueries();
      },
      exit() {
        setMode("perso");
        qc.invalidateQueries();
      },
      async clear() {
        await db.clearMode("demo");
        setMode("perso");
        await qc.invalidateQueries();
      },
    }),
    [qc, setMode],
  );
}
