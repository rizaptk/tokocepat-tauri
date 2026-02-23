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

let db: any = null;
let isInitialized = false;

export const getDb = () => {
  if (!isInitialized || !db) {
    throw new Error("Database not initialized. Call initializeDatabase first.");
  }
  return db;
};

export const initializeDatabase = async () => {
  if (isInitialized) return;

  try {
    await initializeFirestoreSQLite(DB_NAME);
    db = getFirestore();
    isInitialized = true;
    console.log("Database initialized.");

    const storedVersion = localStorage.getItem(DB_VERSION_KEY);
    if (storedVersion !== CURRENT_DB_VERSION) {
      console.log('Database version mismatch or not set. Seeding data...');
      const productsCollectionRef = collection(db, 'products');
      const existingDocs = await getDocs(productsCollectionRef);

      if (existingDocs.docs.length === 0) {
        console.log('No existing products found. Seeding initial products...');
        const seedPromises = initialProducts.map((product: any) => {
          const productRef = doc(db, 'products', product.id);
          return setDoc(productRef, product);
        });
        await Promise.all(seedPromises);
        console.log('Seeding complete.');
      } else {
        console.log('Products already exist, skipping seed.');
      }
      
      localStorage.setItem(DB_VERSION_KEY, CURRENT_DB_VERSION);
    } else {
      console.log("Database version is up to date.");
    }
  } catch (error) {
    console.error('Failed to initialize or seed database:', error);
    // In a real app, you might want to handle this more gracefully
    throw error;
  }
};
