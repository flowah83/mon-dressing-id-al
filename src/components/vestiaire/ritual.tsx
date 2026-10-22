import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  readWorn,
  streak,
  todayISO,
  weekDates,
  writeWorn,
  type WornEntry,
} from "@/lib/worn";
import { cn } from "@/lib/utils";

export function useWornLog() {
  const [entries, setEntries] = useState<WornEntry[]>([]);
  const today = todayISO();
  useEffect(() => {
    setEntries(readWorn());
  }, []);
  const log = useCallback((entry: WornEntry) => {
    setEntries(writeWorn(entry));
  }, []);
  return {
    entries,
    today,
    log,
    count: streak(entries, today),
    wornToday: entries.some((e) => e.date === today),
  };
}

export function StreakPill({ count }: { count: number }) {
  if (count < 1) return null;
  return (
    <p className="streak-pill shrink-0 rounded-full bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground">
      {count} jour{count > 1 ? "s" : ""} d'affilée
    </p>
  );
}

export function WeekCard() {
  const { entries, today } = useWornLog();
  const dates = weekDates(today);
  const noted = new Set(entries.map((e) => e.date));
  const n = dates.filter((d) => noted.has(d)).length;
  const labels = ["L", "M", "M", "J", "V", "S", "D"];
  return (
    <section className="mb-6 rounded-[var(--radius-card)] bg-card p-5 shadow-soft">
      <p className="eyebrow">Votre semaine</p>
      <h2 className="mt-1 text-[1.75rem] leading-none">
        {n === 0 ? "La semaine commence" : `${n} jour${n > 1 ? "s" : ""} habillé${n > 1 ? "s" : ""}`}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {n === 0
          ? "Chaque « Je la porte » laisse une trace. Le dimanche, la semaine se relit ici. Un jour sauté ne casse rien."
          : "Le fil de la semaine, sans reproche pour les jours passés autrement."}
      </p>
      <div className="mt-4 grid grid-cols-7 gap-1.5">
        {dates.map((d, i) => {
          const on = noted.has(d);
          const isToday = d === today;
          return (
            <div key={d} className="text-center">
              <span
                className={cn(
                  "mx-auto grid size-8 place-items-center rounded-full text-xs font-semibold",
                  on ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
                  isToday && !on && "ring-2 ring-primary",
                )}
              >
                {labels[i]}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function SwipeCard({
  children,
  onLike,
  onNext,
}: {
  children: ReactNode;
  onLike: () => void;
  onNext: () => void;
}) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const dxRef = useRef(0);
  const [dx, setDx] = useState(0);
  const [like, setLike] = useState(false);
  const [leaving, setLeaving] = useState(false);

  function down(e: React.PointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("button, a, input, summary, label")) return;
    start.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function move(e: React.PointerEvent<HTMLDivElement>) {
    if (!start.current) return;
    const x = e.clientX - start.current.x;
    const y = e.clientY - start.current.y;
    if (Math.abs(y) > Math.abs(x) + 8) return;
    const next = Math.max(-140, Math.min(140, x));
    dxRef.current = next;
    setDx(next);
  }
  function up() {
    if (!start.current) return;
    const travel = dxRef.current;
    start.current = null;
    dxRef.current = 0;
    if (travel > 72) {
      setLike(true);
      setDx(0);
      onLike();
      window.setTimeout(() => setLike(false), 700);
      return;
    }
    if (travel < -72) {
      setLeaving(true);
      window.setTimeout(() => {
        setLeaving(false);
        setDx(0);
        onNext();
      }, 220);
      return;
    }
    setDx(0);
  }

  return (
    <div
      className={cn("swipe-card relative", leaving && "swipe-leave", like && "swipe-liked")}
      style={leaving ? undefined : { transform: `translateX(${dx}px) rotate(${dx / 32}deg)` }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      {dx > 36 && <span className="swipe-stamp swipe-like">J'aime</span>}
      {dx < -36 && <span className="swipe-stamp swipe-next">Autre</span>}
      {like && (
        <span className="like-burst" aria-hidden>
          ♥
        </span>
      )}
      {children}
    </div>
  );
}

export function WearNote({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="celebrate" role="status">
      <svg className="celebrate-mark" viewBox="0 0 64 64" aria-hidden>
        <circle cx="32" cy="32" r="26" />
        <path d="M22 33.5 29 40.5 44 24" />
      </svg>
      <p>Noté. Belle journée.</p>
    </div>
  );
}
