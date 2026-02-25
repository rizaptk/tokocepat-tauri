
"use client";

import { StoreConfig } from '@/lib/types';
import { useDbStore } from '@/lib/db-store';

type StoreConfigData = Partial<Omit<StoreConfig, 'id'>>;

export const updateStoreConfig = async (data: StoreConfigData): Promise<void> => {
    const { db, firesqlite } = useDbStore.getState();
    if (!db || !firesqlite) throw new Error("Database not initialized");

    const { doc, updateDoc } = firesqlite;
    
    const configRef = doc(db, 'store_config', 'main');
    await updateDoc(configRef, data);
};
