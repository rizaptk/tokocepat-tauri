
"use client";

import { StoreConfig } from '@/lib/types';
import { useDbStore } from '@/lib/db-store';

type StoreConfigData = Partial<Omit<StoreConfig, 'id'>>;

export const updateStoreConfig = async (data: StoreConfigData): Promise<void> => {
    const { db, firesqlite } = useDbStore.getState();
    if (!db || !firesqlite) throw new Error("Database not initialized");

    // merge-set (not updateDoc) so saving also CREATES store_config/main when
    // it does not exist yet — updateDoc throws on a missing doc.
    const { doc, setDoc } = firesqlite;

    const configRef = doc(db, 'store_config', 'main');
    await setDoc(configRef, data, { merge: true });
};
