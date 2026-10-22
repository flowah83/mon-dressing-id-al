import { Link, useLocation, useRouter } from "@tanstack/react-router";
import { ChevronLeft, Heart, Layers, Plus, Settings2, Shirt, Sparkles } from "lucide-react";
import { useState, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/account";
import { cn } from "@/lib/utils";
import { useDemoControls, useImageSrc, useMode, useSaveGarment } from "@/lib/store";
import { COLORS, catLabel, colorInfo, type Garment } from "@/lib/wardrobe";

export function BottomNav() {
  const { pathname } = useLocation();
  const item = (
    to: "/" | "/conseiller" | "/favoris" | "/composer",
    label: string,
    Icon: typeof Shirt,
  ) => {
    const active =
      to === "/" ? pathname === "/" || pathname.startsWith("/piece") : pathname.startsWith(to);
    return (
      <Link
        to={to}
        data-active={active ? "true" : "false"}
        className={cn(
          "tab-link press flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium",
          active ? "text-primary" : "text-muted-foreground",
        )}
      >
        <Icon className="size-5" strokeWidth={active ? 2.2 : 1.6} />
        {label}
      </Link>
    );
  };
  return (
    <nav
      aria-label="Navigation principale"
      className="tabbar fixed inset-x-0 bottom-0 z-40 border-t border-border backdrop-blur pb-safe md:inset-x-auto md:left-1/2 md:bottom-5 md:w-[36rem] md:-translate-x-1/2 md:rounded-full md:border md:pb-0 md:shadow-lift"
    >
      <div className="mx-auto flex max-w-lg items-end px-1">
        {item("/", "Dressing", Shirt)}
        {item("/composer", "Composer", Layers)}
        <Link
          to="/ajouter"
          aria-label="Ajouter une pièce"
          data-active={pathname.startsWith("/ajouter") ? "true" : "false"}
          className={cn(
            "tab-link press flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 pb-1 text-xs font-medium",
            pathname.startsWith("/ajouter") ? "text-primary" : "text-muted-foreground",
          )}
        >
          <span className="tab-plus -mt-5 grid size-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-lift md:mt-0">
            <Plus className="size-6" />
          </span>
          Ajouter
        </Link>
        {item("/conseiller", "Conseiller", Sparkles)}
        {item("/favoris", "Favoris", Heart)}
      </div>
    </nav>
  );
}

export function BackButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) router.history.back();
        else void router.navigate({ to: "/" });
      }}
      className="-ml-2 inline-flex min-h-11 items-center gap-0.5 pr-3 text-sm font-medium"
    >
      <ChevronLeft className="size-5" />
      Retour
    </button>
  );
}

export function PageHeader({
  eyebrow,
  title,
  action,
  back,
  compact,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
  back?: boolean;
  compact?: boolean;
}) {
  return (
    <header className="pt-safe pb-4">
      {back && <BackButton />}
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
          <h1 className={compact ? "leading-[1.05]" : "leading-[1.05] md:text-5xl"}>
            {title}
          </h1>
        </div>
        {action}
      </div>
    </header>
  );
}

export function HistoryLink() {
  return (
    <Link
      to="/historique"
      className="inline-flex min-h-11 items-center px-1 text-[17px] font-normal text-primary"
    >
      Historique
    </Link>
  );
}

export function SettingsLink() {
  return (
    <Link
      to="/reglages"
      aria-label="Réglages, compte et sauvegarde"
      className="grid size-11 shrink-0 place-items-center rounded-full border border-border bg-card text-muted-foreground"
    >
      <Settings2 className="size-5" />
    </Link>
  );
}

export function Page({ children }: { children: ReactNode }) {
  return <main className="page-enter mx-auto w-full max-w-5xl px-5 pb-nav md:px-8">{children}</main>;
}

