import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ChevronRight, Heart, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SwipeCard, WearNote } from "@/components/vestiaire/ritual";
import { WeatherCard, WeatherGlyph } from "@/components/vestiaire/WeatherCard";
import { Collage, EmptyState, OutfitHeading, Page, PageHeader } from "@/components/vestiaire/ui";
import { WearTodayButton } from "@/components/vestiaire/WearTodayButton";
import { adviseOutfits } from "@/lib/ai.functions";
import { ensureAccessCookie } from "@/lib/cloud";
import { uid } from "@/lib/db";
import { findOutfitByPieces, outfitKey } from "@/lib/outfit-match";
import { generateOutfits, type AdvisorResult } from "@/lib/rules";
import { sliderChangeIsDeliberate } from "@/lib/slider-intent";
import { useGarments, useMode, useOutfits, useSaveOutfit, useWorn } from "@/lib/store";
import { localDateISO, neverWornHint } from "@/lib/wear";
import {
  adviceTemperature,
  formatWeatherLines,
  TEMP_MAX,
  TEMP_MIN,
  toAdviceWeather,
  toWeatherHints,
  weatherLabel,
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
  const garments = useGarments();
  const items = garments.data ?? [];
  const { data: outfits = [] } = useOutfits();
  const { data: worn = [] } = useWorn();
  const wearStamp = worn
    .map((entry) => `${entry.id}:${entry.wornOn}:${entry.updatedAt ?? 0}`)
    .join("|");
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
  const [shift, setShift] = useState(0);
  const [celebrate, setCelebrate] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [held, setHeld] = useState<{ itemIds: string[]; reasons: string[]; title: string } | null>(
    null,
  );
  const pointer = useRef({ active: false, x: 0, y: 0, moved: 0 });
  const autoRef = useRef("");
  const proposeRef = useRef<() => Promise<void>>(async () => {});

  const snapshot = weather.state.snapshot;
  const followed = !manual && !!snapshot;
  const temperature = followed && snapshot ? adviceTemperature(snapshot) : temp;
  const daily =
    occasion === "quotidien" && level === "simple" && style === "any" && !anchor && followed;

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
      today: localDateISO(),
      recentWears: worn.map((entry) => ({ itemIds: entry.itemIds, wornOn: entry.wornOn })),
      ...(hints ? { weather: hints } : {}),
    });
    setRes(r);
    setAi({ loading: false });
    if (!withAi || !r.proposals.length) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setAi({
        loading: false,
        error: "Hors ligne. La tenue reste proposée. La note du styliste attend le réseau.",
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
    const key = `${weather.state.phase}:${snapshot?.fetchedAt ?? "none"}:${items.length}:${wearStamp}`;
    if (autoRef.current === key) return;
    autoRef.current = key;
    void proposeRef.current();
  }, [garments.isSuccess, items.length, weather.state.phase, snapshot, wearStamp]);

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
  const unwornHint = neverWornHint(
    items
      .filter((garment) => !worn.some((entry) => entry.itemIds.includes(garment.id)))
      .map((garment) => garment.name),
  );
  const indexed = (res?.proposals ?? []).map((proposal, index) => ({ proposal, index }));
  const turn = indexed.length ? shift % indexed.length : 0;
  const ordered = indexed.length ? [...indexed.slice(turn), ...indexed.slice(0, turn)] : [];
  const hero = ordered[0];
  const shownIds = held?.itemIds ?? hero?.proposal.itemIds ?? [];
  const heroPieces = piecesOf(shownIds);
  const heroAdvice = hero
    ? (ai.advice?.find((item) => item.index === hero.index) ?? ai.advice?.[hero.index])
    : undefined;
  const heroTitle = held
    ? held.title
    : hero && hero.index === 0 && daily
      ? "Tenue du jour"
      : (heroAdvice?.title ?? (hero ? `Tenue ${hero.index + 1}` : "Tenue du jour"));
  const heroReasons = held?.reasons ?? hero?.proposal.reasons ?? [];

  return (
    <Page>
      <PageHeader eyebrow={mode === "demo" ? "Exemple" : "Aujourd'hui"} title="Tenue du jour" />
      {garments.isPending ? (
        <div className="overflow-hidden rounded-[20px] bg-card shadow-soft" aria-hidden>
          <div className="skeleton h-[312px]" />
          <div className="space-y-2 p-4">
            <div className="skeleton h-6 w-2/3 rounded-full" />
            <div className="skeleton h-4 w-1/2 rounded-full" />
            <div className="skeleton mt-3 h-[50px] rounded-[14px]" />
          </div>
        </div>
      ) : garments.isError ? (
        <EmptyState
          title="Stockage inaccessible"
          text="Impossible de lire le dressing sur cet appareil."
        />
      ) : items.length === 0 ? (
        <EmptyState title="Rien à associer" text="Ajoutez d'abord des pièces à votre dressing.">
          <Button asChild>
            <Link to="/ajouter">Ajouter une pièce</Link>
          </Button>
        </EmptyState>
      ) : (
        <div className="space-y-5">
          {shownIds.length > 0 ? (
            <SwipeCard
              key={shownIds.join("-")}
              onLike={() => void keep(shownIds, heroTitle, heroAdvice?.text)}
              onNext={() => {
                setHeld(null);
                setShift((value) => value + 1);
              }}
            >
              <article className="hero-card relative overflow-hidden bg-card shadow-soft">
                <WearNote show={celebrate} />
                <Collage items={heroPieces} />
                <div className="hero-body">
                  {snapshot && (
                    <p className="weather-inline">
                      <WeatherGlyph code={snapshot.weatherCode} />
                      <span>{formatWeatherLines(snapshot).title}</span>
                      <span className="weather-sep" aria-hidden>
                        ·
                      </span>
                      <span>{weatherLabel(snapshot.weatherCode)}</span>
                    </p>
                  )}
                  <OutfitHeading pieces={heroPieces} />
                  {heroAdvice?.text ? (
                    <p className="hero-reason">
                      <span className="font-semibold text-foreground">Conseil IA. </span>
                      {heroAdvice.text}
                    </p>
                  ) : (
                    heroReasons[0] && <p className="hero-reason">{heroReasons[0]}</p>
                  )}
                  <div className="mt-4">
                    <WearTodayButton
                      itemIds={shownIds}
                      name={heroTitle}
                      className="ios-fill w-full"
                      onNoted={() => {
                        setHeld({ itemIds: shownIds, reasons: heroReasons, title: heroTitle });
                        setCelebrate(true);
                        window.setTimeout(() => setCelebrate(false), 1600);
                      }}
                    />
                  </div>
                  <div className="hero-actions">
                    <button
                      type="button"
                      className="chip press"
                      onClick={() => {
                        setHeld(null);
                        setShift((value) => value + 1);
                      }}
                    >
                      Une autre idée
                    </button>
                    <button
                      type="button"
                      className="chip press"
                      onClick={() =>
                        void keep(shownIds, heroTitle, heroAdvice?.text ?? heroReasons[0])
                      }
                    >
                      <Heart className="size-4" /> {known(shownIds) ? "Gardée" : "Garder"}
                    </button>
                  </div>
                </div>
              </article>
            </SwipeCard>
          ) : res && res.proposals.length === 0 ? (
            <p className="text-[15px] text-muted-foreground">
              Aucune tenue avec ces réglages. Ajustez la proposition, ou ajoutez des pièces.
            </p>
          ) : (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Préparation de votre tenue…
            </p>
          )}

          <section className="adjust-card">
            <button
              type="button"
              className="adjust-row press"
              aria-expanded={adjustOpen}
              onClick={() => setAdjustOpen((open) => !open)}
            >
              <span>Ajuster la proposition</span>
              <ChevronRight className="adjust-chevron" strokeWidth={1.75} />
            </button>
            {adjustOpen ? (
              <div className="adjust-body space-y-5">
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
                    Simple : neutres, une couleur au plus. Travaillé : harmonies et couches.
                    Audacieux : contrastes et motifs.
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
                <div className="mt-5 space-y-3">
                  {res && res.missing.length > 0 && (
                    <div>
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
                  {unwornHint && <p className="text-sm text-muted-foreground">{unwornHint}</p>}
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {followed
                      ? `La tenue suit le ressenti (${temperature} °C), pour un usage quotidien. La pluie et le vent, s'ils sont connus, ajoutent une couche.`
                      : weather.state.reason === "denied"
                        ? "Sans localisation, seule la température du curseur compte. La pluie et le vent restent inconnus."
                        : manual
                          ? "Vous avez quitté le ressenti : la tenue suit la température du curseur."
                          : "Dès que la météo est connue, une tenue du jour est proposée."}
                  </p>
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
                  <Button className="ios-fill w-full" onClick={() => void propose(true)}>
                    Demander une note
                  </Button>
                </div>
              </div>
            ) : null}
          </section>

          {ai.loading && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> La note s'écrit…
            </p>
          )}
          {ai.error && (
            <p className="text-sm text-muted-foreground">{ai.error} La tenue reste proposée.</p>
          )}
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
