import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Camera, Heart, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { GarmentForm, type GarmentFields } from "@/components/vestiaire/GarmentForm";
import { BusyStatus, EmptyState, GarmentImage, Page, PageHeader } from "@/components/vestiaire/ui";
import { usePhotoCutout } from "@/hooks/use-photo-cutout";
import { uid } from "@/lib/db";
import { blobFromGarment, copyToPersonal } from "@/lib/garment-copy";
import { useDeleteGarment, useGarment, useSaveGarment, useWorn } from "@/lib/store";
import { localDateISO, parseISODate, shiftISODate, wearStats } from "@/lib/wear";
import { catLabel, colorInfo, SEASONS, type Garment } from "@/lib/wardrobe";

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
  const cutout = usePhotoCutout();
  const { data: worn = [] } = useWorn();
  const navigate = useNavigate();
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
      const result = await cutout.run(file);
      if (!result) return;
      const removed = result.removed && !result.skipped;
      const {
        imageUrl: _imageUrl,
        imagePath: _imagePath,
        sourceImage: _source,
        backgroundRemoved: _flag,
        ...rest
      } = g;
      await save.mutateAsync({
        ...rest,
        ...f,
        name: f.name.trim() || g.name,
        image: removed ? result.display : result.source,
        ...(removed ? { sourceImage: result.source, backgroundRemoved: true } : {}),
      });
      if (result.skipped) toast.message("Photo d'origine conservée");
      else if (result.removed) toast.success("Fond retiré");
      else toast.message("Détourage impossible, la photo d'origine est conservée.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function detachCurrent() {
    if (!g || !f) return;
    try {
      const blob = await blobFromGarment(g);
      if (!blob) {
        toast.error("Ajoutez d'abord une photo.");
        return;
      }
      const result = await cutout.run(blob);
      if (!result || result.skipped) {
        if (result?.skipped) toast.message("Détourage ignoré");
        return;
      }
      if (!result.removed) {
        toast.message("Détourage impossible, la photo d'origine est conservée.");
        return;
      }
      const { imageUrl: _imageUrl, ...rest } = g;
      await save.mutateAsync({
        ...rest,
        ...f,
        name: f.name.trim() || g.name,
        image: result.display,
        sourceImage: result.source,
        backgroundRemoved: true,
      });
      toast.success("Fond retiré");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function restoreOriginal() {
    if (!g?.sourceImage || !f) return;
    const { backgroundRemoved: _flag, sourceImage, ...rest } = g;
    await save.mutateAsync({ ...rest, ...f, name: f.name.trim() || g.name, image: sourceImage });
    toast.success("Photo d'origine rétablie");
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
      <PageHeader back title={g.name} />
      <div className="grid gap-8 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div>
          <div className="relative">
            <div style={{ viewTransitionName: `garment-${g.id}` }}>
              <GarmentImage
                g={g}
                eager
                definition="full"
                className="fiche-photo aspect-[4/5] w-full rounded-[18px]"
              />
            </div>
            <button
              type="button"
              className="fiche-photo-btn press"
              aria-label="Changer la photo"
              disabled={cutout.phase === "working"}
              onClick={() => fileRef.current?.click()}
            >
              <Camera className="size-5" strokeWidth={1.75} />
            </button>
          </div>
          {cutout.phase === "working" && (
            <div className="mt-3">
              <BusyStatus
                label={cutout.label}
                action={
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 w-full"
                    onClick={cutout.skip}
                  >
                    Ignorer le détourage
                  </Button>
                }
              />
            </div>
          )}
          <FicheFacts g={g} worn={worn} />
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
          {g.backgroundRemoved && g.sourceImage ? (
            <Button
              type="button"
              variant="outline"
              className="mt-2 min-h-11 w-full"
              disabled={cutout.phase === "working"}
              onClick={() => void restoreOriginal()}
            >
              Revenir à la photo d'origine
            </Button>
          ) : (
            (g.image || g.imageUrl) &&
            !g.backgroundRemoved && (
              <Button
                type="button"
                variant="outline"
                className="mt-2 min-h-11 w-full"
                disabled={cutout.phase === "working"}
                onClick={() => void detachCurrent()}
              >
                Détourer cette photo
              </Button>
            )
          )}
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
            <Button type="button" className="mt-4 min-h-11 w-full" onClick={() => void keep()}>
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

function FicheFacts({
  g,
  worn,
}: {
  g: Garment;
  worn: { itemIds: string[]; wornOn: string; deletedAt?: number | undefined }[];
}) {
  const stats = wearStats(g.id, worn);
  const today = localDateISO();
  const color =
    g.colors.map((value) => colorInfo(value)?.label ?? value).join(", ") || "Non renseignée";
  const season = g.seasons.length
    ? g.seasons
        .map((value) => SEASONS.find((item) => item.value === value)?.label ?? value)
        .join(", ")
    : "Toute l'année";
  const times = stats.count <= 0 ? "Jamais" : stats.count === 1 ? "1 fois" : `${stats.count} fois`;
  let last = "Jamais";
  if (stats.lastOn) {
    if (stats.lastOn === today) last = "Aujourd'hui";
    else if (stats.lastOn === shiftISODate(today, -1)) last = "Hier";
    else {
      const date = parseISODate(stats.lastOn);
      last = date ? format(date, "d MMMM yyyy", { locale: fr }) : stats.lastOn;
    }
  }
  const rows = [
    ["Catégorie", catLabel(g.category)],
    ["Couleur", color],
    ["Saison", season],
    ["Marque", "Non renseignée"],
    ["Portée", times],
    ["Dernière fois", last],
  ] as const;
  return (
    <dl className="inset-group">
      {rows.map(([label, value]) => (
        <div key={label} className="inset-row">
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
