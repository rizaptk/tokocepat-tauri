
import { StockMovement, StockMovementType } from '@/lib/types';
import { useDbStore } from '@/lib/db-store';
import { useStore } from '@/lib/store';

export const getStockMovementsByDateRange = async (from: Date, to: Date): Promise<StockMovement[]> => {
    const { db, firesqlite } = useDbStore.getState();
    if (!db || !firesqlite) throw new Error("Database not initialized");

    const { collection, query, where, getDocs, orderBy } = firesqlite;
    
    const movementsRef = collection(db, 'stock_movements');
    const q = query(
        movementsRef,
        where('created_at', 'gte', from.toISOString()),
        where('created_at', 'lte', to.toISOString()),
        orderBy('created_at', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc: any) => doc.data() as StockMovement);
};

export const getStockMovementsByProducts = async (productIds: string[]): Promise<StockMovement[]> => {
    const { db, firesqlite } = useDbStore.getState();
    if (!db || !firesqlite || productIds.length === 0) return [];

    const { collection, query, where, getDocs, orderBy, limit } = firesqlite;
    
    const movementsRef = collection(db, 'stock_movements');
    // Note: 'in' operator is supported in firesqlite for array filtering
    const q = query(
        movementsRef,
        where('product_id', 'in', productIds),
        orderBy('product_id', 'desc'),
        orderBy('created_at', 'desc'),
        limit(50)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc: any) => doc.data() as StockMovement);
};

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

    const { doc, setDoc, updateDoc } = firesqlite;
    
    const product = products.find(p => p.id === data.product_id);
    if (!product) throw new Error("Produk tidak ditemukan");

    const now = new Date().toISOString();
    const movementId = `sm-${crypto.randomUUID().slice(0, 8)}`;

    const newStock = product.stock + data.qty_change;

    const stockMovement: StockMovement = {
        id: movementId,
        product_id: data.product_id,
        product_name_snapshot: product.name,
        type: data.type,
        qty_change: data.qty_change,
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

export const adjustVariantStock = async (variantId: string, type: StockMovementType, qty_change: number, reason: string): Promise<void> => {
    const { db, firesqlite } = useDbStore.getState();
    const { productVariants, products } = useStore.getState();
    if (!db || !firesqlite) throw new Error("Database not initialized");

    const { doc, setDoc, updateDoc } = firesqlite;
    const variant = productVariants.find(v => v.id === variantId);
    if (!variant) throw new Error("Variant not found");

    const parentProduct = products.find(p => p.id === variant.product_id);
    const productNameSnapshot = parentProduct ? `${parentProduct.name} (${variant.name})` : variant.name;

    const newStock = variant.stock + qty_change;
    const now = new Date().toISOString();
    const movementId = `sm-var-${crypto.randomUUID().slice(0, 8)}`;

    const stockMovement: StockMovement = {
        id: movementId,
        product_id: variant.id,
        product_name_snapshot: productNameSnapshot,
        type: type,
        qty_change: qty_change,
        reason: reason,
        reference_id: `manual-var-${movementId}`,
        created_at: now,
    };

    await setDoc(doc(db, 'stock_movements', movementId), stockMovement);
    await updateDoc(doc(db, 'product_variants', variantId), { stock: newStock });
};


export const adjustIngredientStock = async (ingredientId: string, type: StockMovementType, qty_change: number, reason: string): Promise<void> => {
    const { db, firesqlite } = useDbStore.getState();
    const { rawIngredients } = useStore.getState();

    if (!db || !firesqlite) throw new Error("Database not initialized");

    const { doc, setDoc, updateDoc } = firesqlite;

    const ingredient = rawIngredients.find(i => i.id === ingredientId);
    if (!ingredient) throw new Error("Bahan baku tidak ditemukan");

    const now = new Date().toISOString();
    const movementId = `sm-ing-${crypto.randomUUID().slice(0, 8)}`;
    
    const newStock = ingredient.stock_qty + qty_change;

    const stockMovement: StockMovement = {
        id: movementId,
        product_id: ingredient.id, // Using product_id to store ingredient ID
        product_name_snapshot: ingredient.name,
        type: type,
        qty_change: qty_change,
        reason: reason,
        reference_id: `manual-bahan-${movementId}`,
        created_at: now,
    };
    
    // 1. Create stock movement record
    await setDoc(doc(db, 'stock_movements', movementId), stockMovement);

    // 2. Update ingredient stock level
    const ingredientRef = doc(db, 'raw_ingredients', ingredient.id);
    await updateDoc(ingredientRef, { stock_qty: newStock });
}
