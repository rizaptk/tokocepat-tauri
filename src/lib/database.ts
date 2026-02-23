"use client";

import { initialProducts } from '@/lib/products';

// This module will act as a singleton for the firesqlite instance.
let fsLib: any = null;
let dbInstance: any = null;
let dbInitialized = false;

const DB_NAME = 'tokoc-db';
const DB_VERSION_KEY = 'tokoc_db_version';
const CURRENT_DB_VERSION = '1.0.0';

// Function to dynamically import and initialize the library.
export async function initializeDatabase() {
  if (dbInitialized && fsLib && dbInstance) {
    return { fsLib, dbInstance };
  }

  try {
    // Dynamically import the library only on the client-side.
    const lib = await import('firesqlite');
    await lib.initializeFirestoreSQLite(DB_NAME);
    const db = lib.getFirestore();
    
    fsLib = lib;
    dbInstance = db;
    dbInitialized = true;
    console.log('Database service initialized.');

    const storedVersion = localStorage.getItem(DB_VERSION_KEY);
    if (storedVersion !== CURRENT_DB_VERSION) {
      console.log('Database version mismatch or not found. Seeding data...');
      await seedProducts(lib, db);
      localStorage.setItem(DB_VERSION_KEY, CURRENT_DB_VERSION);
      console.log('Database seeding complete.');
    }
    
    return { fsLib, dbInstance };
  } catch (e) {
    console.error("Error initializing database:", e);
    // Propagate the error so the UI can know something went wrong.
    throw e;
  }
}

async function seedProducts(lib: any, db: any) {
  const productsCollectionRef = lib.collection(db, 'products');
  
  const existingDocs = await lib.getDocs(productsCollectionRef);
  if (existingDocs.docs.length > 0) {
    console.log('Products collection is not empty, skipping seed.');
    return;
  }

  console.log(`Seeding ${initialProducts.length} products...`);
  const seedPromises = initialProducts.map((product: any) => {
    const productRef = lib.doc(db, 'products', product.id);
    return lib.setDoc(productRef, product);
  });

  await Promise.all(seedPromises);
}

// Export getters that services can use to access the library and db instance.
// These will throw if called before initialization.
export function getDbInstance() {
    if (!dbInstance) {
        throw new Error("Database not initialized. Call initializeDatabase() first.");
    }
    return dbInstance;
}

export function getFsLibrary() {
    if (!fsLib) {
        throw new Error("Database not initialized. Call initializeDatabase() first.");
    }
    return fsLib;
}
