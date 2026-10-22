import { useCallback, useRef, useState } from "react";
import { prepareGarmentPhoto, type PhotoPrep } from "@/lib/cutout";

/** Runs on-device background removal and lets the user skip it. */
export function usePhotoCutout() {
  const [phase, setPhase] = useState<"idle" | "working">("idle");
  const [label, setLabel] = useState("Détourage en cours…");
  const abortRef = useRef<AbortController | null>(null);
  const token = useRef(0);

  const skip = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const run = useCallback(async (file: Blob): Promise<PhotoPrep | null> => {
    const id = ++token.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setPhase("working");
    setLabel("Préparation de la photo…");
    try {
      const result = await prepareGarmentPhoto(file, {
        signal: controller.signal,
        onProgress: (next) => {
          if (token.current === id) setLabel(next);
        },
      });
      if (token.current !== id) return null;
      return result;
    } finally {
      if (token.current === id) setPhase("idle");
    }
  }, []);

  return { phase, label, run, skip };
}
