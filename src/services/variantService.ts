import { ProductVariant } from '@/lib/types';
import { useDbStore } from '@/lib/db-store';

// This type now includes an optional `id` to handle both new and existing variants from the form.
export type VariantFormData = {
    id?: string;
    name: string;
    additional_price: number;
    sku?: string;
    stock: number;
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

    // 1. Get all existing variants for this product to compare against.
    const variantsRef = collection(db, 'product_variants');
    const q = query(variantsRef, where('product_id', '==', productId));
    const querySnapshot = await getDocs(q);
    const existingVariantIds = new Set(querySnapshot.docs.map((d: any) => d.id));

    const updatedVariantIds = new Set<string>();
    const updatePromises: Promise<void>[] = [];

    // 2. Process variants from the form: update existing or add new ones.
    for (const variantData of variants) {
        if (variantData.id && existingVariantIds.has(variantData.id)) {
            // This is an existing variant that needs to be updated.
            const { id, ...dataToUpdate } = variantData;
            updatePromises.push(updateDoc(doc(db, 'product_variants', id), dataToUpdate));
            updatedVariantIds.add(id);
        } else {
            // This is a new variant.
            const newId = `pv-${crypto.randomUUID().slice(0, 8)}`;
            const newVariant: ProductVariant = {
                id: newId,
                product_id: productId,
                name: variantData.name,
                additional_price: variantData.additional_price,
                sku: variantData.sku,
                stock: variantData.stock,
            };
            updatePromises.push(setDoc(doc(db, 'product_variants', newId), newVariant));
        }
    }

    // 3. Determine which variants were removed by the user and delete them.
    const variantsToDelete = [...existingVariantIds].filter(id => !updatedVariantIds.has(id));
    for (const idToDelete of variantsToDelete) {
        updatePromises.push(deleteDoc(doc(db, 'product_variants', idToDelete)));
    }

    // 4. Execute all database operations.
    await Promise.all(updatePromises);
};
