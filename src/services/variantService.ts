

import { ProductVariant } from '@/lib/types';
import { useDbStore } from '@/lib/db-store';
import { adjustVariantStock } from './stockService';

// This type now includes an optional `id` to handle both new and existing variants from the form.
export type VariantFormData = {
    id?: string;
    name: string;
    additional_price: number;
    sku?: string;
    stock: number;
    track_stock: boolean;
    low_stock_alert?: number;
};

/**
 * Intelligently sets all variants for a given product.
 * It updates existing variants, adds new ones, and deletes removed ones,
 * preserving IDs to maintain historical data integrity.
 * @param productId The ID of the product to set variants for.
 * @param variants An array of variant data from the form.
 */
export const setProductVariants = async (productId: string, variants: VariantFormData[]): Promise<void> => {
    const { db, firesqlite } = useDbStore.getState();
    if (!db || !firesqlite) throw new Error("Database not initialized");

    const { collection, query, where, getDocs, deleteDoc, setDoc, updateDoc, doc } = firesqlite;

    const variantsRef = collection(db, 'product_variants');
    const q = query(variantsRef, where('product_id', '==', productId));
    const querySnapshot = await getDocs(q);
    const existingVariantIds = new Set(querySnapshot.docs.map((d: any) => d.id));
    const updatedVariantIds = new Set<string>();

    for (const variantData of variants) {
        if (variantData.id && existingVariantIds.has(variantData.id)) {
            // This is an existing variant that needs to be updated.
            const { id, ...dataToUpdate } = variantData;
            // NOTE: We do not update stock from here to enforce auditable changes.
            // Users should use the inventory page for adjustments.
            const { stock, ...restOfData } = dataToUpdate;
            await updateDoc(doc(db, 'product_variants', id), restOfData);
            updatedVariantIds.add(id);
        } else {
            // This is a new variant.
            const newId = `pv-${crypto.randomUUID().slice(0, 8)}`;
            const initialStock = variantData.stock;
            const newVariant: ProductVariant = {
                id: newId,
                product_id: productId,
                name: variantData.name,
                additional_price: variantData.additional_price,
                sku: variantData.sku,
                stock: 0, // Always create with 0 stock
                track_stock: variantData.track_stock,
                low_stock_alert: variantData.low_stock_alert,
            };
            
            await setDoc(doc(db, 'product_variants', newId), newVariant);
            
            // If initial stock > 0, create an auditable movement record
            if (newVariant.track_stock && initialStock > 0) {
                await adjustVariantStock(
                    newId,
                    'initial_balance',
                    initialStock,
                    'Initial stock on variant creation'
                );
            }
            updatedVariantIds.add(newVariant.id); // Add the new ID to the set
        }
    }

    const variantsToDelete = [...existingVariantIds].filter(id => !updatedVariantIds.has(id));
    for (const idToDelete of variantsToDelete) {
        await deleteDoc(doc(db, 'product_variants', idToDelete));
    }
};
