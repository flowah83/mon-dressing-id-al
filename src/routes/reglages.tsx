import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DemoSettingsCard, Page, PageHeader, SyncLine } from "@/components/vestiaire/ui";
import { useAuth } from "@/lib/account";
import { exportPersonal, importPersonal } from "@/lib/db";
import { requestSyncNow } from "@/lib/sync-bridge";

export const Route = createFileRoute("/reglages")({
  head: () => ({
    meta: [
      { title: "Réglages — Vestiaire" },
      { name: "description", content: "Compte, copie en ligne, export et import du dressing." },
      { property: "og:title", content: "Réglages — Vestiaire" },
      {
        property: "og:description",
        content: "Compte, copie en ligne, export et import du dressing.",
      },
    ],
  }),
  component: Reglages,
});

function Reglages() {
  const ref = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const auth = useAuth();
  const [notice, setNotice] = useState<string | null>(null);
  return (
    <Page>
      <PageHeader back title="Réglages" />
      <div className="space-y-3 text-sm leading-relaxed">
        <p>
          Cette page sert à ne pas perdre vos photos et vos fiches. Deux façons : un compte (copie
          privée en ligne) ou un fichier que vous gardez vous-même.
        </p>
      </div>
      <div className="mt-4 space-y-4 rounded-3xl bg-card p-6 shadow-soft">
        <h2 className="text-2xl">Compte</h2>
        <p>
          {auth.user
            ? "Une copie privée est dans votre compte, et une copie reste sur cet appareil pour ouvrir le dressing tout de suite, même sans réseau."
            : "Sans compte, tout reste sur cet appareil. Un compte ajoute une copie privée en ligne, visible seulement par vous."}
        </p>
        <SyncLine />
        <Button asChild className="min-h-11">
          <Link to="/compte">
            {auth.user ? "Gérer mon compte" : "Créer un compte ou se connecter"}
          </Link>
        </Button>
      </div>
      <div className="mt-4 space-y-4 rounded-3xl bg-card p-6 shadow-soft">
        <h2 className="text-2xl">Fichier de secours</h2>
        <p>
          Le fichier contient vos pièces, vos tenues et l'historique des jours portés. Il sert si
          vous changez de téléphone, ou si vous préférez ne pas utiliser de compte.
        </p>
        <p>
          Sur iPhone, après l'export, ouvrez l'app <strong>Fichiers</strong>, puis le dossier{" "}
          <strong>Téléchargements</strong>. Le fichier s'appelle vestiaire, suivi de la date, et se
          termine par .json.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            className="min-h-11"
            onClick={async () => {
              const b = await exportPersonal();
              const filename = `vestiaire-${new Date().toISOString().slice(0, 10)}.json`;
              const a = document.createElement("a");
              a.href = URL.createObjectURL(b);
              a.download = filename;
              a.click();
              const message = `Fichier « ${filename} » prêt. Sur iPhone : app Fichiers, dossier Téléchargements.`;
              setNotice(message);
              toast.success("Sauvegarde exportée");
            }}
          >
            Exporter mon dressing
          </Button>
          <Button variant="outline" className="min-h-11" onClick={() => ref.current?.click()}>
            Importer une sauvegarde
          </Button>
          <input
            ref={ref}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              try {
                const r = await importPersonal(f);
                await qc.invalidateQueries();
                requestSyncNow();
                const message = `${r.garments} pièces et ${r.outfits} tenues sont de retour dans Mon dressing.`;
                setNotice(message);
                toast.success(message);
              } catch (err) {
                toast.error((err as Error).message);
              }
            }}
          />
        </div>
        {notice && (
          <p className="rounded-2xl bg-accent p-4 text-sm text-accent-foreground" role="status">
            {notice}
          </p>
        )}
      </div>
      <div className="mt-4 space-y-3 rounded-3xl bg-card p-6 shadow-soft">
        <h2 className="text-2xl">Historique</h2>
        <p>Les jours où vous avez porté une tenue restent sur cet appareil, avec votre dressing.</p>
        <Button asChild variant="outline" className="min-h-11">
          <Link to="/historique">Ouvrir l'historique</Link>
        </Button>
      </div>
      <DemoSettingsCard />
      <div className="mt-4 space-y-3 rounded-3xl bg-card p-6 shadow-soft">
        <h2 className="text-2xl">Sur l'écran d'accueil</h2>
        <p>Pour ouvrir Vestiaire comme une application, sans la barre du navigateur :</p>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            Dans Safari, touchez <strong>Partager</strong> (le carré avec la flèche).
          </li>
          <li>
            Choisissez <strong>Sur l'écran d'accueil</strong>.
          </li>
          <li>
            Touchez <strong>Ajouter</strong>.
          </li>
        </ol>
        <p className="text-sm text-muted-foreground">
          Une fois ajoutée, l'application s'ouvre sans réseau : le dressing déjà présent sur
          l'appareil reste là. La météo et la note du styliste attendent la connexion.
        </p>
      </div>
    </Page>
  );
}
