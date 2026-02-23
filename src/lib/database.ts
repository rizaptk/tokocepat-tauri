
"use client";

import {
  initializeFirestoreSQLite,
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
} from 'firesqlite';
import { initialProducts } from '@/lib/products';

const DB_NAME = 'tokoc-db';
const DB_VERSION_KEY = 'tokoc_db_version';
const CURRENT_DB_VERSION = '1.0.0';

let dbInitialized = false;

// This function should be called once when the app mounts.
export async function initializeDatabase() {
    if (dbInitialized) {
        return;
    }
    
    try {
        await initializeFirestoreSQLite(DB_NAME);
        dbInitialized = true;
        console.log('Database service initialized.');

        const db = getFirestore();
        const storedVersion = localStorage.getItem(DB_VERSION_KEY);

        if (storedVersion !== CURRENT_DB_VERSION) {
            console.log('Database version mismatch or not found. Seeding data...');
            await seedProducts(db);
            localStorage.setItem(DB_VERSION_KEY, CURRENT_DB_VERSION);
            console.log('Database seeding complete.');
        }
    } catch (e) {
        console.error("Error initializing database:", e);
    }
}

async function seedProducts(db: any) {
    if (!db) return;

    const productsCollectionRef = collection(db, 'products');
    
    const existingDocs = await getDocs(productsCollectionRef);
    if (existingDocs.docs.length > 0) {
        console.log('Products collection is not empty, skipping seed.');
        return;
    }

    console.log(`Seeding ${initialProducts.length} products...`);
    const seedPromises = initialProducts.map(product => {
        const productRef = doc(db, 'products', product.id);
        return setDoc(productRef, product);
    });

    await Promise.all(seedPromises);
}
