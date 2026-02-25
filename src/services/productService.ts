
import { Product, ProductType, ProductVariant, RecipeItem } from '@/lib/types';
import { useDbStore } from '@/lib/db-store';
import { useStore } from '@/lib/store';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { setProductVariants, type VariantFormData } from './variantService';
import { setRecipeForProduct } from './recipeService';

// This type should match the Zod schema in the form dialog
export type ProductFormData = {
    name: string;
    price: number;
    stock: number;
    track_stock: boolean;
    is_active: boolean;
    product_type: ProductType;
    category_id?: string;
    cost_price?: number;
    low_stock_alert?: number;
    has_variant: boolean;
    has_modifier: boolean;
    is_composite?: boolean;
    recipe_items?: RecipeItem[];
    modifier_group_ids?: string[];
    sku?: string;
    barcode?: string;
    variants?: VariantFormData[];
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

    // --- UNIQUENESS VALIDATION ---
    const duplicateError = checkForDuplicates(productData, null);
    if (duplicateError) {
        throw new Error(duplicateError);
    }
    // -----------------------------

    const { doc, setDoc } = firesqlite;
    const { variants, recipe_items, ...restOfProductData } = productData;
    const hasVariant = !!(variants && variants.length > 0);
    const isComposite = restOfProductData.product_type === 'food_and_beverage' && (restOfProductData.is_composite || false);

    const newId = new Date().getTime().toString();
    const placeholder = PlaceHolderImages[parseInt(newId) % PlaceHolderImages.length];

    const newProduct: Product = {
        id: newId,
        ...restOfProductData,
        is_composite: isComposite,
        track_stock: hasVariant || isComposite ? false : restOfProductData.track_stock,
        has_variant: hasVariant,
        modifier_group_ids: restOfProductData.has_modifier ? restOfProductData.modifier_group_ids : [],
        imageUrl: placeholder.imageUrl,
        imageHint: placeholder.imageHint,
    };

    await setDoc(doc(db, 'products', newProduct.id), newProduct);

    if (hasVariant && variants) {
        await setProductVariants(newProduct.id, variants);
    }

    if (isComposite && recipe_items) {
        await setRecipeForProduct(newProduct.id, recipe_items);
    } else {
        await setRecipeForProduct(newProduct.id, []);
    }
    
    return newProduct;
};

export const updateProduct = async (id: string, productData: ProductFormData): Promise<void> => {
    const { db, firesqlite } = useDbStore.getState();
    if (!db || !firesqlite) throw new Error("Database not initialized");

    // --- UNIQUENESS VALIDATION ---
    const duplicateError = checkForDuplicates(productData, id);
    if (duplicateError) {
        throw new Error(duplicateError);
    }
    // -----------------------------
    
    const { doc, updateDoc } = firesqlite;
    
    const { variants, recipe_items, ...restOfProductData } = productData;
    const hasVariant = !!(variants && variants.length > 0);
    const isComposite = restOfProductData.product_type === 'food_and_beverage' && (restOfProductData.is_composite || false);

    const dataToUpdate = {
        ...restOfProductData,
        is_composite: isComposite,
        track_stock: hasVariant || isComposite ? false : restOfProductData.track_stock,
        has_variant: hasVariant,
        modifier_group_ids: restOfProductData.has_modifier ? restOfProductData.modifier_group_ids : [],
    };
    
    await updateDoc(doc(db, 'products', id), dataToUpdate);

    if (hasVariant && variants) {
        await setProductVariants(id, variants);
    } else {
        await setProductVariants(id, []);
    }

    if (isComposite && recipe_items) {
        await setRecipeForProduct(id, recipe_items);
    } else {
        await setRecipeForProduct(id, []);
    }
};