export function DemoBanner() {
  const { mode } = useMode();
  const demo = useDemoControls();
  const [confirmClear, setConfirmClear] = useState(false);
  if (mode !== "demo") return null;
  return (
    <div className="sticky top-0 z-30 bg-demo text-demo-foreground">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-1 text-sm md:px-8">
        <span className="font-semibold">Exemple · pas vos vêtements</span>
        <span className="flex shrink-0">
          <button
            type="button"
            className="press min-h-11 px-2 underline underline-offset-4"
            onClick={() => demo.exit()}
          >
            Quitter
          </button>
          <button
            type="button"
            className="press min-h-11 px-2 underline underline-offset-4"
            onClick={() => setConfirmClear(true)}
          >
            Effacer
          </button>
        </span>
      </div>
      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-3xl font-medium">
              Effacer la démonstration ?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base text-foreground">
              Les pièces d'exemple seront supprimées de cet appareil. Mon dressing, vos photos et
              vos tenues ne sont pas touchés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="min-h-11 bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void demo.clear()}
            >
              Effacer la démo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function GarmentImage({
  g,
  className,
  eager,
}: {
  g: Pick<Garment, "image" | "imageUrl" | "name">;
  className?: string;
  eager?: boolean;
}) {
  const src = useImageSrc(g);
  return (
    <div className={cn("garment-photo overflow-hidden bg-photo", className)}>
      {src ? (
        <img
          src={src}
          alt={g.name}
          loading={eager ? "eager" : "lazy"}
          className="h-full w-full"
        />
      ) : (
        <div className="h-full w-full animate-pulse bg-muted" />
      )}
    </div>
  );
}

export function Swatch({ color, size = "sm" }: { color: string; size?: "sm" | "md" }) {
  const c = colorInfo(color);
  const bg = c?.hex ?? "transparent";
  return (
    <span
      title={c?.label ?? color}
      className={cn(
        "inline-block shrink-0 rounded-full border border-border",
        size === "sm" ? "size-3.5" : "size-6",
      )}
      style={{ background: bg }}
    />
  );
}

export function GarmentCard({ g }: { g: Garment }) {
  const save = useSaveGarment();
  return (
    <Link to="/piece/$id" params={{ id: g.id }} className="press group block">
      <div className="relative">
        <GarmentImage
          g={g}
          className={cn(
            "aspect-[4/5] rounded-2xl transition-shadow group-hover:shadow-lift",
            !g.available && "opacity-50",
          )}
        />
        <button
          type="button"
          className="absolute right-0 top-0 grid size-11 place-items-center"
          aria-label={g.favorite ? "Retirer des favoris" : "Mettre en favori"}
          aria-pressed={g.favorite}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            save.mutate({ ...g, favorite: !g.favorite });
          }}
        >
          <span className="grid size-8 place-items-center rounded-full bg-card/90 text-primary">
            <Heart className={cn("size-4", g.favorite && "fill-current")} />
          </span>
        </button>
        {!g.available && (
          <span className="absolute left-2 top-2 rounded-full bg-card/90 px-2.5 py-1 text-xs font-medium">
            Au lavage
          </span>
        )}
      </div>
      <div className="mt-2 px-0.5">
        <p className="truncate text-sm font-medium">{g.name}</p>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          {g.colors.slice(0, 3).map((c) => (
            <Swatch key={c} color={c} />
          ))}
          <span className="truncate">{catLabel(g.category)}</span>
        </div>
      </div>
    </Link>
  );
}

export function ColorPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {COLORS.map((c) => {
        const on = value.includes(c.value);
        return (
          <button
            type="button"
            key={c.value}
            data-active={on}
            className="chip !px-3"
            onClick={() => onChange(on ? value.filter((x) => x !== c.value) : [...value, c.value])}
          >
            <Swatch color={c.value} />
            {c.label}
          </button>
        );
      })}
    </div>
  );
}

export function Collage({ items, className }: { items: Garment[]; className?: string }) {
  if (!items.length) return <div className={cn("aspect-square rounded-2xl bg-muted", className)} />;
  const [first, ...rest] = items;
  return (
    <div
      className={cn(
        "outfit-reveal grid aspect-square grid-cols-2 gap-1.5 rounded-2xl bg-photo p-1.5",
        className,
      )}
    >
      <GarmentImage
        g={first!}
        className={cn("rounded-xl", rest.length ? "row-span-2" : "col-span-2 row-span-2")}
      />
      {rest.length > 0 && (
        <div
          className={cn("grid gap-1.5", rest.length > 2 ? "grid-cols-2" : "grid-cols-1")}
          style={{ gridRow: "span 2" }}
        >
          {rest.slice(0, 4).map((g) => (
            <GarmentImage key={g.id} g={g} className="min-h-0 rounded-xl" />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyMark() {
  return (
    <svg className="mx-auto mb-4 text-foreground" width="72" height="72" viewBox="0 0 72 72" aria-hidden>
      <circle cx="36" cy="36" r="34" fill="var(--photo)" />
      <path
        d="M36 16c4.5 0 7 3.2 7 6.2 0 2.4-1.6 3.8-3.6 4.1L36 28 18 42h36L36 28"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M26 50h20" stroke="var(--primary)" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function EmptyState({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-border bg-card px-6 py-12 text-center">
      <EmptyMark />
      <h2 className="text-[1.75rem] leading-none">{title}</h2>
      <p className="mx-auto mt-2 max-w-sm text-muted-foreground">{text}</p>
      {children && <div className="mt-6 flex flex-col items-center gap-3">{children}</div>}
    </div>
  );
}

export function LocalNotice() {
  const auth = useAuth();
  if (!auth.ready)
    return <p className="text-xs text-muted-foreground">Enregistré sur cet appareil.</p>;
  if (auth.user)
    return (
      <p className="text-xs text-muted-foreground">
        Copie sur cet appareil, sauvegardée dans votre compte privé.
      </p>
    );
  if (auth.configured) {
    return (
      <p className="text-xs text-muted-foreground">
        Enregistré sur cet appareil.{" "}
        <Link
          to="/compte"
          className="inline-flex min-h-11 items-center underline underline-offset-4"
        >
          Créer un compte
        </Link>{" "}
        pour une copie privée en ligne.
      </p>
    );
  }
  return (
    <p className="text-xs text-muted-foreground">
      Enregistré sur cet appareil uniquement · pensez à exporter une sauvegarde.
    </p>
  );
}

export function SyncLine() {
  const auth = useAuth();
  if (!auth.user) return null;
  if (auth.syncState === "saving")
    return <p className="text-sm text-muted-foreground">Sauvegarde en ligne…</p>;
  if (auth.syncState === "error" && auth.syncMessage)
    return <p className="text-sm text-destructive">{auth.syncMessage}</p>;
  if (auth.syncMessage) return <p className="text-sm text-muted-foreground">{auth.syncMessage}</p>;
  if (auth.lastSyncAt)
    return <p className="text-sm text-muted-foreground">Copie en ligne à jour.</p>;
  return null;
}
