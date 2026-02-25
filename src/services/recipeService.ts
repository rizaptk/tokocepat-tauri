
import { Recipe, RecipeItem } from '@/lib/types';
import { useDbStore } from '@/lib/db-store';

export const setRecipeForProduct = async (productId: string, items: RecipeItem[]): Promise<void> => {
    const { db, firesqlite } = useDbStore.getState();
    if (!db || !firesqlite) throw new Error("Database not initialized");

    const { doc, setDoc, deleteDoc } = firesqlite;
    
    const recipeRef = doc(db, 'recipes', productId);

    if (items.length > 0) {
        const newRecipe: Recipe = {
            product_id: productId,
            items: items,
        };
        await setDoc(recipeRef, newRecipe, { merge: true });
    } else {
        // If items are empty, delete the recipe document.
        await deleteDoc(recipeRef).catch(() => {}); // Ignore error if it doesn't exist
    }
};
