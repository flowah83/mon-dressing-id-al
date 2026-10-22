import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Camera, ImageIcon, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { GarmentForm, emptyFields, type GarmentFields } from "@/components/vestiaire/GarmentForm";
import { BusyStatus, LocalNotice, Page, PageHeader } from "@/components/vestiaire/ui";
import { usePhotoCutout } from "@/hooks/use-photo-cutout";
import { useAuth } from "@/lib/account";
import { analyzeGarment } from "@/lib/ai.functions";
import { ensureAccessCookie } from "@/lib/cloud";
import { uid } from "@/lib/db";
import { blobToDataUrl, compressImage } from "@/lib/image";
import { useMode, useSaveGarment } from "@/lib/store";
import {
  CATEGORIES,
  COLORS,
  SEASONS,
  STYLES,
  PATTERNS,
  type Category,
  type Season,
  type StyleTag,
} from "@/lib/wardrobe";

export const Route = createFileRoute("/ajouter")({
  head: () => ({
    meta: [
      { title: "Ajouter une pièce — Vestiaire" },
      {
        name: "description",
        content: "Photographiez un vêtement, vérifiez la fiche et ajoutez-le à votre dressing.",
      },
      { property: "og:title", content: "Ajouter une pièce — Vestiaire" },
      {
        property: "og:description",
        content: "Photographiez un vêtement et ajoutez-le à votre dressing.",
      },
    ],
  }),
  component: Ajouter,
});

type Status = "idle" | "compress" | "analyse" | "ready" | "saving";

