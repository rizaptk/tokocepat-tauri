import { CartItem, Transaction, Shift, StoreConfig, StockMovement, Promotion } from '@/lib/types';
import { useDbStore } from '@/lib/db-store';
import { useStore } from '@/lib/store';
import { toast } from '@/hooks/use-toast';
import { evaluateDiscounts, DiscountOptions } from './promoService';

export const getTransactionsByDateRange = async (from: Date, to: Date, device?: string | 'all'): Promise<Transaction[]> => {
    const { db, firesqlite } = useDbStore.getState();
    if (!db || !firesqlite) throw new Error("Database belum diinisialisasi");

    const { collection, query, where, getDocs, orderBy } = firesqlite;
    
    const constraints: any[] = [
        where('created_at', 'gte', from.toISOString()),
        where('created_at', 'lte', to.toISOString()),
    ];
    if (device && device !== 'all') {
        constraints.push(where('device', 'eq', device));
    }
    constraints.push(orderBy('created_at', 'desc'));

    const transactionsRef = collection(db, 'transactions');
    const q = query(transactionsRef, ...constraints);

    console.log(q)
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc: any) => doc.data() as Transaction);
};

/**
 * All transactions belonging to a specific shift (any device). Uses the
 * (shift_id, created_at) composite index; live via onSnapshot.
 */
export const getTransactionsByShiftId = async (shiftId: string, device?: string | 'all'): Promise<Transaction[]> => {
    const { db, firesqlite } = useDbStore.getState();
    if (!db || !firesqlite) throw new Error("Database belum diinisialisasi");

    const { collection, query, where, getDocs, orderBy } = firesqlite;

    const constraints: any[] = [where('shift_id', 'eq', shiftId)];
    if (device && device !== 'all') {
        constraints.push(where('device', 'eq', device));
    }
    constraints.push(orderBy('created_at', 'desc'));

    const snapshot = await getDocs(query(collection(db, 'transactions'), ...constraints));
    return snapshot.docs.map((doc: any) => doc.data() as Transaction);
};

/**
 * Look up a transaction by its printed invoice number (the proof/receipt id a
 * customer brings when returning an item). Queries the whole transactions
 * collection (all time) so returns can reference sales from any shift/day.
 */
