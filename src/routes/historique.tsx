import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useWornLog } from "@/components/vestiaire/ritual";
import { Collage, EmptyState, Page, PageHeader } from "@/components/vestiaire/ui";
import { useGarments } from "@/lib/store";
import type { Garment } from "@/lib/wardrobe";
import { todayISO, weekDates, type WornEntry } from "@/lib/worn";

export const Route = createFileRoute("/historique")({
  head: () => ({
    meta: [
      { title: "Historique des tenues — Vestiaire" },
      { name: "description", content: "Les tenues que vous avez portées, jour après jour." },
    ],
  }),
  component: Historique,
});

function heading(date: string, today: string) {
  if (date === today) return "Aujourd'hui";
  const yesterday = new Date(`${today}T12:00:00`);
  yesterday.setDate(yesterday.getDate() - 1);
  const y = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
  if (date === y) return "Hier";
  const label = format(new Date(`${date}T12:00:00`), "EEEE d MMMM", { locale: fr });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function Historique() {
  const { entries } = useWornLog();
  const { data: items = [], isLoading } = useGarments();
  const today = todayISO();
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selected, setSelected] = useState<string | null>(null);
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of entries) map.set(entry.date, (map.get(entry.date) ?? 0) + 1);
    return map;
  }, [entries]);
  const visible = selected ? entries.filter((entry) => entry.date === selected) : entries;
  const groups = [...visible].sort((a, b) => (a.date < b.date ? 1 : -1));
  const unworn = items.filter((garment) => !entries.some((entry) => entry.itemIds.includes(garment.id)));

  return (
    <Page>
      <PageHeader back eyebrow="Jours portés" title="Historique" />
      <WeekSummary entries={entries} today={today} />
      {unworn.length > 0 && (
        <p className="inset-note mb-4">
          {unworn.length === 1
            ? `${unworn[0]?.name ?? "Une pièce"} n'a pas encore été portée.`
            : `${unworn.length} pièces n'ont pas encore été portées.`}
        </p>
      )}
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
        <div className="aspect-square animate-pulse rounded-[var(--radius-card)] bg-muted" />
      ) : entries.length === 0 ? (
        <EmptyState
          title="Aucune tenue portée"
          text="Depuis le conseiller, touchez « Je la porte ». Le jour reste dans cet historique."
        >
          <Button asChild>
            <Link to="/conseiller">Ouvrir le conseiller</Link>
          </Button>
        </EmptyState>
      ) : groups.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Rien ce jour-là.</p>
      ) : (
        <div className="space-y-6">
          {groups.map((entry) => (
            <WornDay key={entry.date} entry={entry} today={today} items={items} />
          ))}
        </div>
      )}
    </Page>
  );
}

function WornDay({
  entry,
  today,
  items,
}: {
  entry: WornEntry;
  today: string;
  items: Garment[];
}) {
  const pieces = entry.itemIds
    .map((id) => items.find((garment) => garment.id === id))
    .filter((garment): garment is Garment => !!garment);
  return (
    <section>
      <h2 className="history-kicker mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
        {heading(entry.date, today)}
      </h2>
      <article className="rounded-[var(--radius-card)] bg-card p-3 shadow-soft">
        <Collage items={pieces} />
        <p className="mt-3 px-1 text-[17px] font-semibold">{entry.name || "Tenue portée"}</p>
        <p className="mt-1 px-1 text-[15px] text-muted-foreground">
          {pieces.length ? pieces.map((garment) => garment.name).join(" · ") : "Pièces retirées du dressing"}
        </p>
      </article>
    </section>
  );
}

function WeekSummary({ entries, today }: { entries: WornEntry[]; today: string }) {
  const dates = weekDates(today);
  const noted = new Set(entries.map((entry) => entry.date));
  const count = dates.filter((date) => noted.has(date)).length;
  const labels = ["L", "M", "M", "J", "V", "S", "D"];
  return (
    <section className="week-summary mb-4 rounded-[var(--radius-card)] bg-card p-4 shadow-soft">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[17px] font-semibold tracking-[-0.02em]">Cette semaine</h2>
        <p className="text-[13px] text-muted-foreground">
          {count === 0 ? "Aucun jour noté" : `${count} tenue${count > 1 ? "s" : ""}`}
        </p>
      </div>
      <div className="mt-4 grid grid-cols-7">
        {dates.map((date, index) => {
          const on = noted.has(date);
          const isToday = date === today;
          return (
            <div key={date} className="flex flex-col items-center gap-1.5">
              <svg className="week-ring" viewBox="0 0 36 36" aria-hidden>
                <circle className="week-ring-track" cx="18" cy="18" r="14" />
                {on ? <circle className="week-ring-on" cx="18" cy="18" r="14" /> : null}
                {isToday && !on ? <circle className="week-ring-today" cx="18" cy="18" r="14" /> : null}
              </svg>
              <span className={`text-[11px] font-medium ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                {labels[index]}
              </span>
            </div>
          );
        })}
      </div>
    </section>
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
    <section className="month-cal mb-6 rounded-[var(--radius-card)] bg-card p-4 shadow-soft" aria-label="Calendrier des tenues portées">
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          className="press grid size-11 place-items-center rounded-full text-primary"
          aria-label="Mois précédent"
          onClick={() => onMonth(new Date(year, monthIndex - 1, 1))}
        >
          <ChevronLeft className="size-5" />
        </button>
        <h2 className="text-[17px] font-semibold">{title}</h2>
        <button
          type="button"
          className="press grid size-11 place-items-center rounded-full text-primary"
          aria-label="Mois suivant"
          onClick={() => onMonth(new Date(year, monthIndex + 1, 1))}
        >
          <ChevronRight className="size-5" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-muted-foreground">
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
              aria-label={count ? `${day} ${title}, ${count} tenue${count > 1 ? "s" : ""}` : `${day} ${title}`}
              className={`press flex min-h-11 flex-col items-center justify-center rounded-xl text-[15px] ${active ? "bg-primary text-primary-foreground" : ""} ${iso === today && !active ? "text-primary font-semibold" : ""}`}
              onClick={() => onSelect(active ? null : iso)}
            >
              {day}
              {count > 0 && (
                <span className={`mt-0.5 size-1.5 rounded-full ${active ? "bg-primary-foreground" : "bg-primary"}`} />
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
