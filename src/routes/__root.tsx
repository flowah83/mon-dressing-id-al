import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AccountProvider } from "@/lib/account";
import { shouldRegisterServiceWorker } from "@/lib/pwa";
import { ModeProvider } from "@/lib/store";
import { BottomNav, DemoBanner } from "@/components/vestiaire/ui";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl text-foreground">404</h1>
        <h2 className="mt-4 font-display text-3xl text-foreground">Page introuvable</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Cette adresse n'existe pas dans Vestiaire.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground"
          >
            Retour à l'accueil
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-3xl text-foreground">Cette page n'a pas pu s'afficher</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Un problème est survenu. Vous pouvez réessayer, ou revenir à l'accueil.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground"
          >
            Réessayer
          </button>
          <a
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-card px-5 text-sm font-medium"
          >
            Retour à l'accueil
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Vestiaire — votre dressing et vos tenues" },
      {
        name: "description",
        content: "Photographiez vos vêtements et composez des tenues avec ce que vous avez déjà.",
      },
      { property: "og:title", content: "Vestiaire" },
      {
        property: "og:description",
        content: "Votre dressing en photos et un conseiller de tenues.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "theme-color", content: "#f8f4ec" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "Vestiaire" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=Manrope:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    if (!shouldRegisterServiceWorker(import.meta.env.PROD, "serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js");
  }, []);

  useEffect(() => {
    const paths = [
      "/",
      "/ajouter",
      "/composer",
      "/conseiller",
      "/favoris",
      "/historique",
      "/reglages",
      "/compte",
    ] as const;
    for (const to of paths) void router.preloadRoute({ to }).catch(() => undefined);
  }, [router]);

  return (
    <QueryClientProvider client={queryClient}>
      <AccountProvider>
        <ModeProvider>
          <OfflineNote />
          <DemoBanner />
          <Outlet />
          <BottomNav />
          <Toaster position="top-center" />
        </ModeProvider>
      </AccountProvider>
    </QueryClientProvider>
  );
}

function OfflineNote() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const sync = () => setOffline(typeof navigator !== "undefined" && navigator.onLine === false);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);
  if (!offline) return null;
  return (
    <p className="bg-foreground px-5 py-3 text-center text-sm text-background">
      Hors ligne. Le dressing de cet appareil reste ouvert. La météo, le conseil du styliste et la
      copie en ligne reprendront avec le réseau.
    </p>
  );
}
