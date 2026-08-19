import { useDbStore } from '@/lib/db-store';
import { useStore } from '@/lib/store';
import { StockMovement } from '@/lib/types';

export const settleConsignment = async (
    consignorName: string,
    dateRange: { from: Date; to: Date },
    calculatedReportData: any[]
): Promise<number> => {
    const { db, firesqlite } = useDbStore.getState();
    const { activeShift, transactions } = useStore.getState();

    if (!db || !firesqlite) throw new Error("Database belum siap");
    if (!activeShift) throw new Error("Sif aktif tidak ditemukan. Silakan buka sif terlebih dahulu.");

    const { doc, getDoc, writeBatch } = firesqlite;
    
    // --- 1. INITIALIZE ATOMIC WRITE BATCH ---
    const batch = writeBatch(db);
    const now = new Date().toISOString();
    let payoutAmount = 0;

    // --- 2. QUEUE STOCK ADJUSTMENTS & MUTATIONS ---
    for (const row of calculatedReportData) {
        const currentStock = row.rawProduct.stock;
        
        if (currentStock > 0) {
            const productRef = doc(db, 'products', row.id);
            // Queue product stock update to 0
            batch.update(productRef, { stock: 0, updated_at: now });

            // Queue stock movement audit log creation
            const movementId = `sm-retur-${crypto.randomUUID().slice(0, 8)}`;
            const movementRef = doc(db, 'stock_movements', movementId);
            
            const returnMovement: StockMovement = {
                id: movementId,
                product_id: row.id,
                product_name_snapshot: row.productName,
                type: 'correction',
                qty_change: -currentStock,
                reason: `Retur Barang Titipan: ${consignorName}`,
                reference_id: activeShift.id,
                created_at: now
            };
            batch.set(movementRef, returnMovement);
        }

        payoutAmount += row.consignorShare;
    }

    // --- 3. QUEUE TRANSACTION ITEM SETTLEMENTS ---
    for (const tx of transactions) {
        let hasChanges = false;
        const updatedItems = tx.items.map(item => {
            const matchesConsignor = item.product_snapshot.is_consignment && item.product_snapshot.consignor_name === consignorName;
            
            const txDate = new Date(tx.created_at);
            const isInRange = dateRange.from && dateRange.to && txDate >= dateRange.from && txDate <= dateRange.to;

            if (matchesConsignor && tx.status === 'paid' && !item.is_consignment_settled && isInRange) {
                hasChanges = true;
                return {
                    ...item,
                    is_consignment_settled: true,
                    consignment_settled_at: now
                };
            }
            return item;
        });

        if (hasChanges) {
            const txRef = doc(db, 'transactions', tx.id);
            batch.update(txRef, { items: updatedItems });
        }
    }

    // --- 4. QUEUE CASHIER CASH OUTFLOW ---
    if (payoutAmount > 0) {
        const shiftRef = doc(db, 'shifts', activeShift.id);
        const shiftSnap = await getDoc(shiftRef);

        if (shiftSnap.exists()) {
            const currentCashOut = shiftSnap.data()?.total_cash_out || 0;
            const newCashOut = currentCashOut + payoutAmount;

            batch.update(shiftRef, { total_cash_out: newCashOut });

            // Update global Zustand state instantly
            useStore.setState({
                activeShift: {
                    ...activeShift,
                    total_cash_out: newCashOut
                }
            });
        }
    }

    // --- 5. ATOMICALY COMMIT ALL MUTATIONS AT ONCE ---
    await batch.commit();

    return payoutAmount;
};