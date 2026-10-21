import { describe, expect, it } from "vitest";
import { isAppShellRequest, shouldRegisterServiceWorker } from "./pwa";

const app = { origin: "https://vestiaire.test", appOrigin: "https://vestiaire.test" };

describe("cache de l'application", () => {
  it("garde la coque et les fichiers, pas les fonctions serveur ni la météo", () => {
    expect(
      isAppShellRequest({
        ...app,
        method: "GET",
        pathname: "/",
        destination: "document",
        search: "",
      }),
    ).toBe(true);
    expect(
      isAppShellRequest({
        ...app,
        method: "GET",
        pathname: "/assets/app.js",
        destination: "script",
        search: "",
      }),
    ).toBe(true);
    expect(
      isAppShellRequest({ ...app, method: "GET", pathname: "/sw.js", destination: "", search: "" }),
    ).toBe(true);
    expect(
      isAppShellRequest({
        ...app,
        method: "POST",
        pathname: "/",
        destination: "document",
        search: "",
      }),
    ).toBe(false);
    expect(
      isAppShellRequest({
        ...app,
        method: "GET",
        pathname: "/",
        destination: "document",
        search: "?_serverFn=advise",
      }),
    ).toBe(false);
    expect(
      isAppShellRequest({
        ...app,
        method: "GET",
        pathname: "/api/forecast",
        destination: "",
        search: "",
        origin: "https://api.open-meteo.com",
      }),
    ).toBe(false);
  });

  it("n'enregistre le service worker qu'en production", () => {
    expect(shouldRegisterServiceWorker(false, true)).toBe(false);
    expect(shouldRegisterServiceWorker(true, false)).toBe(false);
    expect(shouldRegisterServiceWorker(true, true)).toBe(true);
  });
});
