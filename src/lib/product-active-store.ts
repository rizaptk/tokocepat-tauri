"use client";

import { create } from "zustand";

interface ActiveProduct {
    activeIndex: number|null;
    activeId: string|null;
    searchFocued: boolean;
    setSearchFocued: (focused: boolean) => void;
    setActiveIndex: (id: number|null) => void;
    setActiveId: (id: string|null) => void;
}

export const useActiveProduct = create<ActiveProduct>((set) => ({
    activeIndex: null,
    activeId: null,
    searchFocued: false,
    setSearchFocued: (focused) => set({ searchFocued: focused }),
    setActiveIndex: (index) => set({ activeIndex: index }),
    setActiveId: (id) => set({ activeId: id })
}));