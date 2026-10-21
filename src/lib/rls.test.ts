import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { AI_DAILY_LIMIT } from "./quota";
import { PHOTO_BUCKET } from "./sync-plan";
import { CATEGORIES, COLORS, PATTERNS, SEASONS, STYLES } from "./wardrobe";

const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/20261021140000_comptes_sauvegarde_privee.sql"), "utf8");
const lower = sql.toLowerCase();

describe("règles d'accès de la sauvegarde", () => {
  it("ferme les tables et n'ouvre chaque ligne qu'à son propriétaire", () => {
    for (const table of ["public.garments", "public.outfits", "public.ai_usage"]) {
      expect(lower).toContain(`alter table ${table} enable row level security`);
      expect(lower).toContain(`revoke all on table ${table} from anon`);
    }
    expect(sql).toContain("using (auth.uid() = user_id)");
    expect(sql).toContain("with check (auth.uid() = user_id)");
    expect(sql).not.toMatch(/create policy[\s\S]*?to anon/i);
    expect(lower).not.toContain("using (true)");
    expect(sql).toContain("new.user_id := auth.uid()");
  });

  it("interdit d'écrire le compteur autrement que par la fonction, limitée à 50", () => {
    expect(sql).toContain(`lim constant int := ${AI_DAILY_LIMIT}`);
    expect(sql).toContain(`analyses <= ${AI_DAILY_LIMIT}`);
    expect(sql).toContain(`advice <= ${AI_DAILY_LIMIT}`);
    expect(lower).toContain("security definer");
    expect(sql).toContain("create or replace function public.consume_ai_quota(kind text)");
    expect(sql).not.toContain("consume_ai_quota(user_id");
    expect(lower).toContain("revoke all on function public.consume_ai_quota(text) from anon");
    expect(lower).toContain("grant execute on function public.consume_ai_quota(text) to authenticated");
    expect(lower).toContain("grant select on table public.ai_usage to authenticated");
    expect(lower).not.toMatch(/grant\s+(insert|update|delete|all)[^;]*ai_usage/);
    expect(sql).toContain("kind is distinct from 'analysis'");
    expect(sql).toContain("kind is distinct from 'advice'");
    expect(sql).toContain("timezone('Europe/Paris', now())");
  });

  it("range les photos dans un bac privé, au nom de la personne", () => {
    expect(sql).toContain(`'${PHOTO_BUCKET}', '${PHOTO_BUCKET}', false`);
    expect(sql).toContain("public = false");
    expect(sql).toContain("(storage.foldername(name))[1] = auth.uid()::text");
    expect(lower).not.toContain("bucket public");
  });

  it("reprend les mêmes catégories, couleurs, motifs et styles que l'application", () => {
    for (const value of [
      ...CATEGORIES.map((item) => item.value),
      ...COLORS.map((item) => item.value),
      ...PATTERNS,
      ...STYLES.map((item) => item.value),
      ...SEASONS.map((item) => item.value),
      "manuel",
      "conseiller",
      "like",
      "dislike",
    ]) {
      expect(sql).toContain(`'${value}'`);
    }
  });
});