export const findTransactionByInvoice = async (invoice: string): Promise<Transaction | null> => {
    const { db, firesqlite } = useDbStore.getState();
    if (!db || !firesqlite) throw new Error("Database belum diinisialisasi");

    const { collection, query, where, getDocs, limit } = firesqlite;

    const q = query(
        collection(db, 'transactions'),
        where('invoice_number', 'eq', invoice.trim()),
        limit(1)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.length > 0 ? (snapshot.docs[0].data() as Transaction) : null;
};

/**
 * Return all 'return' transactions that reference the given original
 * transaction. Used to enforce the "cannot return more than purchased" rule.
 */
export const getReturnsByOriginalTx = async (originalTransactionId: string): Promise<Transaction[]> => {
    const { db, firesqlite } = useDbStore.getState();
    if (!db || !firesqlite) throw new Error("Database belum diinisialisasi");

    const { collection, query, where, getDocs, orderBy } = firesqlite;

    const q = query(
        collection(db, 'transactions'),
        where('original_transaction_id', 'eq', originalTransactionId),
        where('transaction_type', 'eq', 'return'),
        orderBy('created_at', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc: any) => doc.data() as Transaction);
};

export const createTransaction = async (
    cart: CartItem[],
    activeShift: Shift,
    storeConfig: StoreConfig,
    cashReceived: number,
    promos: Promotion[] = [],
    options: DiscountOptions = {}
): Promise<Transaction | null> => {
    const { db, firesqlite } = useDbStore.getState();

    if (!activeShift) {
        toast({ variant: 'destructive', title: 'Shift Tertutup', description: 'Buka shift untuk memproses transaksi.' });
        return null;
    }
    if (cart.length === 0 || !db || !firesqlite) return null;

    const { doc, getDoc, setDoc, updateDoc } = firesqlite;

    // --- Authoritative voucher usage: count real (paid, non-void) redemptions
    // directly from the DB so max_uses caps hold even across reboots/devices. ---
    let usageCounts = options.usageCounts || {};
    const voucherCodeRaw = (options.voucherCode || '').trim().toUpperCase();
    if (voucherCodeRaw) {
        try {
            const { collection, query, where, getDocs } = firesqlite;
            const redemptions = await getDocs(query(
                collection(db, 'transactions'),
                where('voucher_code', 'eq', voucherCodeRaw),
                where('status', 'eq', 'paid'),
            ));
            if (redemptions.docs) {
                usageCounts = { ...usageCounts, [voucherCodeRaw]: redemptions.docs.length };
            }
        } catch (e) {
            console.warn('Voucher usage count query failed:', e);
        }
    }

    // --- Discount engine: BOGO auto promos, voucher code, manual discount ---
    const discount = evaluateDiscounts(cart, storeConfig, promos, { ...options, usageCounts });

    if (discount.errors.length > 0) {
        toast({ variant: 'destructive', title: 'Promo Gagal', description: discount.errors[0] });
        return null;
    }

    const subtotal = discount.grossSubtotal;
    const tax_amount = discount.taxAmount;
    const total = discount.total;

    if (cashReceived < total) {
        // This case is already handled in the UI, but as a safeguard.
        return null;
    }

    const createdAt = new Date().toISOString();
    const transactionId = `tx-${crypto.randomUUID().slice(0, 8)}`;
    const invoiceNumber = `INV-${createdAt.substring(5,7)}${createdAt.substring(8,10)}-${crypto.randomUUID().slice(0,4).toUpperCase()}`;

    const newTransaction: Transaction = {
      id: transactionId,
      invoice_number: invoiceNumber,
      shift_id: activeShift.id,
      status: 'paid',
      items: cart.map(item => {
        const line = discount.lines.find(l => l.cartItemId === item.cartItemId);

        // --- CONSIGNMENT COST DEDUCTION LOGIC ---
        let effectiveCost = item.cost_price || 0; // Fallback to standard cost price
        
        if (item.is_consignment) {
            const commType = item.consignment_commission_type;
            const commVal = item.consignment_commission_value || 0;
            const sellingPrice = item.price; // Dynamic price (includes variants)
            
            if (commType === 'percentage') {
                const storeCommission = sellingPrice * (commVal / 100);
                effectiveCost = sellingPrice - storeCommission; // Owed portion to consignor (HPP)
            } else if (commType === 'flat') {
                effectiveCost = Math.max(0, sellingPrice - commVal); // Owed portion to consignor (HPP)
            }
        }

        return {
            id: `tx-item-${crypto.randomUUID().slice(0, 8)}`,
            transaction_id: transactionId,
            product_snapshot: {
                id: item.id,
                name: item.selectedVariant ? `${item.name} (${item.selectedVariant.name})` : item.name,
                price: item.price,
                imageUrl: item.imageUrl,
                imageHint: item.imageHint,
                category_id: item.category_id,
                cost_price: effectiveCost, // Store computed payout cost
                sku: item.selectedVariant ? item.selectedVariant.sku : item.sku,
                barcode: item.barcode,
                // Optional: Store consignment metadata for future auditing reports
                is_consignment: item.is_consignment,
                consignor_name: item.consignor_name,
                consignment_commission_type: item.consignment_commission_type,
                consignment_commission_value: item.consignment_commission_value,
            },
            price_snapshot: item.price,
            cost_snapshot: effectiveCost, // Saved as cost_snapshot (HPP)
            qty: item.quantity,
            subtotal: item.price * item.quantity, // GROSS line total (includes free-unit retail value)
            is_consignment_settled: item.is_consignment ? false : undefined,
            // Discount snapshot from the engine (0 for legacy/unpromoted lines)
            unit_discount: line?.unitDiscount || 0,
            discount_amount: line?.lineDiscount || 0,
            promo_ids: line?.promoIds || [],
            is_free_item: line?.isFreeItem || false,
        };
      }),
      subtotal,
      tax_amount,
      total,
      cash_paid: cashReceived,
      change: cashReceived - total,
      created_at: createdAt,
      device: activeShift.device,
      // Discount / promo breakdown (defaults 0 for legacy transactions)
      gross_subtotal: subtotal,
      discount_total: discount.discountTotal,
      promo_discount: discount.promoDiscount,
      manual_discount: discount.manualDiscount,
      voucher_code: discount.voucherCode,
      applied_promos: discount.appliedPromos,
    };


    // --- Database Operations ---
    // 1. Save transaction
    await setDoc(doc(db, 'transactions', transactionId), newTransaction);

    // 2. Update stock and create stock movements
    for (const cartItem of cart) {
        if (cartItem.selectedVariant) {
            // Deduct stock from the specific variant if it tracks stock
            if (cartItem.selectedVariant.track_stock) {
                const variantRef = doc(db, 'product_variants', cartItem.selectedVariant.id);
                const variantSnap = await getDoc(variantRef);
                if (variantSnap.exists()) {
                    const currentStock = variantSnap.data()?.stock;
                    await updateDoc(variantRef, { stock: currentStock - cartItem.quantity });

                    const movementId = `sm-var-${transactionId}-${cartItem.selectedVariant.id}`;
                    const stockMovement: StockMovement = {
                        id: movementId,
                        product_id: cartItem.selectedVariant.id, // Reference variant ID
                        product_name_snapshot: `${cartItem.name} (${cartItem.selectedVariant.name})`,
                        type: 'sale',
                        reason: `Penjualan Varian: ${cartItem.name}`,
                        qty_change: -cartItem.quantity,
                        reference_id: transactionId,
                        created_at: createdAt,
                    };
                    await setDoc(doc(db, 'stock_movements', movementId), stockMovement);
                }
            }
        } else if (cartItem.track_stock) {
            const productRef = doc(db, 'products', cartItem.id);
            const productSnap = await getDoc(productRef);
            if (productSnap.exists()) {
                const currentStock = productSnap.data()?.stock;
                await updateDoc(productRef, { stock: currentStock - cartItem.quantity });

                const movementId = `sm-${transactionId}-${cartItem.id}`;
                const stockMovement: StockMovement = {
                    id: movementId,
                    product_id: cartItem.id,
                    product_name_snapshot: cartItem.name,
                    type: 'sale',
                    reason: `Penjualan Produk: ${cartItem.name}`,
                    qty_change: -cartItem.quantity,
                    reference_id: transactionId,
                    created_at: createdAt,
                };
                await setDoc(doc(db, 'stock_movements', movementId), stockMovement);
            }
        }
    }
    return newTransaction;
};


export const voidTransaction = async (transactionId: string, reason: string): Promise<void> => {
    const { db, firesqlite } = useDbStore.getState();
    const { products, productVariants } = useStore.getState();
    if (!db || !firesqlite) throw new Error("Database belum diinisialisasi");

    const { doc, getDoc, updateDoc, setDoc } = firesqlite;
    
    const txRef = doc(db, 'transactions', transactionId);
    const txSnap = await getDoc(txRef);

    if (!txSnap.exists()) {
        throw new Error("Transaksi tidak ditemukan.");
    }

    const transaction = txSnap.data() as Transaction;
    if (transaction.status === 'voided') {
        throw new Error("Transaksi sudah dibatalkan (void).");
    }
    // A return refunds cash + restocks. Voiding it would drop the refund out of
    // shift cash math while the money already left the drawer, so it cannot be
    // voided.
    if (transaction.transaction_type === 'return') {
        throw new Error("Transaksi retur tidak dapat di-void.");
    }
    // If some items already came back through the Retur flow, voiding the whole
    // sale would restock those quantities a second time.
    const priorReturns = (await getReturnsByOriginalTx(transactionId)).filter(t => t.status !== 'voided');
    if (priorReturns.length > 0) {
        throw new Error("Transaksi sudah memiliki retur. Batalkan retur terlebih dahulu.");
    }
    
    const now = new Date().toISOString();
    // 1. Update the transaction status
    await updateDoc(txRef, {
        status: 'voided',
        voided_at: now,
        void_reason: reason,
    });

    // 2. Reverse stock movements
    for (const item of transaction.items) {
        const originalProduct = products.find(p => p.id === item.product_snapshot.id);
        
        if (originalProduct?.has_variant) {
            // Find the variant based on the snapshot name.
            const match = item.product_snapshot.name.match(/(.*) \((.*)\)/);
            if (match) {
                const variantName = match[2];
                const variant = productVariants.find(v => v.product_id === item.product_snapshot.id && v.name === variantName);

                if(variant && variant.track_stock) { // Check if variant tracks stock
                    const variantRef = doc(db, 'product_variants', variant.id);
                    const variantSnap = await getDoc(variantRef);
                    if (variantSnap.exists()) {
                        const currentStock = variantSnap.data()?.stock;
                        await updateDoc(variantRef, { stock: currentStock + item.qty });

                        const movementId = `sm-void-var-${transaction.id}-${variant.id}`;
                        const stockMovement: StockMovement = {
                            id: movementId,
                            product_id: variant.id,
                            product_name_snapshot: item.product_snapshot.name,
                            type: 'correction',
                            qty_change: item.qty,
                            reason: `Void INV: ${transaction.invoice_number}`,
                            reference_id: transaction.id,
                            created_at: now,
                        };
                        await setDoc(doc(db, 'stock_movements', movementId), stockMovement);
                    }
                }
            }
        } else {
            // Regular product stock return
            const productRef = doc(db, 'products', item.product_snapshot.id);
            const productSnap = await getDoc(productRef);
            if (productSnap.exists() && productSnap.data()?.track_stock) {
                const productData = productSnap.data();
                const currentStock = productData?.stock;
                const quantityToReturn = item.qty;

                await updateDoc(productRef, { stock: currentStock + quantityToReturn });

                const movementId = `sm-void-${transaction.id}-${item.product_snapshot.id}`;
                const stockMovement: StockMovement = {
                    id: movementId,
                    product_id: item.product_snapshot.id,
                    product_name_snapshot: item.product_snapshot.name,
                    type: 'correction',
                    qty_change: quantityToReturn,
                    reason: `Void INV: ${transaction.invoice_number}`,
                    reference_id: transaction.id,
                    created_at: now,
                };
                await setDoc(doc(db, 'stock_movements', movementId), stockMovement);
            }
        }
    }
};
