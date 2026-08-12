// lib/database.ts

export async function ensureIndexes(firesqlite: any, _db: any) {
    const { createIndex, createCompositeIndex } = firesqlite;
    
    console.log("Ensuring database indexes...");
    try {
        await Promise.all([
            // For transaction history ordering and filtering
            createIndex('transactions', 'created_at'),
            createCompositeIndex('transactions',[{field: 'shift_id', desc: true}, {field: 'created_at', desc: true}]),
            createCompositeIndex('transactions',[{field: 'shift_id', desc: true}, {field: 'status', desc: true}, {field: 'created_at', desc: true}]),
            createIndex('transactions', 'device'),
            createCompositeIndex('transactions',[{field: 'device', desc: true}, {field: 'created_at', desc: true}]),
            
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

/**
 * Idempotent migration: backfill `device` on transactions that were created
 * before the field existed (or synced from peers running an older version).
 * Each transaction's shift_id maps to a shift that records its device.
 */
export async function backfillTransactionDevice(firesqlite: any, db: any) {
    const { collection, doc, getDocs, query, where, updateDoc } = firesqlite;
    if (!collection || !doc || !getDocs || !query || !where || !updateDoc) return;

    try {
        const shiftsSnap = await getDocs(collection(db, 'shifts'));
        let updated = 0;

        for (const shiftDoc of shiftsSnap.docs) {
            const shift = shiftDoc.data();
            if (!shift?.device) continue;

            const txSnap = await getDocs(
                query(
                    collection(db, 'transactions'),
                    where('shift_id', 'eq', shiftDoc.id),
                )
            );

            for (const txDoc of txSnap.docs) {
                const tx = txDoc.data();
                if (!tx?.device) {
                    const txRef = doc(db, 'transactions', txDoc.id);
                    await updateDoc(txRef, { device: shift.device });
                    updated++;
                }
            }
        }

        if (updated > 0) {
            console.log(`[Migration] Backfilled device on ${updated} transactions.`);
        }
    } catch (error) {
        console.error("Failed to backfill transaction device:", error);
    }
}