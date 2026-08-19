import { Transaction, TransactionItem, Shift, StoreConfig, StockMovement } from '@/lib/types';
import { useDbStore } from '@/lib/db-store';
import { useStore } from '@/lib/store';
import { toast } from '@/hooks/use-toast';
import { getReturnsByOriginalTx } from './transactionService';

// Same stable identity used by the ReturnDialog so different variants of the
// same parent product stay separate when validating return quantities.
const itemKey = (it: TransactionItem) => `${it.product_snapshot.id}::${it.product_snapshot.name}`;

// Same logic as createTransaction — used to compute the tax portion of a refund.
const getTaxRateForItem = (item: { product_snapshot: { category_id?: string } }, storeConfig: StoreConfig): number => {
    const { tax_settings, tax_rate } = storeConfig;
    if (!tax_settings) return tax_rate;
    if (item.product_snapshot.category_id) {
        const override = tax_settings.category_overrides.find(co => co.category_id === item.product_snapshot.category_id);
        if (override && typeof override.tax_rate === 'number') return override.tax_rate;
    }
    return tax_settings.default_rate;
};

export interface ReturnLine {
    item: TransactionItem;
    qty: number; // positive — number of units being returned
}

interface CreateReturnParams {
    originalTx: Transaction;
    returnLines: ReturnLine[];
    reason: string;
    conditionOk: boolean;
    activeShift: Shift;
    storeConfig: StoreConfig;
}

/**
 * Create a SEPARATE 'return' transaction that refunds money from the current
 * shift and restocks the returned items. The original transaction is never
 * modified (it can belong to a different shift/day).
 *
 * Return amounts are stored NEGATIVE (subtotal, tax_amount, total and item
 * qty/subtotal) so existing total-based reports and shift cash math net
 * refunds automatically.
 */
