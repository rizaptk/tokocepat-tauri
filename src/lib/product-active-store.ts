"use client";

import { create } from "zustand";

type NavigationSource = 'keyboard' | 'mouse' | 'none';

interface ActiveProduct {
    activeIndex: number | null;
    activeId: string | null;
    navigationSource: NavigationSource;
    searchFocued: boolean;
    setSearchFocued: (focused: boolean) => void;
    setActive: (index: number | null, id: string | null, source: NavigationSource) => void;
    clearActive: () => void;
    clearNavigationSource: () => void;
}

export const useActiveProduct = create<ActiveProduct>((set) => ({
    activeIndex: null,
    activeId: null,
    navigationSource: 'none',
    searchFocued: false,
    setSearchFocued: (focused) => set({ searchFocued: focused }),
    setActive: (index, id, source) => set({ activeIndex: index, activeId: id, navigationSource: source }),
    clearActive: () => set({ activeIndex: null, activeId: null, navigationSource: 'none' }),
    clearNavigationSource: () => set({ navigationSource: 'none' }),
}));
