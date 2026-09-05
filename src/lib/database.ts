// lib/database.ts
import { splitTxCosts, MONEY_VERSION } from '@/lib/money';

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

            // For voucher redemption counting: where voucher_code eq + status eq
            createCompositeIndex('transactions',[{field: 'voucher_code', desc: true}, {field: 'status', desc: true}]),
            
            // For stock movement report filtering
            createIndex('stock_movements', 'created_at'),

            // For stock movement report by product ids filtering (getStockMovementsByProducts)
            createCompositeIndex('stock_movements', [{field: 'product_id', desc: true}, {field: 'created_at', desc: true}]),

            // For product category filtering
            createIndex('products', 'category_id'),
            
            // For product search by name
            createIndex('products', 'name'),

            // For product search by barcode / combined name+barcode lookups
            // (cashier search, inventory worksheet multi-search, product page).
            createIndex('products', 'barcode'),
            createCompositeIndex('products', [{ field: 'name' }, { field: 'barcode' }]),

            // For variants lookup by product
            createIndex('product_variants', 'product_id'),

            // For promo/voucher listing and sync ordering
            createIndex('promos', 'created_at'),

            // For cashier voucher lookup by code (authoritative DB resolution)
            createIndex('promos', 'code'),

            // Customers & groups (grosir)
            createIndex('customers', 'name'),
            createIndex('customers', 'groupId'),
            createIndex('customer_groups', 'rank'),
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

/**
 * One-time backfill: freeze the cost split on legacy transaction docs that
 * predate event-stored money (`money_v`). Deterministic — computed from each
 * line's stored `cost_snapshot` (never recomputed from the product master,
 * whose prices may have changed), so every peer converges to the same values
 * over net-sync. Marker-guarded: runs once per store, resumes are naturally
 * idempotent (docs already at version are skipped).
 */
export async function backfillTransactionMoney(firesqlite: any, db: any) {
    const { collection, doc, getDoc, setDoc, getDocs, query, orderBy, limit, offset, writeBatch } = firesqlite;
    if (!collection || !doc || !getDoc || !setDoc || !getDocs || !query || !orderBy || !limit || !offset || !writeBatch) return;

    try {
        const markerRef = doc(db, 'app_state', 'money_backfill');
        const marker = await getDoc(markerRef);
        if (marker.exists() && (marker.data()?.v || 0) >= MONEY_VERSION) return;

        const BATCH = 500;
        let skipped = 0;
        let page = 0;
        for (;;) {
            const snap = await getDocs(query(
                collection(db, 'transactions'),
                orderBy('created_at', 'asc'),
                limit(BATCH),
                offset(page * BATCH),
            ));
            if (snap.docs.length === 0) break;
            const batch = writeBatch(db);
            let staged = 0;
            for (const d of snap.docs) {
                const tx = d.data();
                if (!tx || (tx.money_v || 0) >= MONEY_VERSION) { skipped++; continue; }
                const s = splitTxCosts(tx.items || []);
                batch.update(doc(db, 'transactions', d.id), {
                    hpp_standard: s.hppStandard,
                    payout_consignment: s.payoutConsignment,
                    money_v: MONEY_VERSION,
                });
                staged++;
            }
            if (staged > 0) await batch.commit();
            if (snap.docs.length < BATCH) break;
            page++;
        }

        await setDoc(markerRef, { v: MONEY_VERSION, at: new Date().toISOString() } as any);
        console.log(`[Migration] Backfilled money scalars (skipped ${skipped} already versioned).`);
    } catch (error) {
        console.error("Failed to backfill transaction money:", error);
    }
}