import { afterEach, describe, expect, it } from "vitest";
import { readAccessToken } from "./access-cookie";
import { frenchAuthError, isPlausibleEmail, passwordIssue } from "./auth-errors";
import { parisDay } from "./quota";
import { getSupabase, resetBrowserSupabaseForTests } from "./cloud";
import { readSupabaseConfig, serverEnv } from "./supabase-env";

afterEach(() => {
  delete process.env["SUPABASE_URL"];
  delete process.env["SUPABASE_PUBLISHABLE_KEY"];
  delete process.env["SUPABASE_ANON_KEY"];
  resetBrowserSupabaseForTests();
});

describe("variables Lovable Cloud", () => {
  it("reconnaît les noms posés par Lovable, y compris l'ancienne clé anon", () => {
    expect(
      readSupabaseConfig({
        VITE_SUPABASE_URL: " https://abcd.supabase.co ",
        VITE_SUPABASE_PUBLISHABLE_KEY: " cle ",
      }),
    ).toEqual({ url: "https://abcd.supabase.co", publishableKey: "cle" });

    expect(
      readSupabaseConfig({
        SUPABASE_URL: "https://serveur.supabase.co",
        SUPABASE_ANON_KEY: "anon",
        VITE_SUPABASE_PUBLISHABLE_KEY: "vite",
      })?.publishableKey,
    ).toBe("anon");

    expect(readSupabaseConfig({})).toBeNull();
    expect(readSupabaseConfig({ VITE_SUPABASE_URL: "https://abcd.supabase.co" })).toBeNull();
    expect(readSupabaseConfig({ VITE_SUPABASE_URL: "http://exemple.test", VITE_SUPABASE_PUBLISHABLE_KEY: "x" })).toBeNull();
    expect(
      readSupabaseConfig({ SUPABASE_URL: "http://127.0.0.1:54321", SUPABASE_PUBLISHABLE_KEY: "local" })?.url,
    ).toBe("http://127.0.0.1:54321");
  });

  it("lit les variables serveur et ne plante pas sans configuration", () => {
    process.env["SUPABASE_URL"] = "https://compte.supabase.co";
    process.env["SUPABASE_PUBLISHABLE_KEY"] = "publique";
    expect(readSupabaseConfig(serverEnv())).toEqual({
      url: "https://compte.supabase.co",
      publishableKey: "publique",
    });
    delete process.env["SUPABASE_URL"];
    delete process.env["SUPABASE_PUBLISHABLE_KEY"];
    expect(() => getSupabase()).not.toThrow();
  });
});

describe("jeton d'accès", () => {
  it("lit le cookie ou l'en-tête, et ignore un cookie vide", () => {
    expect(readAccessToken("autre=1; vestiaire-access-token=abc.def", null)).toBe("abc.def");
    expect(readAccessToken("vestiaire-access-token=", "Bearer jeton")).toBe("jeton");
    expect(readAccessToken(null, "Basic abc")).toBeNull();
    expect(readAccessToken("vestiaire-access-token=%20", null)).toBeNull();
  });
});

describe("formulaires de compte", () => {
  it("vérifie l'e-mail et le mot de passe en français", () => {
    expect(isPlausibleEmail("florian@exemple.fr")).toBe(true);
    expect(isPlausibleEmail("pas-une-adresse")).toBe(false);
    expect(passwordIssue("court")).toMatch(/8 caractères/);
    expect(passwordIssue("motdepasse", "autre")).toMatch(/identiques/);
    expect(passwordIssue("motdepasse", "motdepasse")).toBeNull();
  });

  it("ne renvoie pas le message technique du fournisseur", () => {
    expect(frenchAuthError("Invalid login credentials")).toMatch(/incorrect/);
    expect(frenchAuthError("Email not confirmed")).toMatch(/Confirmez/);
    expect(frenchAuthError("User already registered")).toMatch(/déjà/);
    expect(frenchAuthError('relation "secret" does not exist')).toBe("Le compte en ligne n'a pas répondu. Réessayez dans un instant.");
  });
});

describe("jour du quota", () => {
  it("change à minuit, heure de Paris", () => {
    expect(parisDay(new Date("2026-01-15T23:30:00Z"))).toBe("2026-01-16");
    expect(parisDay(new Date("2026-07-15T21:30:00Z"))).toBe("2026-07-15");
    expect(parisDay(new Date("2026-07-15T22:30:00Z"))).toBe("2026-07-16");
  });
});
