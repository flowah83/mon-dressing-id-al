import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { uid } from "@/lib/db";
import { cn } from "@/lib/utils";
import { useMode, useSaveWorn, useWorn } from "@/lib/store";
import { localDateISO, sameDayWear } from "@/lib/wear";

export function WearTodayButton({
  itemIds,
  name,
  outfitId,
  className,
  onNoted,
}: {
  itemIds: string[];
  name: string;
  outfitId?: string;
  className?: string;
  onNoted?: () => void;
}) {
  const { mode } = useMode();
  const { data: worn = [] } = useWorn();
  const save = useSaveWorn();
  const today = localDateISO();
  const already = !!sameDayWear(worn, itemIds, today);
  if (itemIds.length === 0) return null;
  const filled = className?.includes("ios-fill");

  return (
    <Button
      type="button"
      variant={filled ? "default" : already ? "secondary" : "outline"}
      className={cn("min-h-11 w-full", className)}
      disabled={already || save.isPending}
      onClick={() => {
        void save
          .mutateAsync({
            id: uid(),
            mode,
            wornOn: today,
            itemIds,
            name: name.trim() || "Tenue du jour",
            createdAt: Date.now(),
            ...(outfitId ? { outfitId } : {}),
          })
          .then(() => {
            onNoted?.();
            if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
              navigator.vibrate(12);
            }
            if (!onNoted) toast.success("Notée pour aujourd'hui");
          })
          .catch((error: unknown) =>
            toast.error(error instanceof Error ? error.message : "Enregistrement impossible."),
          );
      }}
    >
      {already ? "C'est noté pour aujourd'hui" : "Je la porte"}
    </Button>
  );
}
