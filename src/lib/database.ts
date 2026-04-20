import { Recipe } from '@/lib/types';
import { initialProducts, initialVariants, initialModifierGroups, initialCategories, initialRawIngredients } from '@/lib/products';

const DB_VERSION_KEY = 'tokoc_db_version';
const CURRENT_DB_VERSION = '1.0.21'; // New version for simulation

async function ensureIndexes(firesqlite: any, _db: any) {
    const { createIndex, createCompositeIndex } = firesqlite;
    
    console.log("Ensuring database indexes...");
    try {
        await Promise.all([
            // For transaction history ordering and filtering
            createIndex('transactions', 'created_at'),
            
            // For stock movement report filtering
            createIndex('stock_movements', 'created_at'),

            // For stock movement report by product ids filtering (getStockMovementsByProducts)
            createCompositeIndex('stock_movements', [{field: 'product_id', desc: true}, {field: 'created_at', desc: true}]),

            // For product category filtering
            createIndex('products', 'category_id'),
            
            // For product search by name
            createIndex('products', 'name'),

            // For variants lookup by product
            createIndex('product_variants', 'product_id'),

        ]);
        console.log("Database indexes are up to date.");
    } catch (error) {
        console.error("Failed to create indexes:", error);
    }
}

// Helper functions (add these if not already at the top of your file)
const getRandomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pickRandom = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// Protection against React Strict Mode double-execution
let isSeedingInProgress = false;

