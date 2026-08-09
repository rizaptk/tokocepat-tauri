// lib/database.ts

import { Product } from '@/lib/types';
import { initialProducts, initialVariants, initialCategories } from '@/lib/products';

const DB_VERSION_KEY = 'tokoc_db_version';
const CURRENT_DB_VERSION = '1.0.25'; // Trigger one-time re-seed after removing the demo simulation

async function ensureIndexes(firesqlite: any, _db: any) {
    const { createIndex, createCompositeIndex } = firesqlite;
    
    console.log("Ensuring database indexes...");
    try {
        await Promise.all([
            // For transaction history ordering and filtering
            createIndex('transactions', 'created_at'),
            createCompositeIndex('transactions',[{field: 'shift_id', desc: true}, {field: 'created_at', desc: true}]),
            createCompositeIndex('transactions',[{field: 'shift_id', desc: true}, {field: 'status', desc: true}, {field: 'created_at', desc: true}]),
            
            // For stock movement report filtering
            createIndex('stock_movements', 'created_at'),

            // For stock movement report by product ids filtering (getStockMovementsByProducts)
            createCompositeIndex('stock_movements', [{field: 'product_id', desc: true}, {field: 'created_at', desc: true}]),

            // For product category filtering
            createIndex('products', 'category_id'),
            
            // For product search by name
            createIndex('products', 'name'),

            // For variants lookup by product
            createIndex('product_variants', 'product_id'),
        ]);
        console.log("Database indexes are up to date.");
    } catch (error) {
        console.error("Failed to create indexes:", error);
    }
}

let isSeedingInProgress = false;

export const seedDatabase = async (firesqlite: any, db: any, force = false) => {
    if (!firesqlite || !db || isSeedingInProgress) return;
    
    try {
        const { collection, doc, getDocs, setDoc, writeBatch } = firesqlite;

        if (localStorage.getItem('tokoc_reset_flag') === 'true') {
            console.log("Reset flag detected. Skipping seeding.");
            localStorage.removeItem('tokoc_reset_flag');
            localStorage.setItem('on_seeding','false');
            localStorage.setItem(DB_VERSION_KEY, CURRENT_DB_VERSION);
            return;
        }

        const storedVersion = localStorage.getItem(DB_VERSION_KEY);
        if (storedVersion === CURRENT_DB_VERSION && !force) return;

        isSeedingInProgress = true;
        console.log('Starting Seeding...');

        await ensureIndexes(firesqlite, db);

        if (force) {
            const collectionsToClear = ['products','product_variants','categories','transactions','stock_movements','shifts','pending_carts','store_config'];
            for (const collectionName of collectionsToClear) {
               const snap = await getDocs(collection(db, collectionName));
               if (!snap.empty) {
                   const batch = writeBatch(db);
                   snap.docs.forEach((d: any) => batch.delete(d.ref));
                   await batch.commit();
               }
            }
            console.log("Forced re-seed: Data cleared.");
        }

        // --- 1. SEED BASE METADATA ---
        const updatedProducts: Product[] = [...initialProducts];
        const mainBatch = writeBatch(db);

        initialCategories.forEach(c => mainBatch.set(doc(db, 'categories', c.id), c));
        updatedProducts.forEach(p => mainBatch.set(doc(db, 'products', p.id), p));
        initialVariants.forEach(v => mainBatch.set(doc(db, 'product_variants', v.id), v));

        // --- 3. COMMIT SEED + STORE CONFIG ---
        await mainBatch.commit();

        await setDoc(doc(db, 'store_config', 'main'), {
            id: 'main', store_name: 'TokoCepat', address: '',
            tax_rate: 0.11, currency: 'IDR', receipt_footer: ''
        });

localStorage.setItem(DB_VERSION_KEY, CURRENT_DB_VERSION);
        localStorage.setItem('on_seeding','true');
        console.log('Seeding complete.');

    } catch (error) {
        console.error("Database seeding failed:", error);
    } finally {
        isSeedingInProgress = false;
    }
};