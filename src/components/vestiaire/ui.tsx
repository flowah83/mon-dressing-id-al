import { Link, useLocation, useRouter } from "@tanstack/react-router";
import { ChevronLeft, Heart, Layers, Loader2, Plus, Settings, Shirt, Sparkles } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { flattenCatalogue } from "@/lib/catalogue-photo";
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
        <Icon className="size-5" strokeWidth={1.75} />
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
            <Plus className="size-6" strokeWidth={1.75} />
          </span>
          Ajouter
        </Link>
        {item("/conseiller", "Conseiller", Sparkles)}
        {item("/favoris", "Favoris", Heart)}
      </div>
    </nav>
  );
}

export function BackButton({ icon = false }: { icon?: boolean }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) router.history.back();
        else void router.navigate({ to: "/" });
      }}
      className={
        icon
          ? "ios-back press grid size-11 place-items-center"
          : "-ml-2 inline-flex min-h-11 items-center gap-0.5 pr-3 text-sm font-medium"
      }
      aria-label="Retour"
    >
      <ChevronLeft className={icon ? "size-7" : "size-5"} strokeWidth={icon ? 2.25 : 2} />
      {icon ? null : "Retour"}
    </button>
  );
}

/** Écoute le défilement pour replier le grand titre. Aucune barre d'état dessinée. */
export function IosChrome() {
  const { pathname } = useLocation();
  useEffect(() => {
    const root = document.documentElement;
    if (!root.dataset["theme"]?.startsWith("apple")) return;
    const onScroll = () => {
      const p = Math.min(1, Math.max(0, window.scrollY / 48));
      root.style.setProperty("--title-p", p.toFixed(3));
      root.dataset["collapsed"] = p > 0.65 ? "true" : "false";
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [pathname]);
  return null;
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
    <header className="page-header pt-safe pb-4">
      <div className="ios-bar">
        <div className="ios-bar-side">{back ? <BackButton icon /> : null}</div>
        <p className="ios-inline-title">{title}</p>
        <div className="ios-bar-side ios-bar-end">{action}</div>
      </div>
      {back ? (
        <div className="flow-back">
          <BackButton />
        </div>
      ) : null}
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
          <h1 className={compact ? "leading-[1.05]" : "leading-[1.05] md:text-5xl"}>{title}</h1>
        </div>
        <div className="large-action">{action}</div>
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

export function BusyStatus({ label, action }: { label: string; action?: ReactNode }) {
  return (
    <div className="space-y-3">
      <div
        className="flex items-center gap-3 rounded-[var(--radius-card)] bg-card p-5 text-sm shadow-soft"
        role="status"
      >
        <Loader2 className="size-5 shrink-0 animate-spin text-primary" />
        <span>{label}</span>
      </div>
      {action}
    </div>
  );
}

export function SettingsLink() {
  return (
    <Link
      to="/reglages"
      aria-label="Réglages, compte et sauvegarde"
      className="settings-link grid size-11 shrink-0 place-items-center rounded-full border border-border bg-card text-muted-foreground"
    >
      <Settings className="size-[22px]" strokeWidth={1.75} />
    </Link>
  );
}

export function Page({ children }: { children: ReactNode }) {
  return (
    <main className="page-enter mx-auto w-full max-w-5xl px-5 pb-nav md:px-8">{children}</main>
  );
}

const DEMO_NOTE_KEY = "vestiaire-demo-note";

/** Note d'exemple, une seule fois, sur le Dressing. */
export function DemoNote() {
  const { mode } = useMode();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (mode !== "demo") return;
    try {
      setOpen(localStorage.getItem(DEMO_NOTE_KEY) !== "1");
    } catch {
      setOpen(true);
    }
  }, [mode]);
  if (mode !== "demo" || !open) return null;
  return (
    <div className="demo-note" role="note">
      <p>Vous êtes dans l'exemple.</p>
      <button
        type="button"
        className="press"
        onClick={() => {
          try {
            localStorage.setItem(DEMO_NOTE_KEY, "1");
          } catch {
            /* le stockage privé peut refuser l'écriture */
          }
          setOpen(false);
        }}
      >
        Compris
      </button>
    </div>
  );
}

/** Quitter ou effacer l'exemple, depuis Réglages uniquement. */
export function DemoSettingsCard() {
  const { mode } = useMode();
  const demo = useDemoControls();
  const [confirmClear, setConfirmClear] = useState(false);
  if (mode !== "demo") return null;
  return (
    <section className="mt-4 space-y-3 rounded-[var(--radius-card)] bg-card p-6 shadow-soft">
      <h2 className="text-2xl">Exemple</h2>
      <p>Vous parcourez des pièces d'exemple. Votre dressing n'est pas modifié.</p>
      <div className="flex flex-wrap gap-3">
        <button type="button" className="chip press" onClick={() => demo.exit()}>
          Quitter l'exemple
        </button>
        <button type="button" className="chip press" onClick={() => setConfirmClear(true)}>
          Effacer l'exemple
        </button>
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
              Effacer l'exemple
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function scheduleIdle(task: () => void) {
  const host = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  if (typeof host.requestIdleCallback === "function") {
    const id = host.requestIdleCallback(task, { timeout: 500 });
    return () => host.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(task, 48);
  return () => window.clearTimeout(id);
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
  const raw = useImageSrc(g);
  const [shown, setShown] = useState(raw);
  const [mark, setMark] = useState<string | undefined>(undefined);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!raw) {
      setShown(undefined);
      setMark(undefined);
      setReady(false);
      return;
    }
    setShown(raw);
    setReady(false);
    const apple = document.documentElement.dataset["theme"]?.startsWith("apple") ?? false;
    if (!apple) {
      setMark("0");
      return;
    }
    let cancel = false;
    const run = () => {
      void flattenCatalogue(raw).then((url) => {
        if (cancel) return;
        setShown(url);
        setMark(url !== raw ? "1" : "0");
      });
    };
    const cancelIdle = scheduleIdle(run);
    return () => {
      cancel = true;
      cancelIdle();
    };
  }, [raw]);
  return (
    <div className={cn("garment-photo overflow-hidden bg-photo", className)}>
      {shown ? (
        <img
          src={shown}
          alt={g.name}
          width={480}
          height={600}
          decoding="async"
          loading={eager ? "eager" : "lazy"}
          data-flat={mark}
          className={cn("h-full w-full", ready && "is-ready")}
          onLoad={() => setReady(true)}
        />
      ) : (
        <div className="skeleton h-full w-full" />
      )}
    </div>
  );
}

export function Swatch({ color, size = "sm" }: { color: string; size?: "sm" | "md" | "dot" }) {
  const c = colorInfo(color);
  const bg = c?.hex ?? "transparent";
  return (
    <span
      title={c?.label ?? color}
      className={cn(
        "inline-block shrink-0 rounded-full border border-border",
        size === "dot" ? "meta-dot" : size === "sm" ? "size-3.5" : "size-6",
      )}
      style={{ background: bg }}
    />
  );
}

export function GarmentCard({ g }: { g: Garment }) {
  const save = useSaveGarment();
  const [menu, setMenu] = useState(false);
  const [named, setNamed] = useState(false);
  const timer = useRef<number | null>(null);
  const held = useRef(false);
  const clearTimer = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
  };
  return (
    <>
      <Link
        to="/piece/$id"
        params={{ id: g.id }}
        className="press group garment-card block"
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest("button")) return;
          held.current = false;
          setNamed(true);
          clearTimer();
          timer.current = window.setTimeout(() => {
            held.current = true;
            setMenu(true);
          }, 480);
        }}
        onPointerUp={clearTimer}
        onPointerLeave={clearTimer}
        onPointerCancel={clearTimer}
        onFocus={() => setNamed(true)}
        onClick={(e) => {
          if (!held.current) return;
          e.preventDefault();
          held.current = false;
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          setMenu(true);
        }}
      >
        <div
          className="relative"
          style={named ? ({ viewTransitionName: `garment-${g.id}` } as CSSProperties) : undefined}
        >
          <GarmentImage
            g={g}
            className={cn(
              "aspect-[4/5] rounded-2xl transition-shadow group-hover:shadow-lift",
              !g.available && "opacity-50",
            )}
          />
          <button
            type="button"
            className="heart-btn absolute right-1.5 top-1.5 grid size-11 place-items-center"
            aria-label={g.favorite ? "Retirer des favoris" : "Mettre en favori"}
            aria-pressed={g.favorite}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              save.mutate({ ...g, favorite: !g.favorite });
            }}
          >
            <span
              className={cn(
                "heart-face grid size-8 place-items-center rounded-full bg-card/90 text-primary",
                g.favorite && "is-on",
              )}
            >
              <Heart
                className={cn("size-[18px]", g.favorite && "fill-current")}
                strokeWidth={g.favorite ? 0 : 1.75}
              />
            </span>
          </button>
          {!g.available && (
            <span className="absolute left-2 top-2 rounded-full bg-card/90 px-2.5 py-1 text-xs font-medium">
              Au lavage
            </span>
          )}
        </div>
        <div className="mt-2 px-0.5">
          <p className="garment-name truncate text-sm font-medium">{g.name}</p>
          <div className="garment-meta mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            {g.colors[0] ? <Swatch color={g.colors[0]} size="dot" /> : null}
            <span className="truncate">{catLabel(g.category)}</span>
          </div>
        </div>
      </Link>
      {menu ? (
        <PieceMenu
          id={g.id}
          name={g.name}
          favorite={g.favorite}
          available={g.available}
          onClose={() => setMenu(false)}
          onFavorite={() => {
            save.mutate({ ...g, favorite: !g.favorite });
            setMenu(false);
          }}
          onLaundry={() => {
            save.mutate({ ...g, available: !g.available });
            setMenu(false);
          }}
        />
      ) : null}
    </>
  );
}

