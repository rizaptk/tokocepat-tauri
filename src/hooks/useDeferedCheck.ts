import { useSelectedProduct } from "@/lib/product-select-store";
import { useCallback } from "react";

export function useSelectedChecked(id: string) {
  const checked = useSelectedProduct(useCallback((state) => state.selectedIds.has(id), [id]));
  const toggleSelected = useSelectedProduct((state) => state.toggleSelected);

  const toggleChecked = useCallback(() => toggleSelected(id), [id, toggleSelected]);

  return [checked, toggleChecked] as const;
}