function Ajouter() {
  const { mode } = useMode();
  const auth = useAuth();
  const navigate = useNavigate();
  const analyze = useServerFn(analyzeGarment);
  const save = useSaveGarment();
  const cutout = usePhotoCutout();
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<Blob | null>(null);
  const [cutoutBlob, setCutoutBlob] = useState<Blob | null>(null);
  const [useCutout, setUseCutout] = useState(false);
  const [cutoutNote, setCutoutNote] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [fields, setFields] = useState<GarmentFields>(emptyFields);
  const [aiState, setAiState] = useState<{
    kind: "ok" | "error" | "none";
    message?: string;
    confidence?: string;
  }>({ kind: "none" });

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const chosen = useCutout && cutoutBlob ? cutoutBlob : source;

  function showPhoto(next: Blob) {
    setPreview((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return URL.createObjectURL(next);
    });
  }

  async function onFile(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/") && !/\.(heic|heif)$/i.test(file.name)) {
      toast.error("Ce fichier n'est pas une photo.");
      return;
    }
    setStatus("compress");
    setAiState({ kind: "none" });
    setCutoutNote(null);
    setSource(null);
    setCutoutBlob(null);
    setUseCutout(false);
    setPreview((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return null;
    });
    try {
      const result = await cutout.run(file);
      if (!result) return;
      const removed = result.removed && !result.skipped;
      setSource(result.source);
      setCutoutBlob(removed ? result.display : null);
      setUseCutout(removed);
      setCutoutNote(
        result.skipped
          ? null
          : result.removed
            ? null
            : "Le détourage n'a pas abouti. La photo d'origine est conservée.",
      );
      showPhoto(removed ? result.display : result.source);
      await runAnalysis(removed ? result.display : result.source);
    } catch (e) {
      setStatus("idle");
      toast.error((e as Error).message);
    }
  }

  function toggleCutout() {
    if (!source || !cutoutBlob) return;
    const next = !useCutout;
    setUseCutout(next);
    showPhoto(next ? cutoutBlob : source);
  }

  async function runAnalysis(b: Blob) {
    setStatus("analyse");
    try {
      const small = await compressImage(b, 900, 0.8);
      await ensureAccessCookie();
      const r = await analyze({ data: { image: await blobToDataUrl(small) } });
      if (!r.ok) {
        setAiState({ kind: "error", message: r.message });
      } else if (!r.data.isGarment) {
        setAiState({
          kind: "error",
          message:
            "Aucun vêtement clairement reconnu sur la photo. Remplissez la fiche vous-même ou reprenez la photo.",
        });
      } else {
        const d = r.data;
        setFields((f) => ({
          ...f,
          name: d.name || f.name,
          category: CATEGORIES.some((c) => c.value === d.category)
            ? (d.category as Category)
            : f.category,
          colors: d.colors.filter((c) => COLORS.some((x) => x.value === c)).slice(0, 3),
          pattern: PATTERNS.includes(d.pattern) ? d.pattern : "uni",
          style: STYLES.some((s) => s.value === d.style) ? (d.style as StyleTag) : f.style,
          seasons: d.seasons.filter((s) => SEASONS.some((x) => x.value === s)) as Season[],
        }));
        setAiState({ kind: "ok", confidence: d.confidence });
      }
    } catch {
      setAiState({
        kind: "error",
        message:
          "Analyse impossible pour le moment (connexion ?). La saisie manuelle reste disponible.",
      });
    }
    setStatus("ready");
  }

  async function onSave() {
    if (!chosen || !source) return;
    if (!fields.name.trim()) {
      toast.error("Donnez un nom à la pièce.");
      return;
    }
    setStatus("saving");
    try {
      const id = uid();
      await save.mutateAsync({
        ...fields,
        name: fields.name.trim(),
        id,
        mode,
        image: chosen,
        ...(useCutout && cutoutBlob ? { sourceImage: source, backgroundRemoved: true } : {}),
        available: true,
        favorite: false,
        createdAt: Date.now(),
      });
      toast.success(
        mode === "demo" ? "Pièce ajoutée à la démonstration" : "Pièce ajoutée à Mon dressing",
      );
      navigate({ to: "/piece/$id", params: { id } });
    } catch (e) {
      setStatus("ready");
      toast.error(`Enregistrement impossible : ${(e as Error).message}`);
    }
  }

  function reset() {
    cutout.skip();
    setSource(null);
    setCutoutBlob(null);
    setUseCutout(false);
    setCutoutNote(null);
    setPreview((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return null;
    });
    setFields(emptyFields);
    setAiState({ kind: "none" });
    setStatus("idle");
  }

  return (
    <Page>
      <PageHeader
        back
        eyebrow={mode === "demo" ? "Ajout à la démonstration" : "Nouvelle pièce"}
        title="Ajouter"
      />
      {auth.ready && !auth.user && (
        <p className="mb-4 text-sm text-muted-foreground">
          {auth.configured
            ? "Pour l'analyse automatique, connectez-vous dans Réglages. Sans compte, la fiche se remplit à la main."
            : "L'analyse automatique n'est pas encore activée. Vous pourrez remplir la fiche vous-même."}
        </p>
      )}
      <input
        ref={camRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={galRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {!preview && status !== "compress" && cutout.phase !== "working" && (
        <div className="add-choices">
          <button
            type="button"
            onClick={() => camRef.current?.click()}
            className="add-choice press"
          >
            <Camera className="size-7 shrink-0" strokeWidth={1.75} />
            <span className="font-display min-w-[7.5rem]">Prendre une photo</span>
            <span className="ml-auto max-w-[9.5rem] text-right text-[13px] font-normal leading-4 text-muted-foreground">
              À plat ou sur cintre, fond uni, bonne lumière
            </span>
          </button>
          <button
            type="button"
            onClick={() => galRef.current?.click()}
            className="add-choice press"
          >
            <ImageIcon className="size-7 shrink-0" strokeWidth={1.75} />
            <span className="font-display min-w-[7.5rem]">Choisir dans la galerie</span>
            <span className="ml-auto max-w-[9.5rem] text-right text-[13px] font-normal leading-4 text-muted-foreground">
              Une pièce par photo
            </span>
          </button>
          <div className="border-t border-border px-4 py-3">
            <LocalNotice />
          </div>
        </div>
      )}

      {!preview && (status === "compress" || cutout.phase === "working") && (
        <BusyStatus
          label={cutout.phase === "working" ? cutout.label : "Préparation de la photo…"}
          action={
            <Button type="button" variant="outline" className="min-h-11" onClick={cutout.skip}>
              Ignorer le détourage
            </Button>
          }
        />
      )}

      {preview && (
        <div className="grid gap-8 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div>
            <div className="aspect-[4/5] overflow-hidden rounded-3xl bg-photo">
              <img
                src={preview}
                alt="Aperçu de la pièce"
                className="h-full w-full object-contain"
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {useCutout
                ? "Fond retiré sur cet appareil, sans crédit d'analyse. La photo d'origine reste disponible."
                : "Photo d'origine. Le détourage se fait sur cet appareil, la première fois après un court téléchargement."}
            </p>
            {cutoutNote && <p className="mt-2 text-sm text-muted-foreground">{cutoutNote}</p>}
            <div className="mt-2 flex flex-wrap gap-2">
              {cutoutBlob && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-11"
                  onClick={toggleCutout}
                >
                  {useCutout ? "Photo d'origine" : "Photo détourée"}
                </Button>
              )}
              <Button variant="ghost" size="sm" className="min-h-11" onClick={reset}>
                <RotateCcw /> Changer de photo
              </Button>
            </div>
          </div>
          <div>
            {status === "analyse" && <BusyStatus label="Analyse de la photo par l'IA…" />}
            {aiState.kind === "ok" && (
              <div className="mb-6 flex gap-3 rounded-2xl bg-accent p-4 text-sm text-accent-foreground">
                <Sparkles className="mt-0.5 size-4 shrink-0" />
                <p>
                  Suggestions de l'IA (confiance {aiState.confidence}). Vérifiez et corrigez avant
                  d'enregistrer. Taille et matière ne sont jamais déduites de la photo.
                </p>
              </div>
            )}
            {aiState.kind === "error" && (
              <div className="mb-6 rounded-2xl border border-border bg-card p-4 text-sm">
                <p className="font-medium">Analyse automatique indisponible</p>
                <p className="mt-1 text-muted-foreground">
                  {aiState.message} Remplissez la fiche ci-dessous, c'est rapide.
                </p>
                {chosen && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => runAnalysis(chosen)}
                  >
                    Réessayer l'analyse
                  </Button>
                )}
              </div>
            )}
            {status !== "analyse" && (
              <>
                <GarmentForm value={fields} onChange={setFields} collapsibleDetails />
                <Button
                  size="lg"
                  className="mt-8 w-full"
                  disabled={status === "saving"}
                  onClick={onSave}
                >
                  {status === "saving" && <Loader2 className="animate-spin" />}{" "}
                  {mode === "demo"
                    ? "Enregistrer dans la démonstration"
                    : "Enregistrer dans Mon dressing"}
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </Page>
  );
}
