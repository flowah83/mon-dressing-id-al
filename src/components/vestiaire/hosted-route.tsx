import type { ReactNode } from "react";
import { useContext } from "react";
import { TabHostContext } from "./tab-host-context";

/** La route ne peint pas l'onglet une seconde fois : l'hôte le garde déjà monté. */
export function HostedRoute({ children }: { children: ReactNode }) {
  const hosted = useContext(TabHostContext);
  if (hosted) return null;
  return children;
}
