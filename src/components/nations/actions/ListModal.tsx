// src/components/nations/actions/ListModal.tsx
import { TacticalCTA, TacticalModal } from "@/components/ui/TacticalModal";

export function ListModal({
  showListModal,
  setShowListModal,
  listPrice,
  setListPrice,
  listing,
  handleListForSale,
}: {
  showListModal: boolean;
  setShowListModal: (v: boolean) => void;
  listPrice: string;
  setListPrice: (v: string) => void;
  listing: boolean;
  handleListForSale: () => Promise<void>;
}) {
  return (
    <TacticalModal
      open={showListModal}
      onClose={() => setShowListModal(false)}
      title="List Nation for Sale"
      subtitle={"Price in tokens (0.5 – 10 000). Selling marks you as Traitor."}
      badge="Market listing"
      tone="amber"
      layer="base"
      align="center"
    >
            <input
              type="number"
              value={listPrice}
              onChange={(e) => setListPrice(e.target.value)}
              min="0.5"
              max="10000"
              step="0.1"
              aria-label="Listing price in tokens"
              className="mt-4 w-full rounded-xl border border-border bg-secondary min-h-11 px-4 py-3 text-foreground focus:border-neon-cyan/50 focus:outline-none"
            />
            <div className="mt-4 flex gap-2">
              <TacticalCTA
                variant="ghost"
                buzz="light"
                className="flex-1 text-xs"
                onClick={() => setShowListModal(false)}
              >
                Cancel
              </TacticalCTA>
              <TacticalCTA
                variant="amber"
                className="flex-1 text-xs"
                onClick={handleListForSale}
                disabled={listing}
              >
                {listing ? "Listing..." : "List"}
              </TacticalCTA>
            </div>
    </TacticalModal>
  );
}
