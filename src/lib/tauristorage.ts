import { createJSONStorage } from "zustand/middleware"

const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window

let tauriStore: any = null
let cache: Record<string, string> = {}

async function initTauriStore() {
  if (!tauriStore) {
    const { load } = await import("@tauri-apps/plugin-store")
    tauriStore = await load(".config.dat")

    const entries = await tauriStore.entries()
    cache = Object.fromEntries(entries.map(([k, v]: any) => [k, v]))
  }
}

if (isTauri) initTauriStore()

type SyncStorage = {
  getItem: (name: string) => string | null
  setItem: (name: string, value: string) => void
  removeItem: (name: string) => void
}

const tauriStorage: SyncStorage = {
  getItem: (name) => cache[name] ?? null,

  setItem: (name, value) => {
    cache[name] = value

    initTauriStore().then(async () => {
      await tauriStore.set(name, value)
      await tauriStore.save()
    })
  },

  removeItem: (name) => {
    delete cache[name]

    initTauriStore().then(async () => {
      await tauriStore.delete(name)
      await tauriStore.save()
    })
  },
}

export const appStorage: SyncStorage =
  isTauri ? tauriStorage : localStorage

export const zustandStorage = createJSONStorage(() => appStorage)