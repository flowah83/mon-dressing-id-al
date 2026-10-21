import { describe, expect, it } from "vitest";
import { renderErrorPage } from "./error-page";

describe("page d'erreur", () => {
  it("est en français", () => {
    const html = renderErrorPage();
    expect(html).toContain('lang="fr"');
    expect(html).toMatch(/n'a pas pu s'afficher/);
    expect(html).toContain("Réessayer");
    expect(html).toContain("Retour à l'accueil");
    expect(html).not.toMatch(/Try again|Go home|didn't load/);
  });
});
