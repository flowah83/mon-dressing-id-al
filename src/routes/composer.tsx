import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Collage, EmptyState, GarmentImage, Page, PageHeader } from "@/components/vestiaire/ui";
import { uid } from "@/lib/db";
import { useGarments, useMode, useSaveOutfit } from "@/lib/store";
import { CATEGORIES, type Category } from "@/lib/wardrobe";

export const Route = createFileRoute("/composer")({
  validateSearch: (s: Record<string, unknown>): { piece?: string } => (typeof s["piece"] === "string" ? { piece: s["piece"] } : {}),
  head: () => ({
    meta: [
      { title: "Composer une tenue — Vestiaire" },
      { name: "description", content: "Assemblez vous-même une tenue avec les pièces de votre dressing." },
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
  const save = useSaveOutfit();
  const navigate = useNavigate();
  const [sel, setSel] = useState<string[]>(piece ? [piece] : []);
  const [name, setName] = useState("");

  const picked = sel.map((id) => items.find((g) => g.id === id)).filter((g): g is NonNullable<typeof g> => !!g);

  function toggle(id: string, cat: Category) {
    if (sel.includes(id)) return setSel(sel.filter((x) => x !== id));
    const catOf = (x: string) => items.find((g) => g.id === x)?.category;
    let next = sel;
    // One piece per category, except accessories. A dress replaces top + bottom.
    if (cat !== "accessoire") next = next.filter((x) => catOf(x) !== cat);
    if (cat === "robe") next = next.filter((x) => catOf(x) !== "haut" && catOf(x) !== "bas");
    if (cat === "haut" || cat === "bas") next = next.filter((x) => catOf(x) !== "robe");
    setSel([...next, id]);
  }

  async function submit() {
    await save.mutateAsync({ id: uid(), mode, name: name.trim() || "Ma tenue", itemIds: sel, source: "manuel", createdAt: Date.now() });
    toast.success("Tenue enregistrée");
    navigate({ to: "/favoris" });
  }

  if (items.length === 0)
    return (
      <Page>
        <PageHeader eyebrow="Composer" title="Ma tenue" />
        <EmptyState title="Rien à assembler" text="Ajoutez d'abord des pièces à votre dressing."><Button asChild><Link to="/ajouter">Ajouter une pièce</Link></Button></EmptyState>
      </Page>
    );

  return (
    <Page>
      <PageHeader eyebrow="Composer soi-même" title="Ma tenue" />
      <div className="grid gap-6 md:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {CATEGORIES.map((c) => {
            const list = items.filter((g) => g.category === c.value);
            if (!list.length) return null;
            return (
              <section key={c.value}>
                <p className="eyebrow mb-2">{c.plural}{c.value === "accessoire" ? " (plusieurs possibles)" : ""}</p>
                <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
                  {list.map((g) => {
                    const on = sel.includes(g.id);
                    return (
                      <button key={g.id} onClick={() => toggle(g.id, g.category)} aria-pressed={on} className="relative w-24 shrink-0 text-left">
                        <div className={`overflow-hidden rounded-2xl border-2 ${on ? "border-primary" : "border-transparent"}`}>
                          <GarmentImage g={g} className="aspect-[3/4] w-full" />
                        </div>
                        {on && <span className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="size-4" /></span>}
                        <p className="mt-1 line-clamp-2 text-xs">{g.name}{!g.available ? " · au lavage" : ""}</p>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
        <aside className="h-fit space-y-3 rounded-3xl bg-card p-3 shadow-soft md:sticky md:top-4">
          {picked.length ? <Collage items={picked} /> : <p className="p-6 text-center text-sm text-muted-foreground">Touchez des pièces pour composer votre tenue.</p>}
          <input className="field" placeholder="Nom de la tenue" value={name} onChange={(e) => setName(e.target.value)} aria-label="Nom de la tenue" />
          <Button className="w-full" disabled={picked.length < 2 || save.isPending} onClick={submit}>Enregistrer la tenue</Button>
          {picked.length < 2 && <p className="text-xs text-muted-foreground">Choisissez au moins deux pièces.</p>}
        </aside>
      </div>
    </Page>
  );
}
