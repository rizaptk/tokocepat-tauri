
import { Product, ProductVariant, ModifierGroup, StoreConfig, Category, RawIngredient } from '@/lib/types';
import { initialProducts, initialVariants, initialModifierGroups, initialCategories, initialRawIngredients } from '@/lib/products';

const DB_VERSION_KEY = 'tokoc_db_version';
const CURRENT_DB_VERSION = '1.0.15'; // Added raw ingredients

export const seedDatabase = async (firesqlite: any, db: any) => {
    if (!firesqlite || !db) return;

    try {
        const { collection, doc, getDocs, setDoc, deleteDoc, writeBatch } = firesqlite;
        
        const storedVersion = localStorage.getItem(DB_VERSION_KEY);
        if (storedVersion === CURRENT_DB_VERSION) {
            return;
        }

        console.log('Database version mismatch or not set. Seeding new data...');

        // Clear existing data before seeding
        console.log('Clearing existing product data...');
        const productsCollectionRef = collection(db, 'products');
        const existingProdsSnapshot = await getDocs(productsCollectionRef);
        if (existingProdsSnapshot.docs.length > 0) {
            const deletePromises = existingProdsSnapshot.docs.map((d: any) => deleteDoc(doc(db, 'products', d.id)));
            await Promise.all(deletePromises);
            console.log(`${deletePromises.length} existing products cleared.`);
        }
        
        const variantsCollectionRef = collection(db, 'product_variants');
        const existingVariantsSnapshot = await getDocs(variantsCollectionRef);
        if (existingVariantsSnapshot.docs.length > 0) {
            const deletePromises = existingVariantsSnapshot.docs.map((d: any) => deleteDoc(doc(db, 'product_variants', d.id)));
            await Promise.all(deletePromises);
            console.log(`${deletePromises.length} existing variants cleared.`);
        }


        // Seed Categories
        const categoriesCollectionRef = collection(db, 'categories');
        const existingCats = await getDocs(categoriesCollectionRef);
        if (existingCats.docs.length === 0) {
            console.log('Seeding initial categories...');
            const categoryBatch = writeBatch(db);
            initialCategories.forEach((c: Category) => {
                categoryBatch.set(doc(db, 'categories', c.id), c);
            });
            await categoryBatch.commit();
        }
        
        // Seed Products in chunks
        console.log(`Seeding ${initialProducts.length} products...`);
        const CHUNK_SIZE = 100;
        for (let i = 0; i < initialProducts.length; i += CHUNK_SIZE) {
            const chunk = initialProducts.slice(i, i + CHUNK_SIZE);
            const productBatch = writeBatch(db);
            chunk.forEach((p: Product) => {
                productBatch.set(doc(db, 'products', p.id), p);
            });
            await productBatch.commit();
        }
        console.log('Product seeding complete.');
        
        // Seed Variants
        console.log('Seeding initial variants...');
        const variantBatch = writeBatch(db);
        initialVariants.forEach((v: ProductVariant) => {
            variantBatch.set(doc(db, 'product_variants', v.id), v);
        });
        await variantBatch.commit();

        // Seed Modifiers
        const modifiersCollectionRef = collection(db, 'modifier_groups');
        const existingModifiers = await getDocs(modifiersCollectionRef);
        if (existingModifiers.docs.length === 0) {
            console.log('Seeding initial modifiers...');
            const modifierBatch = writeBatch(db);
            initialModifierGroups.forEach((g: ModifierGroup) => {
                modifierBatch.set(doc(db, 'modifier_groups', g.id), g);
            });
            await modifierBatch.commit();
        }
        
        // Seed Raw Ingredients
        const ingredientsCollectionRef = collection(db, 'raw_ingredients');
        const existingIngredients = await getDocs(ingredientsCollectionRef);
        if (existingIngredients.docs.length === 0) {
            console.log('Seeding initial raw ingredients...');
            const ingredientBatch = writeBatch(db);
            initialRawIngredients.forEach((ing: RawIngredient) => {
                ingredientBatch.set(doc(db, 'raw_ingredients', ing.id), ing);
            });
            await ingredientBatch.commit();
        }

        // Seed Store Config
        const storeConfigRef = doc(db, 'store_config', 'main');
        const configSnap = await getDocs(collection(db, 'store_config'));
        if (configSnap.docs.length === 0) {
            console.log('Seeding initial store config...');
            const initialConfig: StoreConfig = {
                id: 'main',
                store_name: 'TokoCepat',
                tax_rate: 0.11,
                currency: 'IDR',
                receipt_footer: 'Terima kasih telah berbelanja!'
            };
            await setDoc(storeConfigRef, initialConfig);
        }

        localStorage.setItem(DB_VERSION_KEY, CURRENT_DB_VERSION);
        console.log('Database seeding process complete.');

    } catch (error) {
        console.error("Database seeding failed:", error);
    }
};
