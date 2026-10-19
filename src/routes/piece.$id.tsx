import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Heart, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { GarmentForm, type GarmentFields } from "@/components/vestiaire/GarmentForm";
import { EmptyState, GarmentImage, Page, PageHeader } from "@/components/vestiaire/ui";
import { useDeleteGarment, useGarment, useSaveGarment } from "@/lib/store";

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

function Piece() {
  const { id } = Route.useParams();
  const { data: g, isLoading } = useGarment(id);
  const save = useSaveGarment();
  const del = useDeleteGarment();
  const navigate = useNavigate();
  const [f, setF] = useState<GarmentFields | null>(null);
  useEffect(() => {
    if (g) setF({ name: g.name, category: g.category, colors: g.colors, pattern: g.pattern, style: g.style, seasons: g.seasons, notes: g.notes });
  }, [g]);

  if (isLoading) return <Page><div className="mt-10 aspect-[4/5] animate-pulse rounded-3xl bg-muted" /></Page>;
  if (!g || !f) return <Page><div className="pt-safe" /><EmptyState title="Pièce introuvable" text="Elle a peut-être été supprimée."><Button asChild><Link to="/">Retour au dressing</Link></Button></EmptyState></Page>;

  const update = (patch: Partial<typeof g>) => save.mutate({ ...g, ...patch });

  return (
    <Page>
      <PageHeader eyebrow="Fiche" title={g.name} />
      <div className="grid gap-8 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div>
          <GarmentImage g={g} eager className="aspect-[4/5] rounded-3xl" />
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="chip" data-active={g.favorite} onClick={() => update({ favorite: !g.favorite })}><Heart className="size-4" /> Favori</button>
            <button className="chip" data-active={!g.available} onClick={() => update({ available: !g.available })}>{g.available ? "Disponible" : "Au lavage"}</button>
          </div>
          <Button asChild variant="outline" className="mt-4 w-full"><Link to="/conseiller" search={{ piece: g.id }}>Associer cette pièce</Link></Button>
        </div>
        <div>
          <GarmentForm value={f} onChange={setF} />
          <Button size="lg" className="mt-8 w-full" onClick={async () => { await save.mutateAsync({ ...g, ...f }); toast.success("Fiche enregistrée"); }}>Enregistrer les modifications</Button>
          <Button variant="ghost" className="mt-3 w-full text-destructive" onClick={async () => {
            if (!window.confirm(`Supprimer « ${g.name} » ? Cette action est définitive.`)) return;
            await del.mutateAsync(g);
            toast.success("Pièce supprimée");
            navigate({ to: "/" });
          }}><Trash2 /> Supprimer la pièce</Button>
        </div>
      </div>
    </Page>
  );
}
