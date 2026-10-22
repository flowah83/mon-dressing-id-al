import { createFileRoute, Link } from "@tanstack/react-router";
import { ThumbsDown, ThumbsUp, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { WeekCard } from "@/components/vestiaire/ritual";
import { Collage, EmptyState, GarmentCard, HistoryLink, Page, PageHeader } from "@/components/vestiaire/ui";
import { useDeleteOutfit, useGarments, useOutfits, useSaveOutfit } from "@/lib/store";
import type { Outfit } from "@/lib/wardrobe";

export const Route = createFileRoute("/favoris")({
  head: () => ({
    meta: [
      { title: "Favoris — Vestiaire" },
      { name: "description", content: "Vos pièces au cœur et vos tenues enregistrées." },
      { property: "og:title", content: "Favoris — Vestiaire" },
      { property: "og:description", content: "Vos pièces au cœur et vos tenues enregistrées." },
    ],
  }),
  component: Favoris,
});

function Favoris() {
  const { data: outfits = [], isLoading } = useOutfits();
  const { data: items = [] } = useGarments();
  const save = useSaveOutfit();
  const del = useDeleteOutfit();
  const favorites = items.filter((g) => g.favorite);
  const empty = !isLoading && outfits.length === 0 && favorites.length === 0;
  return (
    <Page>
      <PageHeader eyebrow="Ce que vous aimez" title="Favoris" action={<HistoryLink />} />
      <WeekCard />
      {empty && (
        <EmptyState
          title="Rien en favori"
          text="Un cœur sur une pièce, ou « Je la porte » sur la tenue du jour."
        >
          <Button asChild>
            <Link to="/conseiller">Ouvrir le conseiller</Link>
          </Button>
        </EmptyState>
      )}
      {favorites.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-3xl">Pièces au cœur</h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
            {favorites.map((g) => (
              <GarmentCard key={g.id} g={g} />
            ))}
          </div>
        </section>
      )}
      {outfits.length > 0 && (
        <section>
          <h2 className="text-3xl">Tenues gardées</h2>
          <p className="mb-4 mt-2 text-sm text-muted-foreground">
            J'aime et Moins mon style guident les prochaines suggestions du conseiller.
          </p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {outfits.map((o) => {
              const pieces = o.itemIds
                .map((id) => items.find((g) => g.id === id))
                .filter((g): g is NonNullable<typeof g> => !!g);
              return (
                <article key={o.id} className="rounded-3xl bg-card p-3 shadow-soft">
                  <Collage items={pieces} />
                  <OutfitName outfit={o} onSave={(name) => save.mutate({ ...o, name })} />
                  {o.explanation && (
                    <p className="mt-2 px-1 text-sm text-muted-foreground">{o.explanation}</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="chip"
                      data-active={o.feedback === "like"}
                      onClick={() =>
                        save.mutate({ ...o, feedback: o.feedback === "like" ? undefined : "like" })
                      }
                    >
                      <ThumbsUp className="size-4" /> J'aime
                    </button>
                    <button
                      type="button"
                      className="chip"
                      data-active={o.feedback === "dislike"}
                      onClick={() =>
                        save.mutate({
                          ...o,
                          feedback: o.feedback === "dislike" ? undefined : "dislike",
                        })
                      }
                    >
                      <ThumbsDown className="size-4" /> Moins mon style
                    </button>
                    <button
                      type="button"
                      className="chip"
                      aria-label="Supprimer la tenue"
                      onClick={() => window.confirm("Supprimer cette tenue ?") && del.mutate(o.id)}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </Page>
  );
}

function OutfitName({ outfit, onSave }: { outfit: Outfit; onSave: (name: string) => void }) {
  const [value, setValue] = useState(outfit.name);
  const [focused, setFocused] = useState(false);
  const valueRef = useRef(value);
  valueRef.current = value;
  useEffect(() => {
    if (!focused) setValue(outfit.name);
  }, [outfit.name, focused]);

  function commit(next: string) {
    const name = next.trim();
    if (!name || name === outfit.name) return;
    onSave(name);
  }

  const onSaveRef = useRef(onSave);
  const savedName = useRef(outfit.name);
  onSaveRef.current = onSave;
  savedName.current = outfit.name;
  useEffect(() => {
    const timer = window.setTimeout(() => commit(valueRef.current), 400);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  useEffect(
    () => () => {
      const name = valueRef.current.trim();
      if (name && name !== savedName.current) onSaveRef.current(name);
    },
    [],
  );

  return (
    <input
      className="field mt-3 font-display !text-xl"
      value={value}
      aria-label="Nom de la tenue"
      onFocus={() => setFocused(true)}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        setFocused(false);
        commit(valueRef.current);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  );
}
