import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { uid } from "@/lib/db";
import { useMode, useSaveWorn, useWorn } from "@/lib/store";
import { localDateISO, sameDayWear } from "@/lib/wear";

export function WearTodayButton({
  itemIds,
  name,
  outfitId,
}: {
  itemIds: string[];
  name: string;
  outfitId?: string;
}) {
  const { mode } = useMode();
  const { data: worn = [] } = useWorn();
  const save = useSaveWorn();
  const today = localDateISO();
  const already = !!sameDayWear(worn, itemIds, today);
  if (itemIds.length === 0) return null;

  return (
    <Button
      type="button"
      variant={already ? "secondary" : "outline"}
      className="min-h-11 w-full"
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
          .then(() => toast.success("Notée pour aujourd'hui"))
          .catch((error: unknown) =>
            toast.error(error instanceof Error ? error.message : "Enregistrement impossible."),
          );
      }}
    >
      {already ? "Déjà portée aujourd'hui" : "Je la porte aujourd'hui"}
    </Button>
  );
}