export const seedDatabase = async (firesqlite: any, db: any, force = false) => {
    if (!firesqlite || !db || isSeedingInProgress) return;
    
    try {
        const { collection, doc, getDocs, setDoc, writeBatch } = firesqlite;

        // 1. Reset Flag Check (Original Logic)
        if (localStorage.getItem('tokoc_reset_flag') === 'true') {
            console.log("Reset flag detected. Skipping seeding.");
            localStorage.removeItem('tokoc_reset_flag');
            localStorage.setItem(DB_VERSION_KEY, CURRENT_DB_VERSION);
            return;
        }

        const storedVersion = localStorage.getItem(DB_VERSION_KEY);
        if (storedVersion === CURRENT_DB_VERSION && !force) return;

        isSeedingInProgress = true;
        console.log('Starting Combined Seeding & 8-Day Simulation...');

        await ensureIndexes(firesqlite, db);

        // 2. Clear Collections (Original Force Logic)
        if (force) {
            const collectionsToClear = ['products','product_variants','categories','modifier_groups','raw_ingredients','recipes','transactions','stock_movements','shifts','pending_carts','store_config'];
            for (const collectionName of collectionsToClear) {
               const snap = await getDocs(collection(db, collectionName));
               if (!snap.empty) {
                   const batch = writeBatch(db);
                   snap.docs.forEach((d: any) => batch.delete(d.ref));
                   await batch.commit();
               }
            }
            console.log("Forced re-seed: Data cleared.");
        }

        // 3. Seed Base Metadata (Original Logic)
        const mainBatch = writeBatch(db);

        initialCategories.forEach(c => mainBatch.set(doc(db, 'categories', c.id), c));
        initialProducts.forEach(p => mainBatch.set(doc(db, 'products', p.id), p));
        initialVariants.forEach(v => mainBatch.set(doc(db, 'product_variants', v.id), v));
        initialModifierGroups.forEach(g => mainBatch.set(doc(db, 'modifier_groups', g.id), g));
        initialRawIngredients.forEach(ing => mainBatch.set(doc(db, 'raw_ingredients', ing.id), ing));
        
        const coffeeRecipe: Recipe = {
            product_id: '9',
            items: [{ ingredient_id: 'ing-1', quantity: 18 }, { ingredient_id: 'ing-3', quantity: 10 }]
        };
        mainBatch.set(doc(db, 'recipes', coffeeRecipe.product_id), coffeeRecipe);
        // await metaBatch.commit();

        // 4. --- 8-DAY HISTORICAL SIMULATION ---
        const productStock = new Map(initialProducts.map(p => [p.id, p.stock]));
        const variantStock = new Map(initialVariants.map(v => [v.id, v.stock]));
        const ingredientStock = new Map(initialRawIngredients.map(i => [i.id, i.stock_qty]));

        // i=7 is 7 days ago, i=0 is Today
        for (let i = 7; i >= 0; i--) {
            // const batch = writeBatch(db);
            const baseDate = new Date();
            baseDate.setDate(baseDate.getDate() - i);
            const dateStr = baseDate.toISOString().split('T')[0];
            
            // Working Hours: 07:00 to 22:00
            const shiftOpen = new Date(baseDate);
            shiftOpen.setHours(7, 0, 0, 0); 
            const shiftClose = new Date(baseDate);
            shiftClose.setHours(22, 0, 0, 0);

            const shiftId = `shift-${dateStr}`;
            let dailyTotalSales = 0;

            // MID-WEEK RESTOCK (Exactly on day 4)
            if (i === 4) {
                console.log(`Restocking products on ${dateStr} to prevent out-of-stock...`);
                productStock.forEach((val, id) => {
                    const refill = 150;
                    productStock.set(id, val + refill);
                    mainBatch.set(doc(db, 'stock_movements', `restock-${dateStr}-${id}`), {
                        id: `restock-${dateStr}-${id}`, product_id: id, type: 'restock', 
                        qty_change: refill, reason: 'Mid-week auto restock', 
                        created_at: shiftOpen.toISOString(),
                        product_name_snapshot: initialProducts.find(p => p.id === id)?.name
                    });
                });
                ingredientStock.forEach((val, id) => ingredientStock.set(id, val + 10000));
            }

            // Create 15-35 transactions spread across working hours
            const dailyTxCount = getRandomInt(15, 35);
            for (let t = 0; t < dailyTxCount; t++) {
                const txId = `tx-${dateStr}-${t}`;
                const txTime = new Date(shiftOpen);
                txTime.setMinutes(txTime.getMinutes() + getRandomInt(15, 880));

                const txItems: any[] = [];
                let subtotal = 0;

                const cartSize = getRandomInt(1, 4);
                for (let j = 0; j < cartSize; j++) {
                    const product = pickRandom(initialProducts);
                    const qty = getRandomInt(1, 2);
                    let price = product.price;
                    let variant_snapshot = null;

                    if (product.has_variant) {
                        const variants = initialVariants.filter(v => v.product_id === product.id);
                        variant_snapshot = pickRandom(variants);
                        price += variant_snapshot.additional_price;
                    }

                    const itemTotal = price * qty;
                    subtotal += itemTotal;

                    txItems.push({
                        id: `${txId}-item-${j}`,
                        transaction_id: txId,
                        product_snapshot: {
                            id: product.id,
                            name: variant_snapshot ? `${product.name} (${variant_snapshot.name})` : product.name,
                            price, cost_price: product.cost_price, imageUrl: product.imageUrl, imageHint: product.imageHint,
                            product_type: product.product_type, is_composite: product.is_composite, sku: variant_snapshot ? variant_snapshot.sku : product.sku
                        },
                        price_snapshot: price, cost_snapshot: product.cost_price,
                        qty, subtotal: itemTotal
                    });

                    // Stock reduction
                    if (product.is_composite && product.id === '9') {
                        coffeeRecipe.items.forEach(ri => {
                            ingredientStock.set(ri.ingredient_id, (ingredientStock.get(ri.ingredient_id) || 0) - (ri.quantity * qty));
                        });
                    } else if (variant_snapshot && variant_snapshot.track_stock) {
                        variantStock.set(variant_snapshot.id, (variantStock.get(variant_snapshot.id) || 0) - qty);
                    } else if (product.track_stock) {
                        productStock.set(product.id, (productStock.get(product.id) || 0) - qty);
                    }
                    
                    mainBatch.set(doc(db, 'stock_movements', `sm-${txId}-${j}`), {
                        id: `sm-${txId}-${j}`, product_id: variant_snapshot?.id || product.id,
                        product_name_snapshot: variant_snapshot ? `${product.name} (${variant_snapshot.name})` : product.name,
                        type: 'sale', qty_change: -qty, reference_id: txId, created_at: txTime.toISOString()
                    });
                }

                const tax = subtotal * 0.11;
                const total = subtotal + tax;
                dailyTotalSales += total;

                mainBatch.set(doc(db, 'transactions', txId), {
                    id: txId, invoice_number: `INV-${dateStr.replace(/-/g, '')}-${t.toString().padStart(3, '0')}`,
                    shift_id: shiftId, status: 'paid', items: txItems, subtotal, tax_amount: tax, total,
                    cash_paid: Math.ceil(total / 1000) * 1000, change: (Math.ceil(total / 1000) * 1000) - total,
                    created_at: txTime.toISOString()
                });
            }

            mainBatch.set(doc(db, 'shifts', shiftId), {
                id: shiftId, opened_at: shiftOpen.toISOString(), closed_at: shiftClose.toISOString(),
                opening_cash: 500000, status: 'closed', system_cash: 500000 + dailyTotalSales,
                declared_cash: 500000 + dailyTotalSales, variance: 0
            });

            // await batch.commit();
            console.log(`Day complete: ${dateStr}`);
        }

        await mainBatch.commit();

        // updates
        console.log("Seeding updates..");
        const updateBatch = writeBatch(db);
        // 5. Finalize Stock Levels & Store Config
        // const finalBatch = writeBatch(db);
        productStock.forEach((stock, id) => updateBatch.update(doc(db, 'products', id), { stock }));
        variantStock.forEach((stock, id) => updateBatch.update(doc(db, 'product_variants', id), { stock }));
        ingredientStock.forEach((stock_qty, id) => updateBatch.update(doc(db, 'raw_ingredients', id), { stock_qty }));
        
        await setDoc(doc(db, 'store_config', 'main'), {
            id: 'main', store_name: 'TokoCepat Demo', address: 'Jl. Jenderal Sudirman No. 1, Jakarta',
            tax_rate: 0.11, currency: 'IDR', receipt_footer: 'Thank you for shopping!'
        });

        await updateBatch.commit();
        localStorage.setItem(DB_VERSION_KEY, CURRENT_DB_VERSION);
        console.log("Seeding process complete.");

    } catch (error) {
        console.error("Database seeding failed:", error);
    } finally {
        isSeedingInProgress = false;
    }
};