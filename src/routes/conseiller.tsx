import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Heart, Loader2, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { WeatherCard } from "@/components/vestiaire/WeatherCard";
import { StreakPill, SwipeCard, useWornLog, WearNote } from "@/components/vestiaire/ritual";
import { Collage, EmptyState, Page, PageHeader } from "@/components/vestiaire/ui";
import { useAuth } from "@/lib/account";
import { adviseOutfits } from "@/lib/ai.functions";
import { ensureAccessCookie } from "@/lib/cloud";
import { uid } from "@/lib/db";
import { findOutfitByPieces, outfitKey } from "@/lib/outfit-match";
import { generateOutfits, type AdvisorResult } from "@/lib/rules";
import { sliderChangeIsDeliberate } from "@/lib/slider-intent";
import { useGarments, useMode, useOutfits, useSaveOutfit } from "@/lib/store";
import {
  adviceTemperature,
  formatWeatherLines,
  TEMP_MAX,
  TEMP_MIN,
  toAdviceWeather,
  toWeatherHints,
} from "@/lib/weather";
import { useAdvisorWeather } from "@/hooks/use-advisor-weather";
import {
  LEVELS,
  OCCASIONS,
  STYLES,
  type Level,
  type Occasion,
  type StyleTag,
} from "@/lib/wardrobe";

export const Route = createFileRoute("/conseiller")({
  validateSearch: (s: Record<string, unknown>): { piece?: string } =>
    typeof s["piece"] === "string" ? { piece: s["piece"] } : {},
  head: () => ({
    meta: [
      { title: "Conseiller de tenues — Vestiaire" },
      {
        name: "description",
        content: "Des tenues composées uniquement avec vos vêtements disponibles.",
      },
      { property: "og:title", content: "Conseiller de tenues — Vestiaire" },
      {
        property: "og:description",
        content: "Des tenues composées uniquement avec vos vêtements.",
      },
    ],
  }),
  component: Conseiller,
});

