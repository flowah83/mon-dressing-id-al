import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Collage, EmptyState, Page, PageHeader } from "@/components/vestiaire/ui";
import { useDeleteWorn, useGarments, useWorn } from "@/lib/store";
import { formatWornHeading, groupWornByDate, localDateISO, neverWornHint } from "@/lib/wear";

export const Route = createFileRoute("/historique")({
  head: () => ({
    meta: [
      { title: "Historique des tenues — Vestiaire" },
      { name: "description", content: "Les tenues que vous avez portées, jour après jour." },
      { property: "og:title", content: "Historique des tenues — Vestiaire" },
      { property: "og:description", content: "Les tenues que vous avez portées, jour après jour." },
    ],
  }),
  component: Historique,
});

function Historique() {
  const { data: worn = [], isLoading } = useWorn();
  const { data: items = [] } = useGarments();
  const remove = useDeleteWorn();
  const today = localDateISO();
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [selected, setSelected] = useState<string | null>(null);
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of worn) map.set(entry.wornOn, (map.get(entry.wornOn) ?? 0) + 1);
    return map;
  }, [worn]);
  const visible = selected ? worn.filter((entry) => entry.wornOn === selected) : worn;
  const groups = groupWornByDate(visible);
  const unwornNames = items
    .filter((garment) => !worn.some((entry) => entry.itemIds.includes(garment.id)))
    .map((garment) => garment.name);
  const hint = neverWornHint(unwornNames);

  return (
    <Page>
      <PageHeader back eyebrow="Jours portés" title="Historique" />
      {hint && <p className="mb-4 text-sm text-muted-foreground">{hint}</p>}
      <MonthCalendar
        month={month}
        onMonth={setMonth}
        selected={selected}
        onSelect={setSelected}
        counts={counts}
        today={today}
      />
      {selected && (
        <button type="button" className="chip mb-4" onClick={() => setSelected(null)}>
          Tout l'historique
        </button>
      )}
      {isLoading ? (
        <div className="aspect-square animate-pulse rounded-3xl bg-muted" />
      ) : worn.length === 0 ? (
        <EmptyState
          title="Aucune tenue portée"
          text="Depuis le conseiller, le compositeur ou les favoris, touchez « Je la porte aujourd'hui »."
        >
          <Button asChild>
            <Link to="/conseiller">Ouvrir le conseiller</Link>
          </Button>
        </EmptyState>
      ) : groups.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Rien ce jour-là.</p>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.wornOn}>
              <h2 className="mb-3 text-3xl">{formatWornHeading(group.wornOn, today)}</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {group.entries.map((entry) => {
                  const pieces = entry.itemIds
                    .map((id) => items.find((garment) => garment.id === id))
                    .filter((garment): garment is NonNullable<typeof garment> => !!garment);
                  return (
                    <article key={entry.id} className="rounded-3xl bg-card p-3 shadow-soft">
                      <Collage items={pieces} />
                      <p className="mt-3 px-1 font-medium">{entry.name || "Tenue portée"}</p>
                      <p className="mt-1 px-1 text-sm text-muted-foreground">
                        {pieces.length
                          ? pieces.map((garment) => garment.name).join(" · ")
                          : "Pièces retirées du dressing"}
                      </p>
                      <button
                        type="button"
                        className="chip mt-3"
                        onClick={() => {
                          if (window.confirm("Retirer cette tenue de l'historique ?"))
                            remove.mutate(entry.id);
                        }}
                      >
                        <Trash2 className="size-4" /> Retirer
                      </button>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </Page>
  );
}

function MonthCalendar({
  month,
  onMonth,
  selected,
  onSelect,
  counts,
  today,
}: {
  month: Date;
  onMonth: (next: Date) => void;
  selected: string | null;
  onSelect: (day: string | null) => void;
  counts: Map<string, number>;
  today: string;
}) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const pad = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const label = format(month, "MMMM yyyy", { locale: fr });
  const title = label.charAt(0).toUpperCase() + label.slice(1);
  const cells: (number | null)[] = [
    ...Array.from({ length: pad }, () => null),
    ...Array.from({ length: days }, (_, index) => index + 1),
  ];

  return (
    <section
      className="mb-6 rounded-3xl bg-card p-4 shadow-soft"
      aria-label="Calendrier des tenues portées"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          className="min-h-11 min-w-11 rounded-full px-3 text-sm font-medium"
          aria-label="Mois précédent"
          onClick={() => onMonth(new Date(year, monthIndex - 1, 1))}
        >
          ‹
        </button>
        <h2 className="text-2xl capitalize">{title}</h2>
        <button
          type="button"
          className="min-h-11 min-w-11 rounded-full px-3 text-sm font-medium"
          aria-label="Mois suivant"
          onClick={() => onMonth(new Date(year, monthIndex + 1, 1))}
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
        {["L", "M", "M", "J", "V", "S", "D"].map((day, index) => (
          <span key={`${day}-${index}`} className="py-1">
            {day}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, index) => {
          if (!day) return <span key={`pad-${index}`} />;
          const iso = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const count = counts.get(iso) ?? 0;
          const active = selected === iso;
          return (
            <button
              key={iso}
              type="button"
              aria-pressed={active}
              aria-label={
                count ? `${day} ${title}, ${count} tenue${count > 1 ? "s" : ""}` : `${day} ${title}`
              }
              className={`flex min-h-11 flex-col items-center justify-center rounded-xl text-sm ${active ? "bg-primary text-primary-foreground" : count ? "bg-accent text-accent-foreground" : ""} ${iso === today && !active ? "ring-1 ring-primary" : ""}`}
              onClick={() => onSelect(active ? null : iso)}
            >
              {day}
              {count > 0 && <span className="mt-0.5 size-1.5 rounded-full bg-current" />}
            </button>
          );
        })}
      </div>
    </section>
  );
}
