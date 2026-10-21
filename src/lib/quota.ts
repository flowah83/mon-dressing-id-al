/** Daily cap for each AI feature. Kept in sync with the SQL quota function. */
export const AI_DAILY_LIMIT = 50;

export type AiKind = "analysis" | "advice";

/** Calendar day in Paris, `YYYY-MM-DD`, matching the database quota. */
export function parisDay(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
