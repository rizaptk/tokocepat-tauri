import { Product, ProductVariant, ModifierGroup, StoreConfig } from '@/lib/types';
import { initialProducts, initialVariants, initialModifierGroups } from '@/lib/products';

const DB_VERSION_KEY = 'tokoc_db_version';
const CURRENT_DB_VERSION = '1.0.3';

export const seedDatabase = async (firesqlite: any, db: any) => {
    if (!firesqlite || !db) return;

    try {
        const { collection, doc, getDocs, setDoc } = firesqlite;
        
        const storedVersion = localStorage.getItem(DB_VERSION_KEY);
        if (storedVersion === CURRENT_DB_VERSION) {
            console.log("Database version is up to date.");
            return;
        }

        console.log('Database version mismatch or not set. Seeding data...');
        
        // Seed Products
        const productsCollectionRef = collection(db, 'products');
        const existingProds = await getDocs(productsCollectionRef);
        if (existingProds.docs.length === 0) {
            console.log('Seeding initial products...');
            const productPromises = initialProducts.map((p: Product) => setDoc(doc(db, 'products', p.id), p));
            await Promise.all(productPromises);
        }
        
        // Seed Variants
        const variantsCollectionRef = collection(db, 'product_variants');
        const existingVariants = await getDocs(variantsCollectionRef);
        if (existingVariants.docs.length === 0) {
            console.log('Seeding initial variants...');
            const variantPromises = initialVariants.map((v: ProductVariant) => setDoc(doc(db, 'product_variants', v.id), v));
            await Promise.all(variantPromises);
        }

        // Seed Modifiers
        const modifiersCollectionRef = collection(db, 'modifier_groups');
        const existingModifiers = await getDocs(modifiersCollectionRef);
        if (existingModifiers.docs.length === 0) {
            console.log('Seeding initial modifiers...');
            const modifierPromises = initialModifierGroups.map((g: ModifierGroup) => setDoc(doc(db, 'modifier_groups', g.id), g));
            await Promise.all(modifierPromises);
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
        console.log('Seeding complete.');

    } catch (error) {
        console.error("Database seeding failed:", error);
    }
};
