import { create } from 'zustand';
// We import our new bridge as 'firesqliteBridge' 
// to keep the naming consistent with your existing services.
import * as firesqliteBridge from '@/lib/tauri';
import { FireLite } from '@/lib/tauri';

interface DbState {
  isInitialized: boolean;
  db: FireLite | null;           // Holds the firelite instance
  firesqlite: typeof firesqliteBridge | null;   // Holds the API namespace (doc, collection, etc.)
  initialize: () => Promise<void>;
}

export const useDbStore = create<DbState>((set) => ({
  isInitialized: false,
  db: null,
  firesqlite: null,
  
  initialize: async () => {

    try {
      /**
       * In the new architecture:
       * 1. The Rust side (FireLite) is initialized in your lib.rs setup block.
       * 2. The JS side (tauri.ts bridge) communicates via 'invoke'.
       * 3. We just need to populate the store so your services find the expected objects.
       */
      
      const db = firesqliteBridge.getFirestore();

      set({ 
        isInitialized: true, 
        db, 
        firesqlite: firesqliteBridge 
      });

      console.log("[DbStore] FireLite Native Bridge Initialized successfully.");
    } catch (error) {
      console.error("[DbStore] Failed to initialize FireLite bridge:", error);
    }
  },
}));