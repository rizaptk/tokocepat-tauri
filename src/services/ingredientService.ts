
import { RawIngredient } from '@/lib/types';
import { useDbStore } from '@/lib/db-store';

type IngredientFormData = Omit<RawIngredient, 'id'>;

export const addIngredient = async (formData: IngredientFormData): Promise<void> => {
    const { db, firesqlite } = useDbStore.getState();
    if (!db || !firesqlite) throw new Error("Database not initialized");

    const { doc, setDoc } = firesqlite;
    const newId = `ing-${crypto.randomUUID().slice(0, 8)}`;
    const newIngredient: RawIngredient = {
        id: newId,
        ...formData
    };

    await setDoc(doc(db, 'raw_ingredients', newId), newIngredient);
};

export const updateIngredient = async (id: string, formData: IngredientFormData): Promise<void> => {
    const { db, firesqlite } = useDbStore.getState();
    if (!db || !firesqlite) throw new Error("Database not initialized");

    const { doc, updateDoc } = firesqlite;
    await updateDoc(doc(db, 'raw_ingredients', id), formData);
};

export const deleteIngredient = async (id: string): Promise<void> => {
    const { db, firesqlite } = useDbStore.getState();
    if (!db || !firesqlite) throw new Error("Database not initialized");
    // TODO: Add check to prevent deletion if ingredient is used in a recipe
    
    const { doc, deleteDoc } = firesqlite;
    await deleteDoc(doc(db, 'raw_ingredients', id));
};
