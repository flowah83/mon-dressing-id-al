import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  CardSkeleton,
  DemoNote,
  EmptyState,
  GarmentCard,
  GarmentImage,
  LocalNotice,
  Page,
  PageHeader,
  SettingsLink,
  Swatch,
} from "@/components/vestiaire/ui";
import { HostedRoute } from "@/components/vestiaire/hosted-route";
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
  component: DressingRoute,
});

function DressingRoute() {
  return (
    <HostedRoute>
      <Dressing />
    </HostedRoute>
  );
}

export function Dressing() {
  const { mode, ready } = useMode();
  const { data, isLoading, error } = useGarments();
  const demo = useDemoControls();
  const qc = useQueryClient();
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const pullRef = useRef(0);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<Category | "all">("all");
  const [color, setColor] = useState<string | null>(null);
  const [season, setSeason] = useState<Season | null>(null);
  const [onlyFav, setOnlyFav] = useState(false);
  const [onlyAvail, setOnlyAvail] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const chipsRef = useRef<HTMLDivElement>(null);
  const [chipsOverflow, setChipsOverflow] = useState(false);
  const onThisTab = useRouterState({ select: (state) => state.location.pathname === "/" });

  useEffect(() => {
    if (!onThisTab) return;
    let startY = 0;
    let active = false;
    const onStart = (event: TouchEvent) => {
      if (window.scrollY > 2) return;
      startY = event.touches[0]?.clientY ?? 0;
      active = true;
    };
    const onMove = (event: TouchEvent) => {
      if (!active) return;
      const dy = (event.touches[0]?.clientY ?? 0) - startY;
      const next = dy > 0 ? Math.min(72, dy * 0.4) : 0;
      pullRef.current = next;
      setPull(next);
    };
    const onEnd = () => {
      if (!active) return;
      active = false;
      if (pullRef.current > 52) {
        setRefreshing(true);
        setPull(36);
        void qc.invalidateQueries({ queryKey: ["garments"] }).finally(() => {
          setRefreshing(false);
          setPull(0);
          pullRef.current = 0;
        });
        return;
      }
      setPull(0);
      pullRef.current = 0;
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, [qc, onThisTab]);

  const items = useMemo(() => data ?? [], [data]);
  useEffect(() => {
    const el = chipsRef.current;
    if (!el) return;
    const check = () => setChipsOverflow(el.scrollWidth > el.clientWidth + 2);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [items.length]);
  const usedColors = useMemo(
    () => COLORS.filter((c) => items.some((g) => g.colors.includes(c.value))),
    [items],
  );
  const filtered = useMemo(
    () =>
      items.filter(
        (g) =>
          (cat === "all" || g.category === cat) &&
          (!color || g.colors.includes(color)) &&
          (!season || g.seasons.length === 0 || g.seasons.includes(season)) &&
          (!onlyFav || g.favorite) &&
          (!onlyAvail || g.available) &&
          (!q || g.name.toLowerCase().includes(q.toLowerCase())),
      ),
    [items, cat, color, season, onlyFav, onlyAvail, q],
  );
  const hasFilter = cat !== "all" || color || season || onlyFav || onlyAvail || q;

  return (
    <Page>
      <PageHeader
        compact
        eyebrow={mode === "demo" ? "Démonstration" : "Mon vestiaire"}
        title="Dressing"
        action={<SettingsLink />}
      />
      <div className="pull-note" style={{ height: pull }} role="status">
        {refreshing
          ? "Actualisation…"
          : pull > 52
            ? "Relâchez"
            : pull > 8
              ? "Tirer pour actualiser"
              : ""}
      </div>
      {mode === "demo" ? <DemoNote /> : null}

      {(!ready || isLoading) && <CardSkeleton />}
      {error && (
        <EmptyState
          title="Dressing indisponible"
          text="Le dressing de cet appareil n'a pas pu s'ouvrir. Si vous êtes en navigation privée, ouvrez un onglet normal."
        />
      )}

      {ready && !isLoading && !error && items.length === 0 && (
        <EmptyState
          title={mode === "demo" ? "L'exemple est vide" : "Votre dressing vous attend"}
          text="Une photo suffit pour commencer. Ensuite, Vestiaire propose des tenues avec ce que vous avez déjà."
        >
          <Button asChild size="lg" className="ios-fill">
            <Link to="/ajouter">Ajouter une première pièce</Link>
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
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              strokeWidth={1.75}
            />
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
                className="absolute right-10 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-muted-foreground"
                aria-label="Effacer la recherche"
                onClick={() => setQ("")}
              >
                <X className="size-4" />
              </button>
            )}
            <button
              type="button"
              className="search-filter press"
              aria-label="Filtrer"
              aria-expanded={filtersOpen}
              onClick={() => setFiltersOpen((v) => !v)}
            >
              <SlidersHorizontal className="size-[18px]" strokeWidth={1.75} />
              {(color || season || onlyFav || onlyAvail) && <span className="filter-dot" />}
            </button>
          </div>
          <div
            ref={chipsRef}
            className={`segmented -mx-5 mb-4 flex gap-2 overflow-x-auto px-5 pb-1${chipsOverflow ? " is-overflow" : ""}`}
          >
            <button
              type="button"
              className="chip"
              data-active={cat === "all"}
              onClick={() => setCat("all")}
            >
              Tout
            </button>
            {CATEGORIES.filter((c) => items.some((g) => g.category === c.value)).map((c) => (
              <button
                type="button"
                key={c.value}
                className="chip"
                data-active={cat === c.value}
                onClick={() => setCat(c.value)}
              >
                {c.plural}
              </button>
            ))}
          </div>
          <div className="filter-row mb-5 flex flex-wrap gap-2">
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
          {mode === "demo" && items.some((g) => g.id === "demo-5") && !hasFilter && (
            <Link
              to="/piece/$id"
              params={{ id: "demo-5" }}
              className="ressortir press mb-4 flex items-center gap-3 bg-card p-2.5 shadow-soft"
            >
              <GarmentImage
                g={items.find((g) => g.id === "demo-5")!}
                className="size-14 shrink-0 rounded-xl"
              />
              <span>
                <span className="eyebrow">À ressortir</span>
                <span className="mt-0.5 block text-[15px] leading-5 tracking-[-0.01em]">
                  Le blazer marine attend depuis un moment.
                </span>
              </span>
            </Link>
          )}
          {filtered.length === 0 ? (
            <p className="py-12 text-center text-muted-foreground">
              Aucune pièce ne correspond à ces filtres.
            </p>
          ) : (
            <div className="dressing-grid grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
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
