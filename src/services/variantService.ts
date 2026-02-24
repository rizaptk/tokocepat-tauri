import { ProductVariant } from '@/lib/types';
import { useDbStore } from '@/lib/db-store';

// Use a simplified type for form data, as product_id and id are handled by the service.
export type VariantFormData = Omit<ProductVariant, 'id' | 'product_id'>;

/**
 * Sets all variants for a given product.
 * This function performs a "delete all and replace" operation for simplicity.
 * @param productId The ID of the product to set variants for.
 * @param variants An array of variant data to save.
 */
export const setProductVariants = async (productId: string, variants: VariantFormData[]): Promise<void> => {
    const { db, firesqlite } = useDbStore.getState();
    if (!db || !firesqlite) throw new Error("Database not initialized");

    const { collection, query, where, getDocs, deleteDoc, setDoc, doc } = firesqlite;

    // 1. Find all existing variants for the product
    const variantsRef = collection(db, 'product_variants');
    const q = query(variantsRef, where('product_id', '==', productId));
    const querySnapshot = await getDocs(q);

    // 2. Delete all existing variants for this product
    const deletePromises = querySnapshot.docs.map((d: any) => deleteDoc(d.ref));
    await Promise.all(deletePromises);

    // 3. Add the new set of variants
    const addPromises = variants.map(variantData => {
        const newId = `pv-${new Date().getTime()}-${Math.random().toString(36).substr(2, 9)}`;
        const newVariant: ProductVariant = {
            id: newId,
            product_id: productId,
            ...variantData,
        };
        return setDoc(doc(db, 'product_variants', newId), newVariant);
    });

    await Promise.all(addPromises);
};
