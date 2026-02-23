"use client";

import { initializeFirestoreSQLite, getFirestore, collection, doc, setDoc, getDocs } from 'firesqlite';
import { initialProducts } from '@/lib/products';

const DB_NAME = 'tokoc-db';
const DB_VERSION_KEY = 'tokoc_db_version';
const CURRENT_DB_VERSION = '1.0.0';

let db: any;

async function seedDatabase(db: any) {
  const storedVersion = localStorage.getItem(DB_VERSION_KEY);
  if (storedVersion !== CURRENT_DB_VERSION) {
    console.log('Database version mismatch or not found. Seeding data...');
    const productsCollectionRef = collection(db, 'products');
    const existingDocs = await getDocs(productsCollectionRef);
    if (existingDocs.docs.length === 0) {
      console.log(`Seeding ${initialProducts.length} products...`);
      const seedPromises = initialProducts.map((product: any) => {
        const productRef = doc(db, 'products', product.id);
        return setDoc(productRef, product);
      });
      await Promise.all(seedPromises);
    }
    localStorage.setItem(DB_VERSION_KEY, CURRENT_DB_VERSION);
    console.log('Database seeding complete.');
  }
}

export async function getDb() {
    if (!db) {
        await initializeFirestoreSQLite(DB_NAME);
        db = getFirestore();
        await seedDatabase(db);
    }
    return db;
}
