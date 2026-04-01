import { CartItem, Transaction, Shift, StoreConfig, StockMovement, RawIngredient } from '@/lib/types';
import { useDbStore } from '@/lib/db-store';
import { useStore } from '@/lib/store';
import { toast } from '@/hooks/use-toast';
// import { error } from 'node:console';

export const getTransactionsByDateRange = async (from: Date, to: Date): Promise<Transaction[]> => {
    const { db, firesqlite } = useDbStore.getState();
    if (!db || !firesqlite) throw new Error("Database belum diinisialisasi");

    const { collection, query, where, getDocs, orderBy } = firesqlite;
    
    const transactionsRef = collection(db, 'transactions');
    const q = query(
        transactionsRef,
        where('created_at', '>=', from.toISOString()),
        where('created_at', '<=', to.toISOString()),
        orderBy('created_at', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc: any) => doc.data() as Transaction);
};

const getTaxRateForItem = (item: CartItem, storeConfig: StoreConfig): number => {
    const { tax_settings, tax_rate } = storeConfig;

    if (!tax_settings) {
        return tax_rate; // Fallback to old system
    }

    // 1. Check for category override
    if (item.category_id) {
        const categoryOverride = tax_settings.category_overrides.find(
            co => co.category_id === item.category_id
        );
        if (categoryOverride && typeof categoryOverride.tax_rate === 'number') {
            return categoryOverride.tax_rate;
        }
    }

    // 2. Check for product type override
    if (item.product_type === 'food_and_beverage' && typeof tax_settings.product_type_overrides.food_and_beverage === 'number') {
        return tax_settings.product_type_overrides.food_and_beverage!;
    }

    // 3. Fallback to default rate from new system
    return tax_settings.default_rate;
};

export const createTransaction = async (cart: CartItem[], activeShift: Shift, storeConfig: StoreConfig, cashReceived: number): Promise<Transaction | null> => {
    const { db, firesqlite } = useDbStore.getState();
    const { recipes } = useStore.getState();

    if (!activeShift) {
        toast({ variant: 'destructive', title: 'Shift Tertutup', description: 'Buka shift untuk memproses transaksi.' });
        return null;
    }
    if (cart.length === 0 || !db || !firesqlite) return null;

    const { doc, getDoc, setDoc, updateDoc } = firesqlite;

    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const tax_amount = cart.reduce((taxSum, item) => {
        const itemTaxRate = getTaxRateForItem(item, storeConfig);
        const itemTotal = item.price * item.quantity;
        return taxSum + (itemTotal * itemTaxRate);
    }, 0);
    
    const total = subtotal + tax_amount;

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
      items: cart.map(item => ({
        id: `tx-item-${crypto.randomUUID().slice(0, 8)}`,
        transaction_id: transactionId,
        product_snapshot: {
            id: item.id,
            name: item.selectedVariant ? `${item.name} (${item.selectedVariant.name})` : item.name,
            price: item.price,
            imageUrl: item.imageUrl,
            imageHint: item.imageHint,
            category_id: item.category_id,
            cost_price: item.cost_price,
            sku: item.selectedVariant ? item.selectedVariant.sku : item.sku,
            barcode: item.barcode,
            product_type: item.product_type,
            is_composite: item.is_composite,
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
      created_at: createdAt,
    };


    // --- Database Operations ---
    // 1. Save transaction
    await setDoc(doc(db, 'transactions', transactionId), newTransaction);

    // 2. Update stock and create stock movements
    for (const cartItem of cart) {
        if (cartItem.is_composite) {
            console.log('memproses item komposit', recipes, cartItem);
            const recipe = recipes.find(r => r.product_id === cartItem.id);
            if (recipe) {
                for (const recipeItem of recipe.items) {
                    const ingredientRef = doc(db, 'raw_ingredients', recipeItem.ingredient_id);
                    const ingredientSnap = await getDoc(ingredientRef);
                    if (ingredientSnap.exists()) {
                        const ingredient = ingredientSnap.data();
                        const quantityToDeduct = recipeItem.quantity * cartItem.quantity;
                        await updateDoc(ingredientRef, { stock_qty: ingredient.stock_qty - quantityToDeduct });

                        const movementId = `sm-${transactionId}-${ingredient.id}`;
                        const stockMovement: StockMovement = {
                            id: movementId,
                            product_id: ingredient.id, // Using product_id to store ingredient_id
                            product_name_snapshot: ingredient.name,
                            type: 'sale',
                            qty_change: -quantityToDeduct,
                            reason: `Penjualan komposit: ${cartItem.name}`,
                            reference_id: transactionId,
                            created_at: createdAt,
                        };
                        await setDoc(doc(db, 'stock_movements', movementId), stockMovement);
                    }
                }
            }
        } else if (cartItem.selectedVariant) {
            // Deduct stock from the specific variant if it tracks stock
            if (cartItem.selectedVariant.track_stock) {
                const variantRef = doc(db, 'product_variants', cartItem.selectedVariant.id);
                const variantSnap = await getDoc(variantRef);
                if (variantSnap.exists()) {
                    const currentStock = variantSnap.data().stock;
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
                const currentStock = productSnap.data().stock;
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
    const { recipes, products, productVariants } = useStore.getState();
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
        
        if (item.product_snapshot.is_composite) {
             const recipe = recipes.find(r => r.product_id === item.product_snapshot.id);
             if (recipe) {
                for (const recipeItem of recipe.items) {
                    const ingredientRef = doc(db, 'raw_ingredients', recipeItem.ingredient_id);
                    const ingredientSnap = await getDoc(ingredientRef);
                    if (ingredientSnap.exists()) {
                        const ingredient = ingredientSnap.data() as RawIngredient;
                        const quantityToReturn = recipeItem.quantity * item.qty;

                        await updateDoc(ingredientRef, { stock_qty: ingredient.stock_qty + quantityToReturn });

                        const movementId = `sm-void-${transaction.id}-${ingredient.id}`;
                        const stockMovement: StockMovement = {
                            id: movementId,
                            product_id: ingredient.id,
                            product_name_snapshot: ingredient.name,
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
        } else if (originalProduct?.has_variant) {
            // Find the variant based on the snapshot name.
            const match = item.product_snapshot.name.match(/(.*) \((.*)\)/);
            if (match) {
                const variantName = match[2];
                const variant = productVariants.find(v => v.product_id === item.product_snapshot.id && v.name === variantName);

                if(variant && variant.track_stock) { // Check if variant tracks stock
                    const variantRef = doc(db, 'product_variants', variant.id);
                    const variantSnap = await getDoc(variantRef);
                    if (variantSnap.exists()) {
                        const currentStock = variantSnap.data().stock;
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
            if (productSnap.exists() && productSnap.data().track_stock) {
                const productData = productSnap.data();
                const currentStock = productData.stock;
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
