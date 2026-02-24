
import { Product, ProductType } from '@/lib/types';
import { useDbStore } from '@/lib/db-store';
import { PlaceHolderImages } from '@/lib/placeholder-images';

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
    modifier_group_ids?: string[];
}

export const addProduct = async (productData: ProductFormData): Promise<Product | null> => {
    const { db, firesqlite } = useDbStore.getState();
    if (!db || !firesqlite) throw new Error("Database not initialized");

    const { doc, setDoc } = firesqlite;

    const newId = new Date().getTime().toString();
    const placeholder = PlaceHolderImages[parseInt(newId) % PlaceHolderImages.length];

    const newProduct: Product = {
        id: newId,
        ...productData,
        modifier_group_ids: productData.has_modifier ? productData.modifier_group_ids : [],
        imageUrl: placeholder.imageUrl,
        imageHint: placeholder.imageHint,
    };

    await setDoc(doc(db, 'products', newProduct.id), newProduct);
    
    return newProduct;
};

export const updateProduct = async (id: string, productData: ProductFormData): Promise<void> => {
    const { db, firesqlite } = useDbStore.getState();
    if (!db || !firesqlite) throw new Error("Database not initialized");

    const { doc, updateDoc } = firesqlite;
    
    const dataToUpdate = {
        ...productData,
        modifier_group_ids: productData.has_modifier ? productData.modifier_group_ids : [],
    };
    
    await updateDoc(doc(db, 'products', id), dataToUpdate);
};
