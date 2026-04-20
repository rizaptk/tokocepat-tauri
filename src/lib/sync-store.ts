import { create } from "zustand"
import { persist } from "zustand/middleware"
import { invoke } from "@tauri-apps/api/core"

interface SyncState {
    isSyncEnabled: boolean
    licenseDetails: string | null
    setIsSyncEnabled: (enable: boolean) => void
    isOnline: boolean
    setIsOnline: (online: boolean) => void
    isNetworkEnable: boolean
    setIsNetworkEnable: (enable: boolean) => void 
    toggleSync: (val: boolean) => Promise<void>;
}

export const useSyncStore = create<SyncState>()(
    persist(
        (set) => ({
            isSyncEnabled: false,
            licenseDetails: null,
            isOnline: false,
            setIsOnline: (online) => set({ isOnline: online }),
            setIsSyncEnabled: (enable) => set({ isSyncEnabled: enable }),
            toggleSync: async (val: boolean) => {
                try {
                    // Centralized invoke matching the Rust 'enabled' key
                    await invoke('toggle_net_sync', { enabled: val, port: 8055 });
                    set({ isNetworkEnable: val });
                } catch (e) {
                    throw e; // Let the component handle the toast
                }
            },
            isNetworkEnable: false,
            setIsNetworkEnable: (enable) => set({ isNetworkEnable: enable }),
        }),
        { name: "tokoc-sync-settings", partialize: (state) => ({ isNetworkEnable: state.isNetworkEnable, isSyncEnabled: state.isSyncEnabled}) }
    )
)