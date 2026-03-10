import { createJSONStorage, StateStorage } from "zustand/middleware"

const isTauri =
  typeof window !== "undefined" && "__TAURI__" in window

let tauriStore: any = null

const initTauriStore = async () => {
  if (!tauriStore) {
    const { load } = await import("@tauri-apps/plugin-store")
    tauriStore = await load(".config.dat")
  }
  return tauriStore
}

const tauriStorage: StateStorage = {
  getItem: async (name: string) => {
    const store = await initTauriStore()
    const value = await store.get(name)
    return value ? JSON.stringify(value) : null
  },

  setItem: async (name: string, value: string) => {
    const store = await initTauriStore()
    await store.set(name, JSON.parse(value))
    await store.save()
  },

  removeItem: async (name: string) => {
    const store = await initTauriStore()
    await store.delete(name)
    await store.save()
  },
}

export const zustandStorage = createJSONStorage(() =>
  isTauri ? tauriStorage : localStorage
)

export const appStorage = isTauri ? tauriStorage : localStorage;