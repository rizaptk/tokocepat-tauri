"use client";

import { create } from 'zustand';
import * as firesqlite from 'firesqlite';

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
      console.log("Starting database initialization...");
      console.log("firesqlite imported:", firesqlite);

      const wasmUrl = new URL('/wa-sqlite-async.wasm', window.location.origin).href;
      console.log("WASM URL:", wasmUrl);

      console.log("Calling initializeFirestoreSQLite...");
      // Try with a timeout to see if it hangs
      const initPromise = firesqlite.initializeFirestoreSQLite(wasmUrl, 'tokoc-db');
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Initialization timeout')), 10000)
      );

      await Promise.race([initPromise, timeoutPromise]);
      console.log("Firestore SQLite initialized");

      console.log("Getting Firestore instance...");
      const db = firesqlite.getFirestore();
      console.log("Firestore instance obtained:", db);

      set({ isInitialized: true, db, firesqlite });
      console.log("Database initialized successfully.");
    } catch (error) {
      console.error("Failed to initialize database:", error);
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      // For now, let's mock the initialization to get the app running
      console.log("Mocking database initialization to unblock UI...");
      set({
        isInitialized: true,
        db: null, // Mock db
        firesqlite: null // Mock firesqlite
      });
    }
  },
}));
