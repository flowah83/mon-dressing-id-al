import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState, GarmentImage, Page, PageHeader } from "@/components/vestiaire/ui";
import { uid } from "@/lib/db";
import { findOutfitByPieces } from "@/lib/outfit-match";
import { useGarments, useMode, useOutfits, useSaveOutfit } from "@/lib/store";
import { CATEGORIES, type Category } from "@/lib/wardrobe";

export const Route = createFileRoute("/composer")({
  validateSearch: (s: Record<string, unknown>): { piece?: string } =>
    typeof s["piece"] === "string" ? { piece: s["piece"] } : {},
  head: () => ({
    meta: [
      { title: "Composer une tenue — Vestiaire" },
      {
        name: "description",
        content: "Assemblez vous-même une tenue avec les pièces de votre dressing.",
      },
      { property: "og:title", content: "Composer une tenue — Vestiaire" },
      { property: "og:description", content: "Assemblez vous-même une tenue avec vos pièces." },
    ],
  }),
  component: Composer,
});

function Composer() {
  const { piece } = Route.useSearch();
  const { mode } = useMode();
  const { data: items = [] } = useGarments();
  const { data: outfits = [] } = useOutfits();
  const save = useSaveOutfit();
  const navigate = useNavigate();
  const initial = items.find((g) => g.id === piece);
  const [sel, setSel] = useState<string[]>(piece ? [piece] : []);
  const [name, setName] = useState("");
  const [showLaundry, setShowLaundry] = useState(false);
  useEffect(() => {
    if (!items.length) return;
    setSel((ids) => ids.filter((id) => items.some((g) => g.id === id && g.available)));
  }, [items]);

  const picked = sel
    .map((id) => items.find((g) => g.id === id))
    .filter((g): g is NonNullable<typeof g> => !!g && g.available);
  const laundryCount = items.filter((g) => !g.available).length;
  const already =
    picked.length >= 2 &&
    !!findOutfitByPieces(
      outfits,
      picked.map((g) => g.id),
    );

  function toggle(id: string, cat: Category) {
    const garment = items.find((g) => g.id === id);
    if (!garment?.available) return;
    if (sel.includes(id)) return setSel(sel.filter((x) => x !== id));
    const catOf = (x: string) => items.find((g) => g.id === x)?.category;
    let next = sel;
    if (cat !== "accessoire") next = next.filter((x) => catOf(x) !== cat);
    if (cat === "robe") next = next.filter((x) => catOf(x) !== "haut" && catOf(x) !== "bas");
    if (cat === "haut" || cat === "bas") next = next.filter((x) => catOf(x) !== "robe");
    setSel([...next, id]);
  }

  async function submit() {
    const ids = picked.map((g) => g.id);
    if (findOutfitByPieces(outfits, ids)) {
      toast.message("Cette tenue est déjà dans les favoris");
      navigate({ to: "/favoris" });
      return;
    }
    await save.mutateAsync({
      id: uid(),
      mode,
      name: name.trim() || "Ma tenue",
      itemIds: ids,
      source: "manuel",
      createdAt: Date.now(),
    });
    toast.success("Tenue enregistrée");
    navigate({ to: "/favoris" });
  }

  if (items.length === 0)
    return (
      <Page>
        <PageHeader back eyebrow="Composer" title="Ma tenue" />
        <EmptyState title="Rien à assembler" text="Ajoutez d'abord des pièces à votre dressing.">
          <Button asChild>
            <Link to="/ajouter">Ajouter une pièce</Link>
          </Button>
        </EmptyState>
      </Page>
    );

  return (
    <Page>
      <PageHeader back eyebrow="Composer soi-même" title="Ma tenue" />
      {initial && !initial.available && (
        <p className="mb-4 text-sm text-muted-foreground">
          Cette pièce est au lavage : elle n'entre pas dans la tenue.
        </p>
      )}
      {laundryCount > 0 && (
        <p className="mb-4 text-sm text-muted-foreground">
          {laundryCount === 1
            ? "1 pièce au lavage n'est pas proposée."
            : `${laundryCount} pièces au lavage ne sont pas proposées.`}
          <button
            type="button"
            className="ml-2 inline-flex min-h-11 items-center underline underline-offset-4"
            onClick={() => setShowLaundry((v) => !v)}
          >
            {showLaundry ? "Masquer" : "Les voir"}
          </button>
        </p>
      )}
      <div className="space-y-6 pb-44">
        {CATEGORIES.map((c) => {
          const list = items.filter((g) => g.category === c.value && (g.available || showLaundry));
          if (!list.length) return null;
          return (
            <section key={c.value}>
              <p className="eyebrow mb-2">
                {c.plural}
                {c.value === "accessoire" ? " (plusieurs possibles)" : ""}
              </p>
              <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
                {list.map((g) => {
                  const on = sel.includes(g.id);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => toggle(g.id, g.category)}
                      aria-pressed={on}
                      disabled={!g.available}
                      className="relative w-24 shrink-0 text-left disabled:opacity-60"
                    >
                      <div
                        className={`overflow-hidden rounded-2xl border-2 ${on ? "border-primary" : "border-transparent"}`}
                      >
                        <GarmentImage g={g} className="aspect-[3/4] w-full" />
                      </div>
                      {on && (
                        <span className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-primary text-primary-foreground">
                          <Check className="size-4" />
                        </span>
                      )}
                      <p className="mt-1 line-clamp-2 text-xs">
                        {g.name}
                        {!g.available ? " · au lavage" : ""}
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
      <div
        className="fixed inset-x-0 z-30 mx-auto max-w-lg px-4"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 4.75rem)" }}
      >
        <div className="composer-sheet space-y-2 rounded-3xl border border-border bg-card/95 p-3 shadow-lift backdrop-blur">
          {picked.length ? (
            <div className="flex gap-2 overflow-x-auto">
              {picked.map((g) => (
                <GarmentImage key={g.id} g={g} className="size-14 shrink-0 rounded-xl" />
              ))}
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground">
              Touchez des pièces pour composer votre tenue.
            </p>
          )}
          <input
            className="field"
            placeholder="Nom de la tenue"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Nom de la tenue"
          />
          <Button
            className="min-h-11 w-full"
            disabled={picked.length < 2 || save.isPending || already}
            onClick={() => void submit()}
          >
            {already ? "Déjà dans les favoris" : "Enregistrer la tenue"}
          </Button>
          {picked.length < 2 && (
            <p className="text-xs text-muted-foreground">Choisissez au moins deux pièces.</p>
          )}
        </div>
      </div>
    </Page>
  );
}
