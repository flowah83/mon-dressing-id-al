import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as db from "./db";
import type { Garment, Mode, Outfit } from "./wardrobe";
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

export function useGarments() {
  const { mode, ready } = useMode();
  return useQuery({ queryKey: ["garments", mode], queryFn: () => db.listGarments(mode), enabled: ready });
}
export function useOutfits() {
  const { mode, ready } = useMode();
  return useQuery({ queryKey: ["outfits", mode], queryFn: () => db.listOutfits(mode), enabled: ready });
}
export function useGarment(id: string) {
  const { ready } = useMode();
  return useQuery({ queryKey: ["garment", id], queryFn: async () => (await db.getGarment(id)) ?? null, enabled: ready });
}

export function useSaveGarment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (g: Garment) => db.putGarment(g),
    onSuccess: () => qc.invalidateQueries(),
  });
}
export function useDeleteGarment() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (g: Garment) => db.removeGarmentEverywhere(g), onSuccess: () => qc.invalidateQueries() });
}
export function useSaveOutfit() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (o: Outfit) => db.putOutfit(o), onSuccess: () => qc.invalidateQueries({ queryKey: ["outfits"] }) });
}
export function useDeleteOutfit() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => db.deleteOutfit(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["outfits"] }) });
}

/** Object URLs for blob photos, revoked on unmount. */
export function useImageSrc(g?: Pick<Garment, "image" | "imageUrl"> | null) {
  const [src, setSrc] = useState<string | undefined>(g?.imageUrl);
  useEffect(() => {
    if (g?.image) {
      const u = URL.createObjectURL(g.image);
      setSrc(u);
      return () => URL.revokeObjectURL(u);
    }
    setSrc(g?.imageUrl);
    return undefined;
  }, [g?.image, g?.imageUrl]);
  return src;
}

const DEMO: Omit<Garment, "id" | "mode" | "createdAt" | "available" | "favorite" | "notes">[] = [
  { name: "T-shirt blanc col rond", category: "haut", colors: ["blanc"], pattern: "uni", style: "decontracte", seasons: ["printemps", "ete", "automne"], imageUrl: tshirt },
  { name: "Chemise oxford bleu ciel", category: "haut", colors: ["bleu"], pattern: "uni", style: "classique", seasons: ["printemps", "ete", "automne", "hiver"], imageUrl: chemise },
  { name: "Jean droit brut", category: "bas", colors: ["denim"], pattern: "uni", style: "decontracte", seasons: ["printemps", "automne", "hiver"], imageUrl: jean },
  { name: "Chino beige", category: "bas", colors: ["beige"], pattern: "uni", style: "classique", seasons: ["printemps", "ete", "automne"], imageUrl: chino },
  { name: "Robe midi olive", category: "robe", colors: ["kaki"], pattern: "uni", style: "chic", seasons: ["printemps", "ete"], imageUrl: robe },
  { name: "Blazer marine", category: "veste", colors: ["marine"], pattern: "uni", style: "classique", seasons: ["printemps", "automne", "hiver"], imageUrl: blazer },
  { name: "Baskets cuir blanc", category: "chaussures", colors: ["blanc"], pattern: "uni", style: "minimaliste", seasons: ["printemps", "ete", "automne"], imageUrl: baskets },
  { name: "Bottines chelsea cognac", category: "chaussures", colors: ["marron"], pattern: "uni", style: "classique", seasons: ["automne", "hiver", "printemps"], imageUrl: bottines },
];

export async function seedDemo() {
  const existing = await db.listGarments("demo");
  if (existing.length) return;
  const now = Date.now();
  await Promise.all(
    DEMO.map((d, i) =>
      db.putGarment({ ...d, id: `demo-${i}`, mode: "demo", available: true, favorite: false, notes: "", createdAt: now - i * 1000 }),
    ),
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
