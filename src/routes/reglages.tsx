import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Page, PageHeader } from "@/components/vestiaire/ui";
import { exportPersonal, importPersonal } from "@/lib/db";

export const Route = createFileRoute("/reglages")({
  head: () => ({
    meta: [
      { title: "Sauvegarde — Vestiaire" },
      { name: "description", content: "Exporter ou importer votre dressing enregistré sur cet appareil." },
      { property: "og:title", content: "Sauvegarde — Vestiaire" },
      { property: "og:description", content: "Exporter ou importer votre dressing." },
    ],
  }),
  component: Reglages,
});

function Reglages() {
  const ref = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  return (
    <Page>
      <PageHeader eyebrow="Données" title="Sauvegarde" />
      <div className="space-y-4 rounded-3xl bg-card p-6 shadow-soft">
        <p>Vos photos et fiches sont enregistrées sur cet appareil uniquement, jamais publiées. Exportez régulièrement une sauvegarde.</p>
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
            if (!f) return;
            try { const r = await importPersonal(f); await qc.invalidateQueries(); toast.success(`${r.garments} pièces et ${r.outfits} tenues importées`); }
            catch (err) { toast.error((err as Error).message); }
          }} />
        </div>
      </div>
    </Page>
  );
}
