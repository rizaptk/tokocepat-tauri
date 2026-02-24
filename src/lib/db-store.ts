"use client";

import { create } from 'zustand';

// Since firesqlite types are not available until dynamic import, use 'any'
interface DbState {
  isInitialized: boolean;
  db: any | null; // This will hold the Firestore instance from firesqlite
  firesqlite: any | null; // This will hold the entire firesqlite library
  initialize: () => Promise<void>;
}

export const useDbStore = create<DbState>((set, get) => ({
  isInitialized: false,
  db: null,
  firesqlite: null,
  initialize: async () => {
    // Prevent re-initialization
    if (get().isInitialized) return;

    try {
      // Dynamically import the library only on the client
      const firesqlite = await import('firesqlite');
      const wasmUrl = new URL('/wa-sqlite-async.wasm', window.location.origin).href;
      
      await firesqlite.initializeFirestoreSQLite(wasmUrl, 'tokoc-db');
      
      const db = firesqlite.getFirestore();
      
      set({ isInitialized: true, db, firesqlite });
      console.log("Database initialized successfully.");
    } catch (error) {
      console.error("Failed to initialize database:", error);
    }
  },
}));
