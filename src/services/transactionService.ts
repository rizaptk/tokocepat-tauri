
import { CartItem, Transaction, Shift, StoreConfig, StockMovement } from '@/lib/types';
import { useDbStore } from '@/lib/db-store';
import { toast } from '@/hooks/use-toast';

export const createTransaction = async (cart: CartItem[], activeShift: Shift, storeConfig: StoreConfig, cashReceived: number): Promise<Transaction | null> => {
    const { db, firesqlite } = useDbStore.getState();

    if (!activeShift) {
        toast({ variant: 'destructive', title: 'Shift Closed', description: 'Please open a shift to process transactions.' });
        return null;
    }
    if (cart.length === 0 || !db || !firesqlite) return null;

    const { doc, getDoc, setDoc, updateDoc } = firesqlite;

    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const taxRate = storeConfig?.tax_rate ?? 0.11;
    const tax_amount = subtotal * taxRate;
    const total = subtotal + tax_amount;

    if (cashReceived < total) {
        // This case is already handled in the UI, but as a safeguard.
        return null;
    }

    const now = new Date();
    const transactionId = now.toISOString();
    const invoiceNumber = `INV-${now.getTime()}`;

    const newTransaction: Transaction = {
      id: transactionId,
      invoice_number: invoiceNumber,
      shift_id: activeShift.id,
      status: 'paid',
      items: cart.map(item => ({
        id: `${transactionId}-${item.id}`,
        transaction_id: transactionId,
        product_snapshot: {
            id: item.id,
            name: item.name,
            price: item.price,
            imageUrl: item.imageUrl,
            imageHint: item.imageHint,
            category_id: item.category_id,
            cost_price: item.cost_price,
            sku: item.sku,
            barcode: item.barcode,
        },
        selected_modifiers_snapshot: item.selectedModifiers,
        price_snapshot: item.price,
        cost_snapshot: item.cost_price,
        qty: item.quantity,
        subtotal: item.price * item.quantity,
      })),
      subtotal,
      tax_amount,
      total,
      cash_paid: cashReceived,
      change: cashReceived - total,
      created_at: transactionId,
    };

    // --- Database Operations ---
    // 1. Save transaction
    await setDoc(doc(db, 'transactions', transactionId), newTransaction);

    // 2. Update stock and create stock movements
    for (const cartItem of cart) {
        if (cartItem.track_stock) {
            const productRef = doc(db, 'products', cartItem.id);
            
            const productSnap = await getDoc(productRef);
            if (productSnap.exists()) {
                const currentStock = productSnap.data().stock;
                await updateDoc(productRef, { stock: currentStock - cartItem.quantity });

                const movementId = `${transactionId}-${cartItem.id}-sale`;
                const stockMovement: StockMovement = {
                    id: movementId,
                    product_id: cartItem.id,
                    product_name_snapshot: cartItem.name,
                    type: 'sale',
                    qty_change: -cartItem.quantity,
                    reference_id: transactionId,
                    created_at: transactionId,
                };
                await setDoc(doc(db, 'stock_movements', movementId), stockMovement);
            }
        }
    }
    
    return newTransaction;
};


export const voidTransaction = async (transactionId: string, reason: string): Promise<void> => {
    const { db, firesqlite } = useDbStore.getState();
    if (!db || !firesqlite) throw new Error("Database not initialized");

    const { doc, getDoc, updateDoc, setDoc } = firesqlite;
    
    const txRef = doc(db, 'transactions', transactionId);
    const txSnap = await getDoc(txRef);

    if (!txSnap.exists()) {
        throw new Error("Transaction not found.");
    }

    const transaction = txSnap.data() as Transaction;
    if (transaction.status === 'voided') {
        throw new Error("Transaction is already voided.");
    }
    
    // 1. Update the transaction status
    await updateDoc(txRef, {
        status: 'voided',
        voided_at: new Date().toISOString(),
        void_reason: reason,
    });

    // 2. Reverse stock movements
    for (const item of transaction.items) {
        // Find the original product to check if it tracks stock
        const productRef = doc(db, 'products', item.product_snapshot.id);
        const productSnap = await getDoc(productRef);
        if (productSnap.exists() && productSnap.data().track_stock) {
            const productData = productSnap.data();
            const currentStock = productData.stock;
            const quantityToReturn = item.qty;

            // Update the product's stock level
            await updateDoc(productRef, { stock: currentStock + quantityToReturn });

            // Create a reversing stock movement record for auditing
            const movementId = `sm-void-${transaction.id}-${item.product_snapshot.id}`;
            const stockMovement: StockMovement = {
                id: movementId,
                product_id: item.product_snapshot.id,
                product_name_snapshot: item.product_snapshot.name,
                type: 'correction',
                qty_change: quantityToReturn,
                reason: `Void of INV: ${transaction.invoice_number}`,
                reference_id: transaction.id,
                created_at: new Date().toISOString(),
            };
            await setDoc(doc(db, 'stock_movements', movementId), stockMovement);
        }
    }
};
