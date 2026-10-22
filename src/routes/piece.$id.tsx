import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Camera, Heart, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { GarmentForm, type GarmentFields } from "@/components/vestiaire/GarmentForm";
import { useWornLog } from "@/components/vestiaire/ritual";
import { EmptyState, GarmentImage, Page, PageHeader } from "@/components/vestiaire/ui";
import { uid } from "@/lib/db";
import { blobFromGarment, copyToPersonal } from "@/lib/garment-copy";
import { compressImage } from "@/lib/image";
import { useDeleteGarment, useGarment, useSaveGarment } from "@/lib/store";
import type { Garment } from "@/lib/wardrobe";

export const Route = createFileRoute("/piece/$id")({
  head: () => ({
    meta: [
      { title: "Fiche vêtement — Vestiaire" },
      { name: "description", content: "Modifier une pièce de votre dressing." },
      { property: "og:title", content: "Fiche vêtement — Vestiaire" },
      { property: "og:description", content: "Modifier une pièce de votre dressing." },
    ],
  }),
  component: Piece,
});

function fieldsOf(g: Garment): GarmentFields {
  return {
    name: g.name,
    category: g.category,
    colors: g.colors,
    pattern: g.pattern,
    style: g.style,
    seasons: g.seasons,
    notes: g.notes,
  };
}

function sameFields(f: GarmentFields, g: Garment) {
  const list = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
  return (
    f.name === g.name &&
    f.category === g.category &&
    f.pattern === g.pattern &&
    f.style === g.style &&
    f.notes === g.notes &&
    list(f.colors, g.colors) &&
    list(f.seasons, g.seasons)
  );
}

function Piece() {
  const { id } = Route.useParams();
  const { data: g, isLoading } = useGarment(id);
  const save = useSaveGarment();
  const del = useDeleteGarment();
  const navigate = useNavigate();
  const worn = useWornLog();
  const fileRef = useRef<HTMLInputElement>(null);
  const [f, setF] = useState<GarmentFields | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const loadedFor = useRef<string | null>(null);
  const gRef = useRef(g);
  const saveRef = useRef(save);
  gRef.current = g;
  saveRef.current = save;

  useEffect(() => {
    if (!g || loadedFor.current === g.id) return;
    loadedFor.current = g.id;
    setF(fieldsOf(g));
  }, [g]);

  useEffect(() => {
    const current = gRef.current;
    if (!current || !f || sameFields(f, current)) return;
    const name = f.name.trim();
    if (!name) return;
    setStatus("saving");
    const timer = window.setTimeout(() => {
      void saveRef.current
        .mutateAsync({ ...current, ...f, name })
        .then(() => setStatus("saved"))
        .catch(() => setStatus("idle"));
    }, 450);
    return () => window.clearTimeout(timer);
  }, [f]);

  if (isLoading)
    return (
      <Page>
        <div className="pt-safe" />
        <div className="mt-10 aspect-[4/5] animate-pulse rounded-3xl bg-muted" />
      </Page>
    );
  if (!g || !f)
    return (
      <Page>
        <div className="pt-safe" />
        <EmptyState title="Pièce introuvable" text="Elle a peut-être été supprimée.">
          <Button asChild>
            <Link to="/">Retour au dressing</Link>
          </Button>
        </EmptyState>
      </Page>
    );

  const update = (patch: Partial<Garment>) =>
    save.mutate({ ...g, ...f, name: f.name.trim() || g.name, ...patch });

  async function onPhoto(file?: File) {
    if (!file || !g || !f) return;
    try {
      const image = await compressImage(file);
      const { imageUrl: _imageUrl, imagePath: _imagePath, ...rest } = g;
      await save.mutateAsync({ ...rest, ...f, name: f.name.trim() || g.name, image });
      toast.success("Photo mise à jour");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function keep() {
    if (!g) return;
    try {
      const image = await blobFromGarment(g);
      await save.mutateAsync(copyToPersonal(g, uid(), Date.now(), image));
      toast.success("Pièce gardée dans Mon dressing");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Page>
      <PageHeader back compact eyebrow="Fiche" title={g.name} />
      <div className="grid gap-8 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div>
          <GarmentImage g={g} eager className="aspect-[4/5] rounded-3xl" />
          {worn.entries.some((entry) => entry.itemIds.includes(g.id)) && (
            <p className="mt-3 text-sm text-muted-foreground">
              Portée {worn.entries.filter((entry) => entry.itemIds.includes(g.id)).length} fois
              {worn.entries.some((entry) => entry.date === worn.today && entry.itemIds.includes(g.id))
                ? " · dernière fois aujourd'hui"
                : ""}
            </p>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              void onPhoto(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            className="mt-4 min-h-11 w-full"
            onClick={() => fileRef.current?.click()}
          >
            <Camera /> Changer la photo
          </Button>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="chip"
              data-active={g.favorite}
              onClick={() => update({ favorite: !g.favorite })}
            >
              <Heart className="size-4" /> Favori
            </button>
            <button
              type="button"
              className="chip"
              data-active={!g.available}
              onClick={() => update({ available: !g.available })}
            >
              {g.available ? "Disponible" : "Au lavage"}
            </button>
          </div>
          {g.mode === "demo" && (
            <Button type="button" className="ios-fill mt-4 min-h-11 w-full" onClick={() => void keep()}>
              Garder dans Mon dressing
            </Button>
          )}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button asChild variant="outline">
              <Link to="/conseiller" search={{ piece: g.id }}>
                Associer cette pièce
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/composer" search={{ piece: g.id }}>
                Composer avec
              </Link>
            </Button>
          </div>
        </div>
        <div>
          <GarmentForm value={f} onChange={setF} />
          <p className="mt-4 text-sm text-muted-foreground" role="status">
            {status === "saving"
              ? "Enregistrement…"
              : status === "saved"
                ? "Modifications enregistrées"
                : "Les changements sont enregistrés tout seuls."}
          </p>
          <Button
            variant="ghost"
            className="mt-3 w-full text-destructive"
            onClick={async () => {
              if (!window.confirm(`Supprimer « ${g.name} » ? Cette action est définitive.`)) return;
              await del.mutateAsync(g);
              toast.success("Pièce supprimée");
              navigate({ to: "/" });
            }}
          >
            <Trash2 /> Supprimer la pièce
          </Button>
        </div>
      </div>
    </Page>
  );
}
