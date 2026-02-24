
import { Category } from '@/lib/types';
import { useDbStore } from '@/lib/db-store';

export const addCategory = async (name: string): Promise<Category | null> => {
    const { db, firesqlite } = useDbStore.getState();
    if (!db || !firesqlite) throw new Error("Database not initialized");

    const { doc, setDoc } = firesqlite;

    const newId = `cat-${new Date().getTime().toString()}`;
    const newCategory: Category = {
        id: newId,
        name,
        is_active: true,
    };

    await setDoc(doc(db, 'categories', newCategory.id), newCategory);
    
    return newCategory;
};

export const updateCategory = async (id: string, name: string): Promise<void> => {
    const { db, firesqlite } = useDbStore.getState();
    if (!db || !firesqlite) throw new Error("Database not initialized");

    const { doc, updateDoc } = firesqlite;
    await updateDoc(doc(db, 'categories', id), { name });
};

// Soft delete
export const deleteCategory = async (id: string): Promise<{success: boolean, message?: string}> => {
    const { db, firesqlite } = useDbStore.getState();
    if (!db || !firesqlite) throw new Error("Database not initialized");

    // Check if any product is using this category
    const { collection, getDocs, query, where } = firesqlite;
    const productsRef = collection(db, 'products');
    const q = query(productsRef, where('category_id', '==', id));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
        return { success: false, message: `Cannot delete. ${querySnapshot.size} product(s) are using this category.` };
    }

    const { doc, updateDoc } = firesqlite;
    await updateDoc(doc(db, 'categories', id), { is_active: false });
    return { success: true };
};
