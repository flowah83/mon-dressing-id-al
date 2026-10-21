import {
  colorInfo,
  colorLabel,
  type Category,
  type Garment,
  type Level,
  type Occasion,
  type Season,
  type StyleTag,
} from "./wardrobe";

export interface AdvisorInput {
  items: Garment[];
  occasion: Occasion;
  style: StyleTag | "any";
  temperature: number;
  level: Level;
  anchorId?: string | undefined;
  /** Saved outfits with feedback, used to favour / avoid combinations. */
  feedback?: { itemIds: string[]; feedback?: "like" | "dislike" | undefined }[];
  /** Pluie, neige ou vent du jour. Absent si la météo n'a pas pu être lue. */
  weather?: { precipitation: "none" | "rain" | "snow"; windKmh: number } | undefined;
}

export interface Proposal {
  itemIds: string[];
  score: number;
  reasons: string[];
}

export interface AdvisorResult {
  proposals: Proposal[];
  missing: string[];
  notes: string[];
}

export function seasonsForTemperature(t: number): Season[] {
  if (t < 8) return ["hiver"];
  if (t < 14) return ["automne", "hiver", "printemps"];
  if (t < 20) return ["printemps", "automne"];
  if (t < 25) return ["printemps", "ete"];
  return ["ete"];
}

const OCCASION_STYLES: Record<Occasion, StyleTag[]> = {
  quotidien: ["decontracte", "classique", "minimaliste", "sport", "boheme", "streetwear", "chic"],
  travail: ["classique", "minimaliste", "chic", "decontracte"],
  sortie: ["decontracte", "classique", "chic", "minimaliste", "boheme", "streetwear"],
  chic: ["chic", "classique", "minimaliste"],
};

export const fitsOccasion = (g: Garment, o: Occasion) => OCCASION_STYLES[o].includes(g.style);
export const fitsSeason = (g: Garment, seasons: Season[]) =>
  g.seasons.length === 0 || g.seasons.some((s) => seasons.includes(s));

const isNeutral = (c: string) => colorInfo(c)?.neutral ?? false;
const family = (c: string) => colorInfo(c)?.family ?? c;

function colorAnalysis(pieces: Garment[]) {
  const all = pieces.flatMap((p) => p.colors);
  const accents = [...new Set(all.filter((c) => !isNeutral(c)))];
  const families = [...new Set(accents.map(family))];
  const lights = pieces.map((p) => colorInfo(p.colors[0] ?? "")?.l ?? 0.5);
  const contrast = lights.length ? Math.max(...lights) - Math.min(...lights) : 0;
  const patterned = pieces.filter((p) => p.pattern && p.pattern !== "uni").length;
  return { accents, families, contrast, patterned };
}

const CAT_ORDER: Category[] = ["veste", "haut", "robe", "bas", "chaussures", "accessoire"];

