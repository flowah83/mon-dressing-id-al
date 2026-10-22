import { useRouter } from "@tanstack/react-router";
import { useEffect } from "react";

function motionReduced() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

type StartViewTransition = (callback: () => void | Promise<void>) => void;

function starter(): StartViewTransition | null {
  if (motionReduced()) return null;
  const host = document as Document & {
    startViewTransition?: (callback: () => void | Promise<void>) => void;
  };
  if (typeof host.startViewTransition !== "function") return null;
  const start = host.startViewTransition.bind(host);
  return (callback) => {
    start(callback);
  };
}

/** Fondu de page, et repli immédiat si l'API ou le mouvement réduit manquent. */
export function ViewTransitions() {
  const router = useRouter();
  useEffect(() => {
    if (starter()) document.documentElement.classList.add("vt");
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.("a");
      if (!(link instanceof HTMLAnchorElement)) return;
      if (link.target && link.target !== "_self") return;
      if (link.hasAttribute("download")) return;
      const raw = link.getAttribute("href");
      if (!raw || raw.startsWith("#") || raw.startsWith("mailto:") || raw.startsWith("tel:"))
        return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search)
        return;
      const start = starter();
      if (!start) return;
      event.preventDefault();
      event.stopPropagation();
      const next = url.pathname + url.search + url.hash;
      start(async () => {
        await router.navigate({ href: next });
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => resolve());
        });
      });
    };
    document.addEventListener("click", onClick, true);
    const originalBack = history.back.bind(history);
    history.back = () => {
      const start = starter();
      if (!start) {
        originalBack();
        return;
      }
      start(async () => {
        await new Promise<void>((resolve) => {
          let done = false;
          const finish = () => {
            if (done) return;
            done = true;
            window.removeEventListener("popstate", finish);
            resolve();
          };
          window.addEventListener("popstate", finish);
          originalBack();
          window.setTimeout(finish, 320);
        });
      });
    };
    return () => {
      document.removeEventListener("click", onClick, true);
      history.back = originalBack;
    };
  }, [router]);
  return null;
}
