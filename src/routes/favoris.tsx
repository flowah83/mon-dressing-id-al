import { createFileRoute, Link } from "@tanstack/react-router";
import { ThumbsDown, ThumbsUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collage, EmptyState, Page, PageHeader } from "@/components/vestiaire/ui";
import { useDeleteOutfit, useGarments, useOutfits, useSaveOutfit } from "@/lib/store";

export const Route = createFileRoute("/favoris")({
  head: () => ({
    meta: [
      { title: "Tenues favorites — Vestiaire" },
      { name: "description", content: "Vos tenues enregistrées et vos avis." },
      { property: "og:title", content: "Tenues favorites — Vestiaire" },
      { property: "og:description", content: "Vos tenues enregistrées et vos avis." },
    ],
  }),
  component: Favoris,
});

function Favoris() {
  const { data: outfits = [], isLoading } = useOutfits();
  const { data: items = [] } = useGarments();
  const save = useSaveOutfit();
  const del = useDeleteOutfit();
  return (
    <Page>
      <PageHeader eyebrow="Mes tenues" title="Favoris" />
      {!isLoading && outfits.length === 0 && (
        <EmptyState title="Aucune tenue gardée" text="Demandez des idées au conseiller et gardez celles qui vous plaisent."><Button asChild><Link to="/conseiller">Ouvrir le conseiller</Link></Button></EmptyState>
      )}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {outfits.map((o) => {
          const pieces = o.itemIds.map((id) => items.find((g) => g.id === id)).filter((g): g is NonNullable<typeof g> => !!g);
          return (
            <article key={o.id} className="rounded-3xl bg-card p-3 shadow-soft">
              <Collage items={pieces} />
              <input className="field mt-3 font-display !text-xl" defaultValue={o.name} aria-label="Nom de la tenue" onBlur={(e) => e.target.value.trim() && e.target.value !== o.name && save.mutate({ ...o, name: e.target.value.trim() })} />
              {o.explanation && <p className="mt-2 px-1 text-sm text-muted-foreground">{o.explanation}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="chip" data-active={o.feedback === "like"} onClick={() => save.mutate({ ...o, feedback: o.feedback === "like" ? undefined : "like" })}><ThumbsUp className="size-4" /> J'aime</button>
                <button className="chip" data-active={o.feedback === "dislike"} onClick={() => save.mutate({ ...o, feedback: o.feedback === "dislike" ? undefined : "dislike" })}><ThumbsDown className="size-4" /> Moins mon style</button>
                <button className="chip" aria-label="Supprimer la tenue" onClick={() => window.confirm("Supprimer cette tenue ?") && del.mutate(o.id)}><Trash2 className="size-4" /></button>
              </div>
            </article>
          );
        })}
      </div>
    </Page>
  );
}