function PieceMenu({
  id,
  name,
  favorite,
  available,
  onClose,
  onFavorite,
  onLaundry,
}: {
  id: string;
  name: string;
  favorite: boolean;
  available: boolean;
  onClose: () => void;
  onFavorite: () => void;
  onLaundry: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="piece-menu-back" onClick={onClose}>
      <div
        className="piece-menu"
        role="menu"
        aria-label={name}
        onClick={(event) => event.stopPropagation()}
      >
        <p className="piece-menu-title">{name}</p>
        <button type="button" role="menuitem" className="press" onClick={onFavorite}>
          {favorite ? "Retirer des favoris" : "Mettre en favori"}
        </button>
        <button type="button" role="menuitem" className="press" onClick={onLaundry}>
          {available ? "Marquer au lavage" : "Remettre disponible"}
        </button>
        <Link to="/piece/$id" params={{ id }} role="menuitem" className="press" onClick={onClose}>
          Voir la fiche
        </Link>
        <button type="button" role="menuitem" className="press" onClick={onClose}>
          Annuler
        </button>
      </div>
    </div>,
    document.body,
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

const FLAT_LAYOUTS: { x: string; y: string; w: string; r: number }[][] = [
  [{ x: "18%", y: "6%", w: "64%", r: -3 }],
  [
    { x: "4%", y: "8%", w: "50%", r: -8 },
    { x: "46%", y: "14%", w: "48%", r: 6 },
  ],
  [
    { x: "3%", y: "4%", w: "48%", r: -7 },
    { x: "48%", y: "2%", w: "46%", r: 5 },
    { x: "24%", y: "46%", w: "48%", r: -2 },
  ],
  [
    { x: "2%", y: "3%", w: "48%", r: -6 },
    { x: "50%", y: "2%", w: "46%", r: 4 },
    { x: "6%", y: "48%", w: "46%", r: -3 },
    { x: "50%", y: "50%", w: "42%", r: 7 },
  ],
];

export function Collage({
  items,
  className,
  compact,
}: {
  items: Garment[];
  className?: string;
  compact?: boolean;
}) {
  if (!items.length)
    return <div className={cn("flat-lay is-empty", compact && "is-compact", className)} />;
  const shown = items.slice(0, 4);
  const slots = FLAT_LAYOUTS[shown.length - 1] ?? FLAT_LAYOUTS[0]!;
  return (
    <div className={cn("flat-lay", compact && "is-compact", className)}>
      {shown.map((g, index) => {
        const slot = slots[index] ?? slots[0]!;
        const width = g.category === "chaussures" ? `calc(${slot.w} * 0.78)` : slot.w;
        return (
          <div
            key={g.id}
            className="flat-piece"
            style={{
              left: slot.x,
              top: slot.y,
              width,
              transform: `rotate(${slot.r}deg)`,
              zIndex: index + 1,
            }}
          >
            <GarmentImage g={g} eager className="aspect-[3/4] w-full rounded-[14px]" />
          </div>
        );
      })}
    </div>
  );
}

export function OutfitHeading({ pieces }: { pieces: { name: string }[] }) {
  const [lead, ...rest] = pieces;
  if (!lead) return null;
  return (
    <div className="outfit-heading">
      <p className="outfit-lead">{lead.name}</p>
      {rest.length > 0 ? (
        <p className="outfit-with">avec {rest.map((piece) => piece.name).join(", ")}</p>
      ) : null}
    </div>
  );
}

export function CardSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="dressing-grid grid grid-cols-2 gap-x-3 gap-y-5" aria-hidden>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index}>
          <div className="skeleton aspect-[4/5] rounded-[18px]" />
          <div className="skeleton mt-2 h-3.5 w-3/4 rounded-full" />
          <div className="skeleton mt-1.5 h-2.5 w-1/2 rounded-full" />
        </div>
      ))}
    </div>
  );
}

function EmptyMark() {
  return (
    <svg
      className="mx-auto mb-4 text-foreground"
      width="72"
      height="72"
      viewBox="0 0 72 72"
      aria-hidden
    >
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
