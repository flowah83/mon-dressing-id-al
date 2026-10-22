import {
  Activity,
  Suspense,
  lazy,
  useEffect,
  useRef,
  type ComponentType,
  type ReactNode,
} from "react";
import { useRouterState } from "@tanstack/react-router";
import { Dressing } from "@/routes/index";
import { isTabPath, tabScrollFor, type TabPath } from "@/lib/tabs";
import { TabHostContext } from "./tab-host-context";

const Composer = lazy(() => import("@/routes/composer").then((m) => ({ default: m.Composer })));
const Ajouter = lazy(() => import("@/routes/ajouter").then((m) => ({ default: m.Ajouter })));
const Conseiller = lazy(() =>
  import("@/routes/conseiller").then((m) => ({ default: m.Conseiller })),
);
const Favoris = lazy(() => import("@/routes/favoris").then((m) => ({ default: m.Favoris })));

const PANELS: Record<TabPath, ComponentType> = {
  "/": Dressing,
  "/composer": Composer,
  "/ajouter": Ajouter,
  "/conseiller": Conseiller,
  "/favoris": Favoris,
};

function TabFallback() {
  return (
    <main className="mx-auto w-full max-w-5xl px-5 pb-nav md:px-8">
      <div className="pt-safe pb-4">
        <div className="skeleton h-9 w-40 rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="skeleton aspect-[4/5] rounded-2xl" />
        <div className="skeleton aspect-[4/5] rounded-2xl" />
      </div>
    </main>
  );
}

/**
 * Garde les onglets visités montés. Les masquer évite de relire le dressing
 * et de redécoder les photos à chaque aller-retour.
 */
export function TabHost() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const visited = useRef<TabPath[]>(isTabPath(pathname) ? [pathname] : []);
  if (isTabPath(pathname) && !visited.current.includes(pathname)) {
    visited.current = [...visited.current, pathname];
  }
  const prev = useRef(pathname);

  useEffect(() => {
    const from = prev.current;
    if (from === pathname) return;
    prev.current = pathname;
    if (!isTabPath(pathname)) return;
    const y = tabScrollFor(pathname);
    const apply = () => window.scrollTo(0, y);
    apply();
    const frame = requestAnimationFrame(apply);
    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  return (
    <>
      {visited.current.map((path) => {
        const Panel = PANELS[path];
        const visible = pathname === path;
        return (
          <Activity key={path} mode={visible ? "visible" : "hidden"} name={`onglet-${path}`}>
            <div className="tab-panel" data-tab={path} hidden={!visible}>
              <Suspense fallback={<TabFallback />}>
                <Panel />
              </Suspense>
            </div>
          </Activity>
        );
      })}
    </>
  );
}

export function TabHostProvider({ children }: { children: ReactNode }) {
  return <TabHostContext.Provider value={true}>{children}</TabHostContext.Provider>;
}
