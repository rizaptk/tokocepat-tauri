"use client";

import { create } from "zustand";

interface ActiveProduct {
    activeIndex: number|null;
    activeId: string|null;
    setActiveIndex: (id: number|null) => void;
    setActiveId: (id: string|null) => void;
}

export const useActiveProduct = create<ActiveProduct>((set) => ({
    activeIndex: null,
    activeId: null,
    setActiveIndex: (index) => set({ activeIndex: index }),
    setActiveId: (id) => set({ activeId: id })
}));