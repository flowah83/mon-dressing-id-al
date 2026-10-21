import {
  CATEGORIES,
  PATTERNS,
  SEASONS,
  STYLES,
  type Category,
  type Season,
  type StyleTag,
} from "@/lib/wardrobe";
import { ColorPicker } from "./ui";

export interface GarmentFields {
  name: string;
  category: Category;
  colors: string[];
  pattern: string;
  style: StyleTag;
  seasons: Season[];
  notes: string;
}

export const emptyFields: GarmentFields = {
  name: "",
  category: "haut",
  colors: [],
  pattern: "uni",
  style: "decontracte",
  seasons: [],
  notes: "",
};

export function GarmentForm({
  value,
  onChange,
  collapsibleDetails = false,
}: {
  value: GarmentFields;
  onChange: (v: GarmentFields) => void;
  collapsibleDetails?: boolean;
}) {
  const set = <K extends keyof GarmentFields>(k: K, v: GarmentFields[K]) =>
    onChange({ ...value, [k]: v });
  const details = (
    <>
      <fieldset>
        <legend className="eyebrow">Catégorie</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              type="button"
              key={c.value}
              className="chip"
              data-active={value.category === c.value}
              onClick={() => set("category", c.value)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="eyebrow">Couleurs (la principale d'abord)</legend>
        <div className="mt-2">
          <ColorPicker value={value.colors} onChange={(v) => set("colors", v)} />
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="eyebrow">Motif</span>
          <select
            className="field mt-2"
            value={value.pattern}
            onChange={(e) => set("pattern", e.target.value)}
          >
            {PATTERNS.map((p) => (
              <option key={p} value={p}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="eyebrow">Style</span>
          <select
            className="field mt-2"
            value={value.style}
            onChange={(e) => set("style", e.target.value as StyleTag)}
          >
            {STYLES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <fieldset>
        <legend className="eyebrow">Saisons</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {SEASONS.map((s) => {
            const on = value.seasons.includes(s.value);
            return (
              <button
                type="button"
                key={s.value}
                className="chip"
                data-active={on}
                onClick={() =>
                  set(
                    "seasons",
                    on ? value.seasons.filter((x) => x !== s.value) : [...value.seasons, s.value],
                  )
                }
              >
                {s.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Aucune saison cochée = portable toute l'année.
        </p>
      </fieldset>
      <label className="block">
        <span className="eyebrow">Notes personnelles (taille, matière…)</span>
        <textarea
          className="field mt-2 min-h-20"
          value={value.notes}
          onChange={(e) => set("notes", e.target.value)}
          maxLength={500}
          placeholder="À renseigner vous-même si utile"
        />
      </label>
    </>
  );
  return (
    <div className="space-y-6">
      <label className="block">
        <span className="eyebrow">Nom</span>
        <input
          className="field mt-2"
          value={value.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="Ex. Pull col roulé gris"
          maxLength={80}
        />
      </label>
      {collapsibleDetails ? (
        <details className="rounded-2xl border border-border bg-card p-4">
          <summary className="min-h-11 cursor-pointer text-base font-medium">Affiner</summary>
          <p className="mb-4 text-sm text-muted-foreground">
            Le nom suffit pour enregistrer. Ici : catégorie, couleurs, motif, style, saisons et
            notes.
          </p>
          <div className="space-y-6">{details}</div>
        </details>
      ) : (
        details
      )}
    </div>
  );
}
