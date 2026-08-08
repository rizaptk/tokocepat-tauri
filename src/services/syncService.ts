// src/services/syncService.ts
import { listen } from "@tauri-apps/api/event";
import { useSyncStore } from "@/lib/sync-store";
import { useDbStore } from "@/lib/db-store";

export const initializeSyncService = async () => {
    const store = useSyncStore.getState();

    // Just setup listeners to know if Rust actually started/stopped
    const unlistenOn = await listen("sync_on", () => {
        store.setIsNetworkEnable(true);
        store.setIsSyncEnabled(true);
    });
    const unlistenOff = await listen("sync_off", () => {
        store.setIsNetworkEnable(false);
        store.setIsSyncEnabled(false);
    });

    return () => {
        unlistenOn();
        unlistenOff();
    };
};

export const SyncIden = async (hwid: string, name?: string) => {
    const {db, firesqlite} = useDbStore.getState();
    if (!firesqlite || !db) throw new Error("Database not initialized");
    const {doc, getDoc, setDoc} = firesqlite;
    if (name) {
        await setDoc(doc(db,'__firelite_security',hwid),{name}, {merge: true});
        return {id: hwid, name: name};
    } else {
        const data = await getDoc(doc(db,'__firelite_security', hwid));
        return {
            id: hwid,
            name: data.data()?.name??'Perangkat Baru'
        }
    }
}

export const SetSync = async () => {
    const {db, firesqlite} = useDbStore.getState();
    if (!firesqlite || !db) throw new Error("Database not initialized");

    const {setDoc, doc} = firesqlite;
    await setDoc(doc(db, 'app_state', 'sync_prefs'), {enable: true});
}