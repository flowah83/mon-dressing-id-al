import { useRef } from "react";
import { useRouterState } from "@tanstack/react-router";

export const TAB_PATHS = ["/", "/composer", "/ajouter", "/conseiller", "/favoris"] as const;
export type TabPath = (typeof TAB_PATHS)[number];

const tabScroll = new Map<string, number>();

export function isTabPath(pathname: string): pathname is TabPath {
  return (TAB_PATHS as readonly string[]).includes(pathname);
}

/** Passage d'un onglet du bas à un autre. Ce n'est pas une navigation « poussée ». */
export function isTabSwitch(from: string, to: string): boolean {
  return from !== to && isTabPath(from) && isTabPath(to);
}

/**
 * Les view transitions attendaient `router.navigate` avant de peindre.
 * Sur iPhone, l'écran restait figé plusieurs secondes. On ne les lance plus.
 */
export function shouldUseViewTransition(from: string, to: string, reducedMotion: boolean): boolean {
  if (reducedMotion || from === to) return false;
  if (isTabSwitch(from, to)) return false;
  return false;
}

export function rememberTabScroll(pathname: string) {
  if (!isTabPath(pathname) || typeof window === "undefined") return;
  tabScroll.set(pathname, window.scrollY);
}

export function tabScrollFor(pathname: string): number {
  return tabScroll.get(pathname) ?? 0;
}

const HIDDEN_SEARCH = { hidden: true } as const;

/** Dernier `?piece=` vu tant que l'onglet est gardé monté, sans exiger que la route soit active. */
export function useRetainedPiece(path: TabPath): string {
  const search = useRouterState({
    select: (state) => (state.location.pathname === path ? state.location.search : HIDDEN_SEARCH),
  });
  const ref = useRef("");
  if (search !== HIDDEN_SEARCH) {
    const piece = (search as { piece?: unknown }).piece;
    ref.current = typeof piece === "string" ? piece : "";
  }
  return ref.current;
}
