import { Product, ProductVariant, ModifierGroup, StoreConfig, Category, RawIngredient, Recipe, Shift, Transaction, StockMovement } from '@/lib/types';
import { initialProducts, initialVariants, initialModifierGroups, initialCategories, initialRawIngredients } from '@/lib/products';

const DB_VERSION_KEY = 'tokoc_db_version';
const CURRENT_DB_VERSION = '1.0.18'; // New version for simulation

async function ensureIndexes(firesqlite: any, db: any) {
    const { createIndex, collection } = firesqlite;
    
    console.log("Ensuring database indexes...");
    try {
        await Promise.all([
            // For transaction history ordering and filtering
            createIndex(db, collection(db, 'transactions'), 'created_at'),
            
            // For stock movement report filtering
            createIndex(db, collection(db, 'stock_movements'), 'created_at'),
            
            // For product category filtering
            createIndex(db, collection(db, 'products'), 'category_id'),
            
            // For product search by name
            createIndex(db, collection(db, 'products'), 'name'),

            // For variants lookup by product
            createIndex(db, collection(db, 'product_variants'), 'product_id'),
        ]);
        console.log("Database indexes are up to date.");
    } catch (error) {
        console.error("Failed to create indexes:", error);
    }
}


export const seedDatabase = async (firesqlite: any, db: any, force = false) => {
    if (!firesqlite || !db) return;

    try {
        const { collection, doc, getDocs, setDoc, writeBatch } = firesqlite;
        
        const storedVersion = localStorage.getItem(DB_VERSION_KEY);
        
        await ensureIndexes(firesqlite, db);

        if (storedVersion === CURRENT_DB_VERSION && !force) {
            return; // Already up-to-date and not forcing a re-seed.
        }

        console.log('Database version mismatch or not set. Seeding new data...');

        // Clear all business data if we are forcing a re-seed (from reset button)
        if (force) {
             const collectionsToClear = ['products','product_variants','categories','modifier_groups','raw_ingredients','recipes','transactions','stock_movements','shifts','pending_carts','store_config'];
             for (const collectionName of collectionsToClear) {
                const collectionRef = collection(db, collectionName);
                const snapshot = await getDocs(collectionRef);
                if (!snapshot.empty) {
                    const batch = writeBatch(db);
                    snapshot.docs.forEach((d: any) => batch.delete(d.ref));
                    await batch.commit();
                }
             }
             console.log("Forced re-seed: All business data cleared.");
        }
        
        // Seed Categories
        console.log('Seeding initial categories...');
        const categoryBatch = writeBatch(db);
        initialCategories.forEach((c: Category) => categoryBatch.set(doc(db, 'categories', c.id), c));
        await categoryBatch.commit();
        
        // Seed Products
        console.log(`Seeding ${initialProducts.length} products...`);
        const productBatch = writeBatch(db);
        initialProducts.forEach((p: Product) => productBatch.set(doc(db, 'products', p.id), p));
        await productBatch.commit();
        
        // Seed Variants
        console.log('Seeding initial variants...');
        const variantBatch = writeBatch(db);
        initialVariants.forEach((v: ProductVariant) => variantBatch.set(doc(db, 'product_variants', v.id), v));
        await variantBatch.commit();

        // Seed Modifiers
        console.log('Seeding initial modifiers...');
        const modifierBatch = writeBatch(db);
        initialModifierGroups.forEach((g: ModifierGroup) => modifierBatch.set(doc(db, 'modifier_groups', g.id), g));
        await modifierBatch.commit();
        
        // Seed Raw Ingredients
        console.log('Seeding initial raw ingredients...');
        const ingredientBatch = writeBatch(db);
        initialRawIngredients.forEach((ing: RawIngredient) => ingredientBatch.set(doc(db, 'raw_ingredients', ing.id), ing));
        await ingredientBatch.commit();

        // Seed Recipes
        const recipeBatch = writeBatch(db);
        const coffeeRecipe: Recipe = {
            product_id: '9',
            items: [
                { ingredient_id: 'ing-1', quantity: 18 },
                { ingredient_id: 'ing-3', quantity: 10 },
            ]
        };
        recipeBatch.set(doc(db, 'recipes', coffeeRecipe.product_id), recipeBatch);
        await recipeBatch.commit();
        
        // --- Data Simulation ---
        console.log('Simulating historical data...');
        const simBatch = writeBatch(db);

        // 1. Create a closed shift from yesterday
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const shiftStart = new Date(yesterday);
        shiftStart.setHours(9, 0, 0);
        const shiftEnd = new Date(yesterday);
        shiftEnd.setHours(17, 0, 0);

        const simulatedShift: Shift = {
            id: 'sim-shift-1',
            opened_at: shiftStart.toISOString(),
            closed_at: shiftEnd.toISOString(),
            opening_cash: 500000,
            status: 'closed',
            system_cash: 514650,
            declared_cash: 515000,
            variance: 350
        };
        simBatch.set(doc(db, 'shifts', simulatedShift.id), simulatedShift);

        // 2. Create transactions and stock movements
        const product1 = initialProducts.find(p => p.id === '1')!; // Mie
        const product4 = initialProducts.find(p => p.id === '4')!; // Keripik
        
        // TX 1
        const tx1Time = new Date(shiftStart);
        tx1Time.setHours(10, 15, 0);
        const tx1Id = 'sim-tx-1';
        const tx1Total = product1.price * 2;
        const tx1: Transaction = {
            id: tx1Id, invoice_number: 'SIM-INV-001', shift_id: simulatedShift.id, status: 'paid', created_at: tx1Time.toISOString(),
            items: [{ id: 'sim-tx-item-1', transaction_id: tx1Id, product_snapshot: { id: product1.id, name: product1.name, price: product1.price, cost_price: product1.cost_price, imageUrl: product1.imageUrl, imageHint: product1.imageHint, product_type: 'retail' }, price_snapshot: product1.price, cost_snapshot: product1.cost_price, qty: 2, subtotal: tx1Total }],
            subtotal: tx1Total, tax_amount: tx1Total * 0.11, total: tx1Total * 1.11, cash_paid: 10000, change: 10000 - (tx1Total * 1.11)
        };
        simBatch.set(doc(db, 'transactions', tx1.id), tx1);
        simBatch.set(doc(db, 'stock_movements', `sim-sm-${tx1Id}`), { id: `sim-sm-${tx1Id}`, product_id: product1.id, product_name_snapshot: product1.name, type: 'sale', qty_change: -2, reference_id: tx1Id, created_at: tx1Time.toISOString() } as StockMovement);
        simBatch.update(doc(db, 'products', product1.id), { stock: product1.stock - 2 });

        // TX 2
        const tx2Time = new Date(shiftStart);
        tx2Time.setHours(14, 30, 0);
        const tx2Id = 'sim-tx-2';
        const tx2Total = product4.price * 1;
        const tx2: Transaction = {
            id: tx2Id, invoice_number: 'SIM-INV-002', shift_id: simulatedShift.id, status: 'paid', created_at: tx2Time.toISOString(),
            items: [{ id: 'sim-tx-item-2', transaction_id: tx2Id, product_snapshot: { id: product4.id, name: product4.name, price: product4.price, cost_price: product4.cost_price, imageUrl: product4.imageUrl, imageHint: product4.imageHint, product_type: 'retail' }, price_snapshot: product4.price, cost_snapshot: product4.cost_price, qty: 1, subtotal: tx2Total }],
            subtotal: tx2Total, tax_amount: tx2Total * 0.11, total: tx2Total * 1.11, cash_paid: 10000, change: 10000 - (tx2Total * 1.11)
        };
        simBatch.set(doc(db, 'transactions', tx2.id), tx2);
        simBatch.set(doc(db, 'stock_movements', `sim-sm-${tx2Id}`), { id: `sim-sm-${tx2Id}`, product_id: product4.id, product_name_snapshot: product4.name, type: 'sale', qty_change: -1, reference_id: tx2Id, created_at: tx2Time.toISOString() } as StockMovement);
        simBatch.update(doc(db, 'products', product4.id), { stock: product4.stock - 1 });
        
        // 3. Simulate a manual restock
        const product2 = initialProducts.find(p => p.id === '2')!;
        const restockTime = new Date(shiftStart);
        restockTime.setHours(8, 0, 0);
        const smRestock: StockMovement = {
            id: 'sim-sm-restock-1', product_id: product2.id, product_name_snapshot: product2.name, type: 'restock', qty_change: 50,
            reason: 'Shipment received', reference_id: `manual-sim-${Date.now()}`, created_at: restockTime.toISOString()
        };
        simBatch.set(doc(db, 'stock_movements', smRestock.id), smRestock);
        simBatch.update(doc(db, 'products', product2.id), { stock: product2.stock + 50 });
        
        await simBatch.commit();
        console.log("Historical data simulation complete.");

        // Seed Store Config
        const storeConfigRef = doc(db, 'store_config', 'main');
        const initialConfig: StoreConfig = {
            id: 'main', store_name: 'TokoCepat Demo', address: 'Jl. Jenderal Sudirman No. 1, Jakarta',
            tax_rate: 0.11, currency: 'IDR', receipt_footer: 'Thank you for shopping!'
        };
        await setDoc(storeConfigRef, initialConfig);
        console.log("Default store config set.");

        localStorage.setItem(DB_VERSION_KEY, CURRENT_DB_VERSION);
        console.log('Database seeding process complete.');

    } catch (error) {
        console.error("Database seeding failed:", error);
    }
};
