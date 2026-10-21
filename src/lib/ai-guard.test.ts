import { describe, expect, it, vi } from "vitest";
import { authorizeAiCall, interpretQuotaPayload, messageFor, screenAdvice, screenGarmentImage } from "./ai-guard";
import { AI_DAILY_LIMIT } from "./quota";

const piece = { category: "haut", name: "Chemise", colors: ["bleu"], pattern: "uni", style: "classique" };

function advice(outfits = 1) {
  return {
    occasion: "quotidien",
    style: "classique",
    temperature: 18,
    level: "simple",
    outfits: Array.from({ length: outfits }, () => ({ pieces: [piece] })),
  };
}

describe("analyse photo", () => {
  it("accepte une petite photo jpeg, png ou webp", () => {
    for (const kind of ["jpeg", "png", "webp", "jpg"]) {
      const image = `data:image/${kind};base64,YQ==`;
      expect(screenGarmentImage(image)).toEqual({ ok: true, image });
    }
  });

  it("refuse un format, une photo vide ou une photo trop lourde", () => {
    expect(screenGarmentImage("data:image/svg+xml;base64,YQ==").ok).toBe(false);
    expect(screenGarmentImage("data:image/gif;base64,YQ==").ok).toBe(false);
    expect(screenGarmentImage("bonjour").ok).toBe(false);
    expect(screenGarmentImage(12).ok).toBe(false);
    const heavy = screenGarmentImage(`data:image/jpeg;base64,${"A".repeat(4_000_000)}`);
    expect(heavy.ok).toBe(false);
    if (!heavy.ok) expect(heavy.message).toMatch(/lourde|format/i);
  });
});

describe("conseil", () => {
  it("garde uniquement les champs attendus", () => {
    const result = screenAdvice({ ...advice(), extra: "ignore", outfits: [{ pieces: [{ ...piece, secret: "non" }] }] });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.outfits[0]?.pieces[0]).toEqual(piece);
  });

  it("refuse trop de tenues, une température absurde ou un texte énorme", () => {
    expect(screenAdvice(advice(4)).ok).toBe(false);
    expect(screenAdvice({ ...advice(), temperature: 80 }).ok).toBe(false);
    expect(screenAdvice({ ...advice(), outfits: [{ pieces: [{ ...piece, name: "x".repeat(201) }] }] }).ok).toBe(false);
  });
});

describe("session et quota", () => {
  it("refuse un appel sans compte configuré, sans jeton, ou avec un jeton invalide", async () => {
    const verify = vi.fn(async () => ({ id: "user-1" }));
    const consume = vi.fn(async () => ({ ok: true as const, remaining: 49 }));

    const missing = await authorizeAiCall({ token: "t", kind: "analysis", configured: false, verify, consume });
    expect(missing).toMatchObject({ ok: false, code: "config" });
    expect(verify).not.toHaveBeenCalled();

    const signedOut = await authorizeAiCall({ token: null, kind: "analysis", configured: true, verify, consume });
    expect(signedOut.ok).toBe(false);
    if (!signedOut.ok) expect(signedOut.message).toMatch(/Connectez-vous/);
    expect(consume).not.toHaveBeenCalled();

    const expired = await authorizeAiCall({
      token: "ancien",
      kind: "advice",
      configured: true,
      verify: async () => null,
      consume,
    });
    expect(expired.ok).toBe(false);
    if (!expired.ok) expect(expired.message).toMatch(/expiré/);
    expect(consume).not.toHaveBeenCalled();
  });

  it("bloque à 50 et laisse passer en dessous, séparément pour chaque usage", async () => {
    const verify = vi.fn(async () => ({ id: "user-1" }));
    const consume = vi.fn(async (_token: string, kind: string) =>
      kind === "analysis" ? { ok: false as const, code: "limit" as const } : { ok: true as const, remaining: 49 },
    );

    const analysis = await authorizeAiCall({ token: "ok", kind: "analysis", configured: true, verify, consume });
    expect(analysis).toMatchObject({ ok: false, code: "limit" });
    if (!analysis.ok) {
      expect(analysis.message).toContain(String(AI_DAILY_LIMIT));
      expect(analysis.message).toMatch(/analyses photo/);
      expect(analysis.message).not.toMatch(/supabase|jwt|unauthorized/i);
    }

    const advice = await authorizeAiCall({ token: "ok", kind: "advice", configured: true, verify, consume });
    expect(advice).toEqual({ ok: true, userId: "user-1" });
    expect(consume).toHaveBeenCalledWith("ok", "advice");
  });

  it("n'appelle pas le modèle si la vérification du compte échoue", async () => {
    const consume = vi.fn();
    const result = await authorizeAiCall({
      token: "ok",
      kind: "analysis",
      configured: true,
      verify: async () => {
        throw new Error("réseau");
      },
      consume,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/Réessayez/);
    expect(consume).not.toHaveBeenCalled();
  });

  it("lit la réponse du compteur, y compris en texte", () => {
    expect(interpretQuotaPayload({ ok: true, remaining: 3 })).toEqual({ ok: true, remaining: 3 });
    expect(interpretQuotaPayload('{"ok":false,"code":"limit"}')).toEqual({ ok: false, code: "limit" });
    expect(interpretQuotaPayload({ ok: false, code: "nope" })).toEqual({ ok: false, code: "unavailable" });
  });

  it("écrit les messages en français", () => {
    for (const reason of ["config", "signed-out", "expired", "limit", "unavailable"] as const) {
      expect(messageFor("analysis", reason)).not.toMatch(/supabase|jwt|token|unauthorized/i);
      expect(messageFor("advice", reason).length).toBeGreaterThan(10);
    }
  });
});
