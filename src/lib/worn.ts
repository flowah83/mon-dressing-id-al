/** Journal local « je la porte ». Maquette d'habitude, sur cet appareil seulement. */

const KEY = "vestiaire-worn-log";

export interface WornEntry {
  date: string;
  itemIds: string[];
  name: string;
}

export function todayISO(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function readWorn(): WornEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is WornEntry =>
        !!e &&
        typeof e === "object" &&
        typeof (e as WornEntry).date === "string" &&
        Array.isArray((e as WornEntry).itemIds),
    );
  } catch {
    return [];
  }
}

export function writeWorn(entry: WornEntry) {
  const next = [...readWorn().filter((e) => e.date !== entry.date), entry];
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

/** Jours d'affilée, aujourd'hui inclus s'il est noté, sinon jusqu'à hier. */
export function streak(entries: { date: string }[], today = todayISO()) {
  const days = new Set(entries.map((e) => e.date));
  const cursor = new Date(`${today}T12:00:00`);
  if (!days.has(today)) cursor.setDate(cursor.getDate() - 1);
  let n = 0;
  while (n < 366) {
    if (!days.has(todayISO(cursor))) break;
    n += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return n;
}

/** Lundi → dimanche de la semaine qui contient `today`. */
export function weekDates(today = todayISO()) {
  const d = new Date(`${today}T12:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(d);
    x.setDate(d.getDate() + i);
    return todayISO(x);
  });
}