export function generateOutfits(input: AdvisorInput): AdvisorResult {
  const { occasion, style, temperature, level } = input;
  const seasons = seasonsForTemperature(temperature);
  const available = input.items.filter((i) => i.available);
  const anchor = input.anchorId ? input.items.find((i) => i.id === input.anchorId) : undefined;
  const notes: string[] = [];
  const missing: string[] = [];

  if (anchor && !anchor.available) {
    return {
      proposals: [],
      missing: [],
      notes: [`« ${anchor.name} » est marquée au lavage : remettez-la disponible pour l'imposer.`],
    };
  }

  const ok = (g: Garment) =>
    g.id === anchor?.id || (fitsSeason(g, seasons) && fitsOccasion(g, occasion));
  const by = (c: Category) => available.filter((g) => g.category === c && ok(g));
  const tops = by("haut"),
    bottoms = by("bas"),
    dresses = by("robe"),
    shoes = by("chaussures"),
    jackets = by("veste"),
    accs = by("accessoire");

  const rawCount = (c: Category) => available.filter((g) => g.category === c).length;
  const why = (c: Category, label: string) =>
    rawCount(c) === 0
      ? `${label} (aucune pièce disponible)`
      : `${label} adaptée à ${occasion === "quotidien" ? "un usage quotidien" : `l'occasion « ${occasion} »`} et à ${temperature} °C`;

  if (shoes.length === 0) missing.push(why("chaussures", "Chaussures"));
  const hasSeparates = tops.length > 0 && bottoms.length > 0;
  if (!hasSeparates && dresses.length === 0) {
    if (tops.length === 0) missing.push(why("haut", "Un haut"));
    if (bottoms.length === 0) missing.push(why("bas", "Un bas"));
    missing.push("ou bien une robe / combinaison");
  }
  const precipitation = input.weather?.precipitation ?? "none";
  const windKmh = input.weather?.windKmh ?? 0;
  const wet = precipitation !== "none";
  if (precipitation === "rain" || precipitation === "snow") {
    const what = precipitation === "snow" ? "De la neige est prévue" : "De la pluie est prévue";
    if (jackets.length === 0)
      notes.push(`${what} : aucune veste disponible, prévoyez de quoi vous couvrir.`);
    else if (missing.length === 0)
      notes.push(`${what} : une veste est proposée pour vous couvrir.`);
    else notes.push(`${what}.`);
  }
  if (windKmh >= 40)
    notes.push(
      `Le vent atteint environ ${Math.round(windKmh)} km/h : une couche qui coupe le vent sera plus confortable.`,
    );
  if (missing.length) return { proposals: [], missing, notes };

  const needJacket = temperature < 16 || wet || windKmh >= 55;
  if (temperature < 16 && jackets.length === 0)
    notes.push(
      `Il fait ${temperature} °C : aucune veste disponible et adaptée, pensez à une couche chaude.`,
    );

  const bases: Garment[][] = [];
  for (const t of tops) for (const b of bottoms) bases.push([t, b]);
  for (const d of dresses) bases.push([d]);

  const jacketOpts: (Garment | null)[] =
    needJacket && jackets.length ? jackets : [null, ...jackets.slice(0, 4)];
  const accOpts: (Garment | null)[] = [null, ...accs.slice(0, 4)];

  const liked = (input.feedback ?? [])
    .filter((f) => f.feedback === "like")
    .map((f) => new Set(f.itemIds));
  const disliked = (input.feedback ?? [])
    .filter((f) => f.feedback === "dislike")
    .map((f) => f.itemIds.slice().sort().join("|"));

  const candidates: Proposal[] = [];
  for (const base of bases) {
    for (const s of shoes) {
      for (const j of jacketOpts) {
        if (!needJacket && j && temperature > 22) continue;
        for (const a of accOpts) {
          if (level === "simple" && a) continue;
          const pieces = [...base, s, ...(j ? [j] : []), ...(a ? [a] : [])];
          if (anchor && !pieces.some((p) => p.id === anchor.id)) continue;
          const p = scoreOutfit(pieces, { style, level, temperature, precipitation, windKmh });
          const key = pieces
            .map((x) => x.id)
            .sort()
            .join("|");
          if (disliked.includes(key)) continue;
          // like: boost combos sharing >=2 pieces with a liked outfit
          if (liked.some((set) => pieces.filter((x) => set.has(x.id)).length >= 2)) {
            p.score += 1.5;
            p.reasons.push("Proche d'une tenue que vous avez aimée.");
          }
          if (
            disliked.length &&
            (input.feedback ?? []).some(
              (f) =>
                f.feedback === "dislike" &&
                pieces.filter((x) => f.itemIds.includes(x.id)).length >= 3,
            )
          ) {
            p.score -= 2;
          }
          candidates.push(p);
          if (candidates.length > 4000) break;
        }
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  const chosen: Proposal[] = [];
  const core = (p: Proposal) =>
    p.itemIds.filter((id) => {
      const g = input.items.find((x) => x.id === id);
      return (
        g &&
        (g.category === "haut" ||
          g.category === "bas" ||
          g.category === "robe" ||
          g.category === "chaussures")
      );
    });
  for (const c of candidates) {
    if (chosen.length >= 3) break;
    const cc = core(c);
    // distinct: share at most one core piece with every chosen outfit (anchor excluded)
    const distinct = chosen.every(
      (o) => cc.filter((id) => id !== anchor?.id && core(o).includes(id)).length <= 1,
    );
    if (distinct) chosen.push(c);
  }
  if (chosen.length < 3 && candidates.length) {
    notes.push(
      chosen.length === 1
        ? "Une seule tenue vraiment différente possible : ajoutez d'autres hauts, bas ou chaussures pour plus de variété."
        : `${chosen.length} tenues vraiment différentes possibles avec les pièces disponibles.`,
    );
  }
  return { proposals: chosen, missing, notes };
}

export function scoreOutfit(
  pieces: Garment[],
  opts: {
    style: StyleTag | "any";
    level: Level;
    temperature: number;
    precipitation?: "none" | "rain" | "snow";
    windKmh?: number;
  },
): Proposal {
  const reasons: string[] = [];
  let score = 0;
  const { accents, families, contrast, patterned } = colorAnalysis(pieces);

  if (opts.style !== "any") {
    const n = pieces.filter((p) => p.style === opts.style).length;
    score += n * 1.2;
    if (n) reasons.push(`${n} pièce${n > 1 ? "s" : ""} dans le style demandé.`);
  }

  if (accents.length === 0) {
    score += opts.level === "simple" ? 3 : opts.level === "travaille" ? 1 : -1;
    reasons.push("Palette entièrement neutre : facile à porter et toujours cohérente.");
  } else if (accents.length === 1) {
    score += opts.level === "audacieux" ? 1.5 : 3;
    reasons.push(`Base neutre réveillée par une seule couleur : ${colorLabel(accents[0]!)}.`);
  } else if (families.length === 1) {
    score += opts.level === "simple" ? 0 : 3;
    reasons.push(
      `Camaïeu harmonieux autour de la même famille (${accents.map(colorLabel).join(", ")}).`,
    );
  } else {
    score += opts.level === "audacieux" ? 3 : opts.level === "travaille" ? -0.5 : -3;
    reasons.push(`Association de couleurs affirmée (${accents.map(colorLabel).join(" + ")}).`);
  }

  if (contrast > 0.5) {
    score += opts.level === "simple" ? 0.5 : 1;
    reasons.push("Contraste clair / foncé net qui structure la silhouette.");
  } else if (contrast < 0.2) {
    reasons.push("Tons proches pour un effet ton sur ton.");
    score += opts.level === "travaille" ? 1 : 0;
  }

  if (patterned > 1) {
    score += opts.level === "audacieux" ? 1 : -2;
    reasons.push(
      opts.level === "audacieux"
        ? "Mélange de motifs assumé."
        : "Plusieurs motifs : à réserver aux tenues audacieuses.",
    );
  } else if (patterned === 1) {
    score += 0.5;
    reasons.push("Un seul motif, mis en valeur par des pièces unies.");
  }

  const cats = pieces.map((p) => p.category);
  if (cats.includes("robe"))
    reasons.push(
      "Pièce unique : la robe / combinaison fait la silhouette, les chaussures donnent le ton.",
    );
  else
    reasons.push(
      "Haut et bas complémentaires : équilibre des volumes entre le buste et les jambes.",
    );
  if (cats.includes("veste")) {
    const precipitation = opts.precipitation ?? "none";
    const windKmh = opts.windKmh ?? 0;
    if (opts.temperature < 16) {
      score += 2;
      reasons.push(`Une veste pour ${opts.temperature} °C, qui ajoute aussi de la structure.`);
    } else if (precipitation === "snow") {
      score += 2;
      reasons.push("Une veste pour la neige prévue.");
    } else if (precipitation === "rain") {
      score += 1.6;
      reasons.push("Une veste pour la pluie prévue.");
    } else if (windKmh >= 40) {
      score += 1.2;
      reasons.push(`Une veste pour un vent d'environ ${Math.round(windKmh)} km/h.`);
    } else {
      score += 0.3;
      reasons.push("Veste en option pour structurer la tenue.");
    }
  }
  if (cats.includes("accessoire")) {
    score += opts.level === "simple" ? -0.5 : 0.7;
    reasons.push("Un accessoire pour finir la tenue.");
  }

  const ordered = pieces
    .slice()
    .sort((a, b) => CAT_ORDER.indexOf(a.category) - CAT_ORDER.indexOf(b.category));
  return { itemIds: ordered.map((p) => p.id), score, reasons };
}