export const createReturnTransaction = async ({
    originalTx,
    returnLines,
    reason,
    conditionOk,
    activeShift,
    storeConfig,
}: CreateReturnParams): Promise<Transaction | null> => {
    const { db, firesqlite } = useDbStore.getState();
    const { products, productVariants } = useStore.getState();

    if (!activeShift) {
        toast({ variant: 'destructive', title: 'Shift Tertutup', description: 'Buka shift untuk memproses retur.' });
        return null;
    }
    if (!db || !firesqlite) throw new Error('Database belum diinisialisasi');

    if (originalTx.status !== 'paid' || originalTx.transaction_type === 'return') {
        throw new Error('Transaksi asal tidak valid untuk retur.');
    }
    if (!reason.trim()) {
        throw new Error('Alasan retur wajib diisi.');
    }
    if (!conditionOk) {
        throw new Error('Pastikan barang dalam kondisi baik untuk diproses retur.');
    }

    // Enforce the "cannot return more than purchased" rule.
    const priorReturns = await getReturnsByOriginalTx(originalTx.id);
    const returnedSoFar: Record<string, number> = {};
    priorReturns.forEach(rtx => {
        rtx.items.forEach(it => {
            returnedSoFar[itemKey(it)] = (returnedSoFar[itemKey(it)] || 0) + Math.abs(it.qty);
        });
    });

    const lines = returnLines.filter(l => l.qty > 0);

    for (const line of lines) {
        const k = itemKey(line.item);
        const original = originalTx.items.find(it => itemKey(it) === k);
        if (!original) {
            throw new Error('Item tidak ditemukan di transaksi asal.');
        }
        const already = returnedSoFar[k] || 0;
        if (line.qty > original.qty - already) {
            throw new Error(`Melebihi jumlah yang dibeli untuk "${original.product_snapshot.name}".`);
        }
    }

    const createdAt = new Date().toISOString();
    const transactionId = `tx-${crypto.randomUUID().slice(0, 8)}`;
    const invoiceNumber = `RTR-${createdAt.substring(5, 7)}${createdAt.substring(8, 10)}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;

    const items: TransactionItem[] = lines.map(line => {
        // Refund the NET unit price actually charged (gross minus any per-unit
        // discount), so free / discounted units return 0 cash but still restock.
        const unitDiscount = line.item.unit_discount || 0;
        const netUnit = line.item.price_snapshot - unitDiscount;
        return {
            id: `tx-item-${crypto.randomUUID().slice(0, 8)}`,
            transaction_id: transactionId,
            // Copy the ORIGINAL snapshot so profit/cost/consignment math is exact.
            product_snapshot: line.item.product_snapshot,
            price_snapshot: line.item.price_snapshot,
            cost_snapshot: line.item.cost_snapshot,
            qty: -line.qty,
            subtotal: -(netUnit * line.qty),
            unit_discount: unitDiscount,
            discount_amount: -(unitDiscount * line.qty),
            promo_ids: line.item.promo_ids || [],
            is_free_item: line.item.is_free_item || false,
        };
    });

    const subtotal = items.reduce((sum, it) => sum + it.subtotal, 0);
    const tax_amount = lines.reduce((acc, line) => {
        const rate = getTaxRateForItem(line.item, storeConfig);
        const unitDiscount = line.item.unit_discount || 0;
        const netUnit = line.item.price_snapshot - unitDiscount;
        return acc - (netUnit * line.qty * rate);
    }, 0);
    const total = subtotal + tax_amount;

    const newTransaction: Transaction = {
        id: transactionId,
        invoice_number: invoiceNumber,
        transaction_type: 'return',
        shift_id: activeShift.id,
        status: 'paid',
        items,
        subtotal,
        tax_amount,
        total,
        cash_paid: 0,
        change: 0,
        created_at: createdAt,
        original_transaction_id: originalTx.id,
        original_invoice: originalTx.invoice_number,
        return_reason: reason,
        condition_ok: conditionOk,
        device: activeShift.device,
    };

    const { doc, setDoc, updateDoc, getDoc } = firesqlite;

    // 1. Save the return transaction.
    await setDoc(doc(db, 'transactions', transactionId), newTransaction);

    // 2. Restock returned items + write 'return' stock movements.
    for (const line of lines) {
        if (line.qty <= 0) continue;

        const originalProduct = products.find(p => p.id === line.item.product_snapshot.id);

        if (originalProduct?.has_variant) {
            // Parse "(Variant)" from the snapshot name, like voidTransaction does.
            const match = line.item.product_snapshot.name.match(/(.*) \((.*)\)/);
            if (match) {
                const variant = productVariants.find(
                    v => v.product_id === line.item.product_snapshot.id && v.name === match[2]
                );
                if (variant && variant.track_stock) {
                    const variantRef = doc(db, 'product_variants', variant.id);
                    const variantSnap = await getDoc(variantRef);
                    if (variantSnap.exists()) {
                        const currentStock = variantSnap.data()?.stock;
                        await updateDoc(variantRef, { stock: currentStock + line.qty, updated_at: createdAt });

                        const movementId = `sm-retur-var-${transactionId}-${variant.id}`;
                        const stockMovement: StockMovement = {
                            id: movementId,
                            product_id: variant.id,
                            product_name_snapshot: line.item.product_snapshot.name,
                            type: 'return',
                            qty_change: line.qty,
                            reason: `Retur INV: ${originalTx.invoice_number}`,
                            reference_id: transactionId,
                            created_at: createdAt,
                        };
                        await setDoc(doc(db, 'stock_movements', movementId), stockMovement);
                    }
                }
            }
        } else {
            const productRef = doc(db, 'products', line.item.product_snapshot.id);
            const productSnap = await getDoc(productRef);
            if (productSnap.exists() && productSnap.data()?.track_stock) {
                const currentStock = productSnap.data()?.stock;
                await updateDoc(productRef, { stock: currentStock + line.qty, updated_at: createdAt });

                const movementId = `sm-retur-${transactionId}-${line.item.product_snapshot.id}`;
                const stockMovement: StockMovement = {
                    id: movementId,
                    product_id: line.item.product_snapshot.id,
                    product_name_snapshot: line.item.product_snapshot.name,
                    type: 'return',
                    qty_change: line.qty,
                    reason: `Retur INV: ${originalTx.invoice_number}`,
                    reference_id: transactionId,
                    created_at: createdAt,
                };
                await setDoc(doc(db, 'stock_movements', movementId), stockMovement);
            }
        }
    }

    return newTransaction;
};