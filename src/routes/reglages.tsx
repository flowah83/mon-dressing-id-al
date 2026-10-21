import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Page, PageHeader, SyncLine } from "@/components/vestiaire/ui";
import { useAuth } from "@/lib/account";
import { exportPersonal, importPersonal } from "@/lib/db";
import { requestSyncNow } from "@/lib/sync-bridge";

export const Route = createFileRoute("/reglages")({
  head: () => ({
    meta: [
      { title: "Sauvegarde — Vestiaire" },
      { name: "description", content: "Compte, copie en ligne, export et import du dressing." },
      { property: "og:title", content: "Sauvegarde — Vestiaire" },
      { property: "og:description", content: "Compte, copie en ligne, export et import du dressing." },
    ],
  }),
  component: Reglages,
});

function Reglages() {
  const ref = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const auth = useAuth();
  return (
    <Page>
      <PageHeader eyebrow="Données" title="Sauvegarde" />
      <div className="space-y-4 rounded-3xl bg-card p-6 shadow-soft">
        <p>
          {auth.user
            ? "Une copie privée est dans votre compte, et une copie reste sur cet appareil pour ouvrir le dressing tout de suite."
            : "Vos photos et fiches sont sur cet appareil. Un compte permet une copie privée en ligne, visible seulement par vous."}
        </p>
        <SyncLine />
        <Button asChild><Link to="/compte">{auth.user ? "Gérer mon compte" : "Créer un compte ou se connecter"}</Link></Button>
      </div>
      <div className="mt-4 space-y-4 rounded-3xl bg-card p-6 shadow-soft">
        <p>Le fichier d'export reste disponible. Il sert de copie de secours, ou pour emporter le dressing sans passer par le compte.</p>
        <div className="flex flex-wrap gap-3">
          <Button onClick={async () => {
            const b = await exportPersonal();
            const a = document.createElement("a");
            a.href = URL.createObjectURL(b);
            a.download = `vestiaire-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
          }}>Exporter mon dressing</Button>
          <Button variant="outline" onClick={() => ref.current?.click()}>Importer une sauvegarde</Button>
          <input ref={ref} type="file" accept="application/json,.json" className="hidden" onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            try {
              const r = await importPersonal(f);
              await qc.invalidateQueries();
              requestSyncNow();
              toast.success(`${r.garments} pièces et ${r.outfits} tenues importées`);
            } catch (err) {
              toast.error((err as Error).message);
            }
          }} />
        </div>
      </div>
    </Page>
  );
}
