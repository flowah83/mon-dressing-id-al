import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  EmptyState,
  GarmentCard,
  LocalNotice,
  Page,
  PageHeader,
  SettingsLink,
  Swatch,
} from "@/components/vestiaire/ui";
import { useDemoControls, useGarments, useMode } from "@/lib/store";
import { CATEGORIES, COLORS, SEASONS, type Category, type Season } from "@/lib/wardrobe";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mon dressing — Vestiaire" },
      {
        name: "description",
        content: "Toutes vos pièces photographiées, filtrables par catégorie, couleur et saison.",
      },
      { property: "og:title", content: "Mon dressing — Vestiaire" },
      {
        property: "og:description",
        content: "Toutes vos pièces photographiées, filtrables par catégorie, couleur et saison.",
      },
    ],
  }),
  component: Dressing,
});

function Dressing() {
  const { mode, ready } = useMode();
  const { data, isLoading, error } = useGarments();
  const demo = useDemoControls();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<Category | "all">("all");
  const [color, setColor] = useState<string | null>(null);
  const [season, setSeason] = useState<Season | null>(null);
  const [onlyFav, setOnlyFav] = useState(false);
  const [onlyAvail, setOnlyAvail] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const items = data ?? [];
  const usedColors = useMemo(
    () => COLORS.filter((c) => items.some((g) => g.colors.includes(c.value))),
    [items],
  );
  const filtered = items.filter(
    (g) =>
      (cat === "all" || g.category === cat) &&
      (!color || g.colors.includes(color)) &&
      (!season || g.seasons.length === 0 || g.seasons.includes(season)) &&
      (!onlyFav || g.favorite) &&
      (!onlyAvail || g.available) &&
      (!q || g.name.toLowerCase().includes(q.toLowerCase())),
  );
  const hasFilter = cat !== "all" || color || season || onlyFav || onlyAvail || q;

  return (
    <Page>
      <PageHeader
        compact
        eyebrow={mode === "demo" ? "Démonstration" : "Mon vestiaire"}
        title="Dressing"
        action={
          <span className="flex items-center gap-1">
            <Link
              to="/historique"
              className="inline-flex min-h-11 items-center px-1 text-sm font-medium text-primary"
            >
              Historique
            </Link>
            <SettingsLink />
          </span>
        }
      />

      {(!ready || isLoading) && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="aspect-[4/5] animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      )}
      {error && (
        <EmptyState
          title="Stockage inaccessible"
          text={`${(error as Error).message} Vérifiez que la navigation privée est désactivée.`}
        />
      )}

      {ready && !isLoading && !error && items.length === 0 && (
        <EmptyState
          title={mode === "demo" ? "Démo vide" : "Votre dressing est vide"}
          text="Photographiez vos vraies pièces une par une. Vestiaire vous aidera ensuite à composer des tenues avec ce que vous avez déjà."
        >
          <Button asChild size="lg">
            <Link to="/ajouter">Ajouter ma première pièce</Link>
          </Button>
          {mode === "perso" && (
            <Button variant="outline" onClick={() => demo.start()}>
              Explorer une démonstration
            </Button>
          )}
          <LocalNotice />
        </EmptyState>
      )}

      {items.length > 0 && (
        <>
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="field !pl-10 !pr-12"
              placeholder="Rechercher une pièce"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Rechercher"
            />
            {q && (
              <button
                type="button"
                className="absolute right-1 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full text-muted-foreground"
                aria-label="Effacer la recherche"
                onClick={() => setQ("")}
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          <div className="-mx-5 mb-3 flex gap-2 overflow-x-auto px-5 pb-1">
            <button
              type="button"
              className="chip"
              data-active={cat === "all"}
              onClick={() => setCat("all")}
            >
              Tout · {items.length}
            </button>
            {CATEGORIES.filter((c) => items.some((g) => g.category === c.value)).map((c) => {
              const n = items.filter((g) => g.category === c.value).length;
              return (
                <button
                  type="button"
                  key={c.value}
                  className="chip"
                  data-active={cat === c.value}
                  onClick={() => setCat(c.value)}
                >
                  {c.plural} · {n}
                </button>
              );
            })}
          </div>
          <div className="mb-5 flex flex-wrap gap-2">
            <button
              type="button"
              className="chip"
              data-active={filtersOpen || !!(color || season || onlyFav || onlyAvail)}
              onClick={() => setFiltersOpen((v) => !v)}
            >
              Filtrer{color || season || onlyFav || onlyAvail ? " · actifs" : ""}
            </button>
            {hasFilter && (
              <button
                type="button"
                className="chip"
                onClick={() => {
                  setCat("all");
                  setColor(null);
                  setSeason(null);
                  setOnlyFav(false);
                  setOnlyAvail(false);
                  setQ("");
                }}
              >
                <X className="size-3.5" /> Effacer
              </button>
            )}
          </div>
          {filtersOpen && (
            <div className="mb-5 space-y-3 rounded-2xl bg-card p-4 shadow-soft">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="chip"
                  data-active={onlyAvail}
                  onClick={() => setOnlyAvail(!onlyAvail)}
                >
                  Disponibles
                </button>
                <button
                  type="button"
                  className="chip"
                  data-active={onlyFav}
                  onClick={() => setOnlyFav(!onlyFav)}
                >
                  Favoris
                </button>
                {SEASONS.map((s) => (
                  <button
                    type="button"
                    key={s.value}
                    className="chip"
                    data-active={season === s.value}
                    onClick={() => setSeason(season === s.value ? null : s.value)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {usedColors.map((c) => (
                  <button
                    type="button"
                    key={c.value}
                    className="chip !px-3"
                    data-active={color === c.value}
                    onClick={() => setColor(color === c.value ? null : c.value)}
                    aria-label={`Couleur ${c.label}`}
                  >
                    <Swatch color={c.value} /> {c.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {filtered.length === 0 ? (
            <p className="py-12 text-center text-muted-foreground">
              Aucune pièce ne correspond à ces filtres.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
              {filtered.map((g) => (
                <GarmentCard key={g.id} g={g} />
              ))}
            </div>
          )}
          {mode === "perso" && (
            <div className="mt-10">
              <LocalNotice />
            </div>
          )}
        </>
      )}
    </Page>
  );
}
