export type Mode = "perso" | "demo";
export type Category = "haut" | "bas" | "chaussures" | "veste" | "accessoire" | "robe";
export type Season = "printemps" | "ete" | "automne" | "hiver";
export type StyleTag =
  | "decontracte"
  | "classique"
  | "chic"
  | "sport"
  | "minimaliste"
  | "boheme"
  | "streetwear";
export type Occasion = "quotidien" | "travail" | "sortie" | "chic";
export type Level = "simple" | "travaille" | "audacieux";

export interface Garment {
  id: string;
  mode: Mode;
  name: string;
  category: Category;
  colors: string[];
  pattern: string;
  style: StyleTag;
  seasons: Season[];
  available: boolean;
  favorite: boolean;
  notes: string;
  image?: Blob;
  imageUrl?: string;
  /** Storage path inside the private account bucket, once the piece has been copied online. */
  imagePath?: string;
  createdAt: number;
  updatedAt?: number;
  deletedAt?: number;
}

export interface Outfit {
  id: string;
  mode: Mode;
  name: string;
  itemIds: string[];
  source: "manuel" | "conseiller";
  explanation?: string | undefined;
  feedback?: "like" | "dislike" | undefined;
  createdAt: number;
  updatedAt?: number;
  deletedAt?: number;
}

export const CATEGORIES: { value: Category; label: string; plural: string }[] = [
  { value: "haut", label: "Haut", plural: "Hauts" },
  { value: "bas", label: "Bas", plural: "Bas" },
  { value: "robe", label: "Robe / combinaison", plural: "Robes & combinaisons" },
  { value: "veste", label: "Veste", plural: "Vestes" },
  { value: "chaussures", label: "Chaussures", plural: "Chaussures" },
  { value: "accessoire", label: "Accessoire", plural: "Accessoires" },
];

export const SEASONS: { value: Season; label: string }[] = [
  { value: "printemps", label: "Printemps" },
  { value: "ete", label: "Été" },
  { value: "automne", label: "Automne" },
  { value: "hiver", label: "Hiver" },
];

export const STYLES: { value: StyleTag; label: string }[] = [
  { value: "decontracte", label: "Décontracté" },
  { value: "classique", label: "Classique" },
  { value: "chic", label: "Chic" },
  { value: "minimaliste", label: "Minimaliste" },
  { value: "sport", label: "Sport" },
  { value: "boheme", label: "Bohème" },
  { value: "streetwear", label: "Streetwear" },
];

export const OCCASIONS: { value: Occasion; label: string }[] = [
  { value: "quotidien", label: "Quotidien" },
  { value: "travail", label: "Travail" },
  { value: "sortie", label: "Sortie" },
  { value: "chic", label: "Chic" },
];

export const LEVELS: { value: Level; label: string; hint: string }[] = [
  { value: "simple", label: "Simple", hint: "Neutres, une couleur au plus" },
  { value: "travaille", label: "Travaillé", hint: "Harmonies et couches" },
  { value: "audacieux", label: "Audacieux", hint: "Contrastes et motifs" },
];

export const PATTERNS = ["uni", "rayé", "carreaux", "fleuri", "pois", "imprimé", "texturé"];

/** Swatch colors are data (garment colors), not theme tokens. l = lightness 0..1 */
export const COLORS: { value: string; label: string; hex: string; neutral: boolean; family: string; l: number }[] = [
  { value: "noir", label: "Noir", hex: "#1f1f1f", neutral: true, family: "neutre", l: 0.1 },
  { value: "blanc", label: "Blanc", hex: "#fbfaf6", neutral: true, family: "neutre", l: 0.98 },
  { value: "ecru", label: "Écru", hex: "#efe7d6", neutral: true, family: "neutre", l: 0.9 },
  { value: "gris", label: "Gris", hex: "#9a9a98", neutral: true, family: "neutre", l: 0.6 },
  { value: "beige", label: "Beige", hex: "#d6c3a3", neutral: true, family: "terre", l: 0.78 },
  { value: "camel", label: "Camel", hex: "#b88a55", neutral: true, family: "terre", l: 0.6 },
  { value: "marron", label: "Marron", hex: "#6b4a32", neutral: true, family: "terre", l: 0.35 },
  { value: "marine", label: "Marine", hex: "#22304f", neutral: true, family: "bleu", l: 0.22 },
  { value: "bleu", label: "Bleu", hex: "#5b84c4", neutral: false, family: "bleu", l: 0.58 },
  { value: "denim", label: "Denim", hex: "#3d5a86", neutral: true, family: "bleu", l: 0.4 },
  { value: "kaki", label: "Kaki / olive", hex: "#6b6b3a", neutral: false, family: "vert", l: 0.42 },
  { value: "vert", label: "Vert", hex: "#3f8a5a", neutral: false, family: "vert", l: 0.5 },
  { value: "rouge", label: "Rouge", hex: "#c0392b", neutral: false, family: "rouge", l: 0.45 },
  { value: "bordeaux", label: "Bordeaux", hex: "#6d1f2b", neutral: false, family: "rouge", l: 0.28 },
  { value: "rose", label: "Rose", hex: "#e3a3b3", neutral: false, family: "rouge", l: 0.75 },
  { value: "orange", label: "Orange", hex: "#e07b39", neutral: false, family: "chaud", l: 0.6 },
  { value: "jaune", label: "Jaune", hex: "#e8c547", neutral: false, family: "chaud", l: 0.8 },
  { value: "violet", label: "Violet", hex: "#7a4f9a", neutral: false, family: "violet", l: 0.4 },
  { value: "multicolore", label: "Multicolore", hex: "conic-gradient(#c0392b,#e8c547,#3f8a5a,#5b84c4,#c0392b)", neutral: false, family: "multi", l: 0.55 },
];

export const colorInfo = (v: string) => COLORS.find((c) => c.value === v);
export const catLabel = (c: Category) => CATEGORIES.find((x) => x.value === c)?.label ?? c;
export const styleLabel = (s: StyleTag) => STYLES.find((x) => x.value === s)?.label ?? s;
export const seasonLabel = (s: Season) => SEASONS.find((x) => x.value === s)?.label ?? s;
export const colorLabel = (c: string) => colorInfo(c)?.label ?? c;
