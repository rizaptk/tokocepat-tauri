

import { Product, StockMovement } from '@/lib/types';
import { useDbStore } from '@/lib/db-store';
import { useStore } from '@/lib/store';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { setProductVariants, type VariantFormData } from './variantService';

// This type should match the Zod schema in the form dialog
export type ProductFormData = {
    name: string;
    brand?: string;
    price: number;
    stock: number;
    track_stock: boolean;
    is_active: boolean;
    category_id?: string;
    cost_price?: number;
    low_stock_alert?: number;
    has_variant: boolean;
    sku?: string;
    barcode?: string;
    variants?: VariantFormData[];
    imageUrl?: string;
    imageHint?: string;

    // Consignment fields
    is_consignment?: boolean;
    consignor_name?: string;
    consignment_commission_type?: 'percentage' | 'flat';
    consignment_commission_value?: number;
}

/**
 * Checks for duplicate SKU or Barcode across all products and variants.
 * @param data - The product form data being submitted.
 * @param currentProductId - The ID of the product being edited, or null if adding a new product.
 * @returns An error message string if a duplicate is found, otherwise null.
 */
const checkForDuplicates = (data: ProductFormData, currentProductId: string | null): string | null => {
    const { products, productVariants } = useStore.getState();

    const allIdentifiers: { value: string; source: string }[] = [];

    // Collect identifiers from the submission data
    if (data.sku && data.sku.trim()) allIdentifiers.push({ value: data.sku.trim(), source: `SKU for "${data.name}"` });
    if (data.barcode && data.barcode.trim()) allIdentifiers.push({ value: data.barcode.trim(), source: `Barcode for "${data.name}"` });
    if (data.variants) {
        data.variants.forEach((v, i) => {
            if (v.sku && v.sku.trim()) allIdentifiers.push({ value: v.sku.trim(), source: `SKU for variant "${v.name || `Variant ${i+1}`}"` });
            // Barcode per variant is not in the form yet, but good to have for future
        });
    }
    
    if (allIdentifiers.length === 0) return null;

    // Check against existing products
    for (const product of products) {
        if (product.id === currentProductId) continue; // Skip self
        for (const { value, source } of allIdentifiers) {
            if (product.sku && product.sku.trim() === value) {
                return `${source} is already used by product "${product.name}".`;
            }
            if (product.barcode && product.barcode.trim() === value) {
                return `${source} is already used by product "${product.name}".`;
            }
        }
    }

    // Check against existing variants
    for (const variant of productVariants) {
        // Skip variants belonging to the product being edited
        if (variant.product_id === currentProductId) continue;
         for (const { value, source } of allIdentifiers) {
            if (variant.sku && variant.sku.trim() === value) {
                const parentProduct = products.find(p => p.id === variant.product_id);
                return `${source} is already used by a variant of product "${parentProduct?.name || 'another product'}".`;
            }
        }
    }

    return null;
}


export const addProduct = async (productData: ProductFormData): Promise<Product | null> => {
    const { db, firesqlite } = useDbStore.getState();
    if (!db || !firesqlite) throw new Error("Database not initialized");

    const duplicateError = checkForDuplicates(productData, null);
    if (duplicateError) {
        throw new Error(duplicateError);
    }
    
    const { doc, setDoc, updateDoc } = firesqlite;
    const { variants, ...restOfProductData } = productData;
    const initialStock = restOfProductData.stock; // Capture initial stock
    const hasVariant = !!(variants && variants.length > 0);

    const newId = `prod-${crypto.randomUUID().slice(0,8)}`;
    const placeholder = PlaceHolderImages[Math.floor(Math.random() * PlaceHolderImages.length)];

    const newProduct: Product = {
        id: newId,
        ...restOfProductData,
        imageUrl: productData.imageUrl || placeholder.imageUrl,
        imageHint: productData.imageHint || placeholder.imageHint,
        track_stock: hasVariant ? false : restOfProductData.track_stock,
        has_variant: hasVariant,
    };

    // 1. Create the product with 0 stock
    await setDoc(doc(db, 'products', newProduct.id), newProduct);

    // 2. If initial stock was provided, create an auditable movement record.
    //    Written inline (not via adjustStock) because the freshly created product
    //    is not yet present in the zustand snapshot, so a store lookup would throw
    //    "Produk tidak ditemukan" after the product was already saved.
    if (newProduct.track_stock && initialStock > 0) {
        const now = new Date().toISOString();
        const movementId = `sm-${crypto.randomUUID().slice(0, 8)}`;

        const stockMovement: StockMovement = {
            id: movementId,
            product_id: newProduct.id,
            product_name_snapshot: newProduct.name,
            type: 'initial_balance',
            qty_change: initialStock,
            reason: 'Initial stock on product creation',
            reference_id: `manual-${movementId}`,
            created_at: now,
        };

        await setDoc(doc(db, 'stock_movements', movementId), stockMovement);
        await updateDoc(doc(db, 'products', newProduct.id), { stock: initialStock });
    }

    if (hasVariant && variants) {
        await setProductVariants(newProduct.id, variants);
    }
    
    return newProduct;
};

export const updateProduct = async (id: string, productData: ProductFormData): Promise<void> => {
    const { db, firesqlite } = useDbStore.getState();
    if (!db || !firesqlite) throw new Error("Database not initialized");

    const duplicateError = checkForDuplicates(productData, id);
    if (duplicateError) {
        throw new Error(duplicateError);
    }
    
    const { doc, updateDoc } = firesqlite;
    
    // Exclude stock and variants from direct update to enforce auditable changes
    const { variants, stock, low_stock_alert, ...restOfProductData } = productData;
    const hasVariant = !!(variants && variants.length > 0);

    const dataToUpdate = {
        ...restOfProductData,
        track_stock: hasVariant ? false : restOfProductData.track_stock,
        has_variant: hasVariant,
        imageUrl: productData.imageUrl,
        imageHint: productData.imageHint,
        // We no longer update stock directly from this form for existing products
        low_stock_alert: productData.low_stock_alert,
    };
    
    await updateDoc(doc(db, 'products', id), dataToUpdate);

    // Variant handling remains the same, as it has its own auditable logic
    if (hasVariant && variants) {
        await setProductVariants(id, variants);
    } else {
        await setProductVariants(id, []);
    }
};