function Conseiller() {
  const { piece } = Route.useSearch();
  const { mode } = useMode();
  const auth = useAuth();
  const garments = useGarments();
  const items = garments.data ?? [];
  const { data: outfits = [] } = useOutfits();
  const saveOutfit = useSaveOutfit();
  const advise = useServerFn(adviseOutfits);
  const weather = useAdvisorWeather({ enabled: garments.isSuccess && items.length > 0 });
  const [occasion, setOccasion] = useState<Occasion>("quotidien");
  const [style, setStyle] = useState<StyleTag | "any">("any");
  const [temp, setTemp] = useState(18);
  const [manual, setManual] = useState(false);
  const [level, setLevel] = useState<Level>("simple");
  const [anchor, setAnchor] = useState<string>(piece ?? "");
  const [res, setRes] = useState<AdvisorResult | null>(null);
  const [savedKeys, setSavedKeys] = useState<string[]>([]);
  const [ai, setAi] = useState<{
    loading: boolean;
    error?: string;
    advice?: { index: number; title: string; text: string }[];
  }>({ loading: false });
  const worn = useWornLog();
  const [shift, setShift] = useState(0);
  const [celebrate, setCelebrate] = useState(false);
  const pointer = useRef({ active: false, x: 0, y: 0, moved: 0 });
  const autoRef = useRef("");
  const proposeRef = useRef<() => Promise<void>>(async () => {});

  const snapshot = weather.state.snapshot;
  const followed = !manual && !!snapshot;
  const temperature = followed && snapshot ? adviceTemperature(snapshot) : temp;
  useEffect(() => {
    if (manual || !snapshot) return;
    setTemp(adviceTemperature(snapshot));
  }, [manual, snapshot]);

  const piecesOf = (ids: string[]) =>
    ids.map((id) => items.find((g) => g.id === id)).filter((g): g is NonNullable<typeof g> => !!g);

  async function propose(withAi: boolean) {
    const hints = snapshot ? toWeatherHints(snapshot) : undefined;
    const r = generateOutfits({
      items,
      occasion,
      style,
      temperature,
      level,
      anchorId: anchor || undefined,
      feedback: outfits,
      ...(hints ? { weather: hints } : {}),
    });
    setRes(r);
    setAi({ loading: false });
    if (!withAi || !r.proposals.length) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setAi({
        loading: false,
        error:
          "Hors ligne : le texte du styliste reprendra avec le réseau. La tenue suit les règles de style.",
      });
      return;
    }
    setAi({ loading: true });
    try {
      await ensureAccessCookie();
      const a = await advise({
        data: {
          occasion,
          style,
          temperature,
          level,
          ...(snapshot ? { weather: toAdviceWeather(snapshot) } : {}),
          outfits: r.proposals.map((p) => ({
            pieces: piecesOf(p.itemIds).map((g) => ({
              category: g.category,
              name: g.name,
              colors: g.colors,
              pattern: g.pattern,
              style: g.style,
            })),
          })),
        },
      });
      setAi(
        a.ok ? { loading: false, advice: a.data.advice } : { loading: false, error: a.message },
      );
    } catch {
      setAi({ loading: false, error: "Conseil IA indisponible pour le moment." });
    }
  }
  proposeRef.current = () => propose(false);

  useEffect(() => {
    if (!garments.isSuccess || items.length === 0) return;
    if (weather.state.phase !== "ready" && weather.state.phase !== "error") return;
    const key = `${weather.state.phase}:${snapshot?.fetchedAt ?? "none"}:${items.length}`;
    if (autoRef.current === key) return;
    autoRef.current = key;
    void proposeRef.current();
  }, [garments.isSuccess, items.length, weather.state.phase, snapshot]);

  async function keep(itemIds: string[], name: string, explanation?: string) {
    const key = outfitKey(itemIds);
    if (savedKeys.includes(key) || findOutfitByPieces(outfits, itemIds)) return;
    setSavedKeys((prev) => [...prev, key]);
    await saveOutfit.mutateAsync({
      id: uid(),
      mode,
      name,
      itemIds,
      source: "conseiller",
      explanation,
      createdAt: Date.now(),
    });
    toast.success("Tenue ajoutée aux favoris");
  }

  const known = (ids: string[]) =>
    savedKeys.includes(outfitKey(ids)) || !!findOutfitByPieces(outfits, ids);

  const proposals = res?.proposals ?? [];
  const turn = proposals.length ? shift % proposals.length : 0;
  const ordered =
    proposals.length > 0 ? [...proposals.slice(turn), ...proposals.slice(0, turn)] : [];
  const hero = ordered[0];
  const heroPieces = hero ? piecesOf(hero.itemIds) : [];
  const heroTitle = hero ? "Tenue du jour" : "";

  function wearHero() {
    if (!hero || worn.wornToday) return;
    worn.log({ date: worn.today, itemIds: hero.itemIds, name: heroTitle });
    setCelebrate(true);
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(12);
    }
    window.setTimeout(() => setCelebrate(false), 1600);
  }

  return (
    <Page>
      <PageHeader
        eyebrow={mode === "demo" ? "Exemple" : "Aujourd'hui"}
        title="Tenue du jour"
        action={<StreakPill count={worn.count} />}
      />
      {auth.ready && !auth.user && (
        <p className="mb-4 text-sm text-muted-foreground">
          {auth.configured
            ? "Les tenues sont composées avec vos pièces. Le texte du styliste demande une connexion."
            : "Le texte du styliste sera disponible avec le compte en ligne. Les règles de style fonctionnent déjà."}
        </p>
      )}
      {garments.isPending ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Chargement du dressing…
        </p>
      ) : garments.isError ? (
        <EmptyState
          title="Stockage inaccessible"
          text="Impossible de lire le dressing sur cet appareil."
        />
      ) : items.length === 0 ? (
        <EmptyState title="Rien à associer" text="Ajoute d'abord quelques pièces. La tenue du jour viendra ensuite.">
          <Button asChild>
            <Link to="/ajouter">Ajouter une pièce</Link>
          </Button>
        </EmptyState>
      ) : (
        <div className="space-y-5">
          {hero ? (
            <SwipeCard
              key={hero.itemIds.join("-")}
              onLike={() => void keep(hero.itemIds, heroTitle, hero.reasons[0])}
              onNext={() => setShift((s) => s + 1)}
            >
              <article className="relative overflow-hidden rounded-[var(--radius-card)] bg-card p-3 shadow-soft">
                <WearNote show={celebrate} />
                <Collage items={heroPieces} />
                <div className="p-2">
                  <p className="mt-2 text-sm leading-relaxed">
                    {heroPieces.map((g) => g.name).join(" · ")}
                  </p>
                  {hero.reasons[0] && (
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {hero.reasons[0]}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    Glisse à droite si tu l'aimes, à gauche pour une autre idée.
                  </p>
                  <Button
                    size="lg"
                    className="mt-4 min-h-12 w-full text-base"
                    disabled={worn.wornToday}
                    onClick={wearHero}
                  >
                    {worn.wornToday ? "C'est noté pour aujourd'hui" : "Je la porte"}
                  </Button>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      className="chip justify-center"
                      onClick={() => setShift((s) => s + 1)}
                    >
                      Une autre idée
                    </button>
                    <button
                      type="button"
                      className="chip justify-center"
                      onClick={() => void keep(hero.itemIds, heroTitle, hero.reasons[0])}
                    >
                      <Heart className="size-4" /> {known(hero.itemIds) ? "Gardée" : "Garder"}
                    </button>
                  </div>
                </div>
              </article>
            </SwipeCard>
          ) : (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> On prépare ta tenue…
            </p>
          )}

          {snapshot ? (
            <p className="text-sm leading-relaxed text-muted-foreground">
              {formatWeatherLines(snapshot).title}. {formatWeatherLines(snapshot).detail}.
            </p>
          ) : (
            <WeatherCard
              state={weather.state}
              manual={manual}
              onRetry={weather.retry}
              onUseForecast={() => {
                if (!snapshot) return;
                setManual(false);
                setTemp(adviceTemperature(snapshot));
              }}
            />
          )}

          <details className="rounded-[var(--radius-card)] bg-card p-4 shadow-soft">
            <summary className="min-h-11 cursor-pointer text-base font-medium">
              Ajuster la proposition
            </summary>
            <div className="mt-4 space-y-5">
              <Group label="Occasion">
                {OCCASIONS.map((o) => (
                  <button
                    type="button"
                    key={o.value}
                    className="chip"
                    data-active={occasion === o.value}
                    onClick={() => setOccasion(o.value)}
                  >
                    {o.label}
                  </button>
                ))}
              </Group>
              <div>
                <Group label="Ambiance">
                  {LEVELS.map((l) => (
                    <button
                      type="button"
                      key={l.value}
                      className="chip"
                      data-active={level === l.value}
                      onClick={() => setLevel(l.value)}
                    >
                      {l.label}
                    </button>
                  ))}
                </Group>
                <p className="mt-2 text-sm text-muted-foreground">
                  Simple : neutres, une couleur au plus. Travaillé : harmonies et couches. Audacieux
                  : contrastes et motifs.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="block">
                  <span className="eyebrow">Style</span>
                  <select
                    className="field mt-2"
                    value={style}
                    onChange={(e) => setStyle(e.target.value as StyleTag | "any")}
                  >
                    <option value="any">Peu importe</option>
                    {STYLES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div>
                  <label className="block">
                    <span className="eyebrow">
                      {followed ? `Ressenti : ${temperature} °C` : `Curseur : ${temperature} °C`}
                    </span>
                    <input
                      type="range"
                      min={TEMP_MIN}
                      max={TEMP_MAX}
                      value={temperature}
                      aria-label="Température pour le conseil"
                      onPointerDown={(e) => {
                        pointer.current = { active: true, x: e.clientX, y: e.clientY, moved: 0 };
                      }}
                      onPointerMove={(e) => {
                        if (!pointer.current.active) return;
                        const d = Math.hypot(
                          e.clientX - pointer.current.x,
                          e.clientY - pointer.current.y,
                        );
                        if (d > pointer.current.moved) pointer.current.moved = d;
                      }}
                      onPointerUp={() => {
                        pointer.current.active = false;
                        pointer.current.moved = 0;
                      }}
                      onPointerCancel={() => {
                        pointer.current.active = false;
                        pointer.current.moved = 0;
                      }}
                      onKeyDown={() => {
                        pointer.current.active = false;
                      }}
                      onChange={(e) => {
                        const next = Number(e.target.value);
                        if (
                          !sliderChangeIsDeliberate({
                            pointerActive: pointer.current.active,
                            pointerMovedPx: pointer.current.moved,
                          })
                        )
                          return;
                        setManual(true);
                        setTemp(next);
                      }}
                      className="mt-4 h-11 w-full accent-primary"
                    />
                  </label>
                  {manual && snapshot && (
                    <Button
                      type="button"
                      className="mt-3 min-h-11 w-full"
                      onClick={() => {
                        setManual(false);
                        setTemp(adviceTemperature(snapshot));
                      }}
                    >
                      Revenir au ressenti ({adviceTemperature(snapshot)} °C)
                    </Button>
                  )}
                </div>
                <label className="block">
                  <span className="eyebrow">Je veux porter</span>
                  <select
                    className="field mt-2"
                    value={anchor}
                    onChange={(e) => setAnchor(e.target.value)}
                  >
                    <option value="">Aucune pièce en particulier</option>
                    {items
                      .filter((g) => g.available)
                      .map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                  </select>
                </label>
              </div>
            </div>
          </details>

          {!res && weather.state.phase === "loading" && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Préparation de la tenue du jour…
            </p>
          )}

          {res && res.missing.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="font-medium">Il manque pour composer une tenue :</p>
              <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">
                {res.missing.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          )}
          {res?.notes.map((n) => (
            <p key={n} className="text-sm text-muted-foreground">
              {n}
            </p>
          ))}
          {ai.loading && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Conseil du styliste en cours…
            </p>
          )}
          {ai.error && (
            <p className="text-sm text-muted-foreground">
              {ai.error} Les explications ci-dessous viennent des règles de style.
            </p>
          )}
          {ordered.length > 1 && (
            <div className="space-y-3">
              <h2 className="text-[1.75rem] leading-none">Autres idées</h2>
              {ordered.slice(1, 3).map((p, i) => {
                const pieces = piecesOf(p.itemIds);
                return (
                  <button
                    key={p.itemIds.join()}
                    type="button"
                    className="press flex w-full items-center gap-3 rounded-[var(--radius-card)] bg-card p-2 text-left shadow-soft"
                    onClick={() => setShift((s) => s + i + 1)}
                  >
                    <Collage items={pieces} className="!aspect-auto h-16 w-16 shrink-0" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">
                        {pieces.map((g) => g.name).join(" · ")}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          <button
            type="button"
            className="press min-h-11 text-sm font-medium text-primary underline underline-offset-4"
            onClick={() => void propose(true)}
          >
            <Sparkles className="mr-1 inline size-4" /> Un mot du styliste
          </button>
        </div>
      )}
    </Page>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="eyebrow mb-2">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
