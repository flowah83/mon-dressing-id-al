import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Camera, Shirt, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDemoControls } from "@/lib/store";

function withTransition(run: () => void | Promise<void>) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const host = document as Document & {
    startViewTransition?: (callback: () => void | Promise<void>) => void;
  };
  if (reduced || typeof host.startViewTransition !== "function") {
    void run();
    return;
  }
  host.startViewTransition(async () => {
    await run();
  });
}

export const Route = createFileRoute("/bienvenue")({
  head: () => ({
    meta: [
      { title: "Bienvenue — Vestiaire" },
      {
        name: "description",
        content:
          "Photographiez vos pièces. Vestiaire compose une tenue avec ce que vous avez déjà.",
      },
    ],
  }),
  component: Bienvenue,
});

const WELCOME_KEY = "vestiaire-welcome";

function Bienvenue() {
  const demo = useDemoControls();
  const navigate = useNavigate();

  function remember() {
    try {
      localStorage.setItem(WELCOME_KEY, "1");
    } catch {
      /* navigation privée */
    }
  }

  return (
    <main className="welcome mx-auto flex w-full max-w-lg flex-col">
      <p className="text-[0.9375rem] font-medium text-primary">Vestiaire</p>
      <h1 className="mt-3 max-w-[12ch]">Vos vêtements, déjà là.</h1>
      <p className="mt-3 max-w-[28ch] text-[1.0625rem] leading-6 text-[color:var(--label-secondary,#636366)]">
        Photographiez une pièce. Vestiaire propose une tenue avec ce que vous avez.
      </p>
      <ol className="welcome-list">
        <li>
          <span className="welcome-mark">
            <Camera className="size-5" strokeWidth={1.75} />
          </span>
          <span>Vous photographiez une pièce</span>
        </li>
        <li>
          <span className="welcome-mark">
            <Shirt className="size-5" strokeWidth={1.75} />
          </span>
          <span>Elle rejoint votre dressing</span>
        </li>
        <li>
          <span className="welcome-mark">
            <Sparkles className="size-5" strokeWidth={1.75} />
          </span>
          <span>Une tenue vous est proposée</span>
        </li>
      </ol>
      <div className="welcome-actions mt-auto">
        <Button
          className="ios-fill w-full"
          onClick={() => {
            remember();
            withTransition(() => navigate({ to: "/ajouter" }));
          }}
        >
          Commencer avec mes pièces
        </Button>
        <button
          type="button"
          className="welcome-quiet press"
          onClick={() => {
            remember();
            void demo.start().then(() => withTransition(() => navigate({ to: "/" })));
          }}
        >
          Voir un exemple
        </button>
      </div>
    </main>
  );
}
