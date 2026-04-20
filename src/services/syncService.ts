// src/services/syncService.ts
import { listen } from "@tauri-apps/api/event";
import { useSyncStore } from "@/lib/sync-store";
import { useDbStore } from "@/lib/db-store";
import { CustomAccessType } from "@/lib/types";

export const initializeSyncService = async () => {
    const store = useSyncStore.getState();

    // Just setup listeners to know if Rust actually started/stopped
    const unlistenOn = await listen("sync_on", () => store.setIsNetworkEnable(true));
    const unlistenOff = await listen("sync_off", () => store.setIsNetworkEnable(false));

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

export const SaveAccess = async (hwid: string, access: Partial<CustomAccessType>) => {
    const {db, firesqlite} = useDbStore.getState();
    if (!db || !firesqlite) throw new Error("Database not initialized");
    const {doc, setDoc} = firesqlite;
    await setDoc(doc(db,'__firelite_access', hwid), access, {merge: true});
}