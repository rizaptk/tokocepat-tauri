
import { Product, StockMovement, StockMovementType } from '@/lib/types';
import { useDbStore } from '@/lib/db-store';
import { useStore } from '@/lib/store';

type AdjustmentData = {
    product_id: string;
    type: StockMovementType;
    qty_change: number;
    reason: string;
}

export const adjustStock = async (data: AdjustmentData): Promise<void> => {
    const { db, firesqlite } = useDbStore.getState();
    const { products } = useStore.getState();

    if (!db || !firesqlite) throw new Error("Database not initialized");

    const { doc, getDoc, setDoc, updateDoc } = firesqlite;
    
    const product = products.find(p => p.id === data.product_id);
    if (!product) throw new Error("Product not found");

    const now = new Date().toISOString();
    const movementId = `sm-${now}-${Math.random().toString(36).substring(2, 9)}`;

    let newStock = product.stock;
    let qtyChange = data.qty_change;

    // For non-correction types, enforce sign
    if (data.type === 'restock') {
        qtyChange = Math.abs(qtyChange);
    } else if (data.type === 'lost' || data.type === 'damaged') {
        qtyChange = -Math.abs(qtyChange);
    }

    newStock += qtyChange;

    const stockMovement: StockMovement = {
        id: movementId,
        product_id: data.product_id,
        product_name_snapshot: product.name,
        type: data.type,
        qty_change: qtyChange,
        reason: data.reason,
        reference_id: `manual-${movementId}`,
        created_at: now,
    };

    // --- Database Operations ---
    // 1. Create the stock movement record for auditing
    await setDoc(doc(db, 'stock_movements', movementId), stockMovement);

    // 2. Update the product's stock level
    const productRef = doc(db, 'products', data.product_id);
    await updateDoc(productRef, { stock: newStock });
};


export const adjustIngredientStock = async (ingredientId: string, type: StockMovementType, qty_change: number, reason: string): Promise<void> => {
    const { db, firesqlite } = useDbStore.getState();
    const { rawIngredients } = useStore.getState();

    if (!db || !firesqlite) throw new Error("Database not initialized");

    const { doc, getDoc, setDoc, updateDoc } = firesqlite;

    const ingredient = rawIngredients.find(i => i.id === ingredientId);
    if (!ingredient) throw new Error("Ingredient not found");

    const now = new Date().toISOString();
    const movementId = `sm-${now}-${Math.random().toString(36).substring(2, 9)}`;

    let finalQtyChange = qty_change;
    if (type === 'restock' || type === 'initial_balance') {
        finalQtyChange = Math.abs(qty_change);
    } else if (type === 'lost' || type === 'damaged') {
        finalQtyChange = -Math.abs(qty_change);
    }
    
    const newStock = ingredient.stock_qty + finalQtyChange;

    const stockMovement: StockMovement = {
        id: movementId,
        product_id: ingredient.id, // Using product_id to store ingredient ID
        product_name_snapshot: ingredient.name,
        type: type,
        qty_change: finalQtyChange,
        reason: reason,
        reference_id: `manual-ing-${movementId}`,
        created_at: now,
    };
    
    // 1. Create stock movement record
    await setDoc(doc(db, 'stock_movements', movementId), stockMovement);

    // 2. Update ingredient stock level
    const ingredientRef = doc(db, 'raw_ingredients', ingredient.id);
    await updateDoc(ingredientRef, { stock_qty: newStock });
}
