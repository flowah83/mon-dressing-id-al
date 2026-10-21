import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Heart, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Collage, EmptyState, Page, PageHeader } from "@/components/vestiaire/ui";
import { useAuth } from "@/lib/account";
import { adviseOutfits } from "@/lib/ai.functions";
import { ensureAccessCookie } from "@/lib/cloud";
import { uid } from "@/lib/db";
import { generateOutfits, type AdvisorResult } from "@/lib/rules";
import { useGarments, useMode, useOutfits, useSaveOutfit } from "@/lib/store";
import { LEVELS, OCCASIONS, STYLES, type Level, type Occasion, type StyleTag } from "@/lib/wardrobe";

export const Route = createFileRoute("/conseiller")({
  validateSearch: (s: Record<string, unknown>): { piece?: string } => (typeof s["piece"] === "string" ? { piece: s["piece"] } : {}),
  head: () => ({
    meta: [
      { title: "Conseiller de tenues — Vestiaire" },
      { name: "description", content: "Des tenues composées uniquement avec vos vêtements disponibles." },
      { property: "og:title", content: "Conseiller de tenues — Vestiaire" },
      { property: "og:description", content: "Des tenues composées uniquement avec vos vêtements." },
    ],
  }),
  component: Conseiller,
});

function Conseiller() {
  const { piece } = Route.useSearch();
  const { mode } = useMode();
  const auth = useAuth();
  const { data: items = [] } = useGarments();
  const { data: outfits = [] } = useOutfits();
  const saveOutfit = useSaveOutfit();
  const advise = useServerFn(adviseOutfits);
  const [occasion, setOccasion] = useState<Occasion>("quotidien");
  const [style, setStyle] = useState<StyleTag | "any">("any");
  const [temp, setTemp] = useState(18);
  const [level, setLevel] = useState<Level>("simple");
  const [anchor, setAnchor] = useState<string>(piece ?? "");
  const [res, setRes] = useState<AdvisorResult | null>(null);
  const [ai, setAi] = useState<{ loading: boolean; error?: string; advice?: { index: number; title: string; text: string }[] }>({ loading: false });

  const byId = (id: string) => items.find((g) => g.id === id)!;

  async function run() {
    const r = generateOutfits({ items, occasion, style, temperature: temp, level, anchorId: anchor || undefined, feedback: outfits });
    setRes(r);
    setAi({ loading: false });
    if (!r.proposals.length) return;
    setAi({ loading: true });
    try {
      await ensureAccessCookie();
      const a = await advise({ data: { occasion, style, temperature: temp, level, outfits: r.proposals.map((p) => ({ pieces: p.itemIds.map(byId).map((g) => ({ category: g.category, name: g.name, colors: g.colors, pattern: g.pattern, style: g.style })) })) } });
      setAi(a.ok ? { loading: false, advice: a.data.advice } : { loading: false, error: a.message });
    } catch {
      setAi({ loading: false, error: "Conseil IA indisponible pour le moment." });
    }
  }

  return (
    <Page>
      <PageHeader eyebrow={mode === "demo" ? "Démonstration" : "Avec vos pièces"} title="Conseiller" />
      {auth.ready && !auth.user && (
        <p className="mb-4 text-sm text-muted-foreground">
          {auth.configured
            ? "Les tenues sont composées avec vos pièces. Le texte du styliste demande une connexion."
            : "Le texte du styliste sera disponible avec le compte en ligne. Les règles de style fonctionnent déjà."}
        </p>
      )}
      {items.length === 0 ? (
        <EmptyState title="Rien à associer" text="Ajoutez d'abord des pièces à votre dressing."><Button asChild><Link to="/ajouter">Ajouter une pièce</Link></Button></EmptyState>
      ) : (
        <div className="space-y-5">
          <Group label="Occasion">{OCCASIONS.map((o) => <button key={o.value} className="chip" data-active={occasion === o.value} onClick={() => setOccasion(o.value)}>{o.label}</button>)}</Group>
          <Group label="Mode">{LEVELS.map((l) => <button key={l.value} className="chip" data-active={level === l.value} onClick={() => setLevel(l.value)}>{l.label}</button>)}</Group>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block"><span className="eyebrow">Style</span>
              <select className="field mt-2" value={style} onChange={(e) => setStyle(e.target.value as StyleTag | "any")}>
                <option value="any">Peu importe</option>{STYLES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select></label>
            <label className="block"><span className="eyebrow">Température (saisie manuelle) : {temp} °C</span>
              <input type="range" min={-5} max={35} value={temp} onChange={(e) => setTemp(Number(e.target.value))} className="mt-4 w-full accent-primary" /></label>
            <label className="block"><span className="eyebrow">Pièce imposée</span>
              <select className="field mt-2" value={anchor} onChange={(e) => setAnchor(e.target.value)}>
                <option value="">Aucune</option>{items.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select></label>
          </div>
          <Button size="lg" className="w-full sm:w-auto" onClick={run}>Proposer des tenues</Button>

          {res && res.missing.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-5"><p className="font-medium">Il manque pour composer une tenue :</p>
              <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">{res.missing.map((m) => <li key={m}>{m}</li>)}</ul></div>
          )}
          {res?.notes.map((n) => <p key={n} className="text-sm text-muted-foreground">{n}</p>)}
          {ai.loading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Conseil IA en cours…</p>}
          {ai.error && <p className="text-sm text-muted-foreground">{ai.error} Les explications ci-dessous viennent des règles de style.</p>}
          <div className="grid gap-6 md:grid-cols-3">
            {res?.proposals.map((p, i) => {
              const pieces = p.itemIds.map(byId);
              const adv = ai.advice?.find((a) => a.index === i) ?? ai.advice?.[i];
              return (
                <article key={p.itemIds.join()} className="rounded-3xl bg-card p-3 shadow-soft">
                  <Collage items={pieces} />
                  <div className="p-2">
                    <h2 className="mt-2 text-2xl">{adv?.title ?? `Tenue ${i + 1}`}</h2>
                    <p className="mt-1 text-sm">{pieces.map((g) => g.name).join(" · ")}</p>
                    {adv && <p className="mt-3 rounded-xl bg-accent p-3 text-sm text-accent-foreground"><Sparkles className="mr-1 inline size-3.5" /> Conseil IA : {adv.text}</p>}
                    <p className="eyebrow mt-3">Règles de style</p>
                    <ul className="mt-1 space-y-1 text-sm text-muted-foreground">{p.reasons.map((r) => <li key={r}>· {r}</li>)}</ul>
                    <Button variant="outline" size="sm" className="mt-4" onClick={async () => {
                      await saveOutfit.mutateAsync({ id: uid(), mode, name: adv?.title ?? `Tenue ${OCCASIONS.find((o) => o.value === occasion)?.label}`, itemIds: p.itemIds, source: "conseiller", explanation: adv?.text, createdAt: Date.now() });
                      toast.success("Tenue ajoutée aux favoris");
                    }}><Heart /> Garder en favori</Button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}
    </Page>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><p className="eyebrow mb-2">{label}</p><div className="flex flex-wrap gap-2">{children}</div></div>;
}
