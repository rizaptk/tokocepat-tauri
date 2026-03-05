"use client";

import { create } from "zustand";

interface SelectedProduct {
  selectedIds: Set<string>;
  toggleSelected: (id: string) => void;
  clearSelected: () => void;
}

export const useSelectedProduct = create<SelectedProduct>((set, get) => ({
  selectedIds: new Set(),

  toggleSelected: (id) => {
    set((state) => {
      const newSet = new Set(state.selectedIds);

      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }

      return { selectedIds: newSet };
    });
  },

  clearSelected: () => set({ selectedIds: new Set() }),
}));