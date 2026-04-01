import { create } from 'zustand';

interface RefreshState {
    reloadPrinter: boolean;
    setReloadPrinter: (reload: boolean) => void;
}

export const useRefreshStore = create<RefreshState>((set) => ({
    reloadPrinter: true,
    setReloadPrinter: (reload) => set({ reloadPrinter: reload }),
}));