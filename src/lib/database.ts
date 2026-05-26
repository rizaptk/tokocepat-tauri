// lib/database.ts

import { Recipe, Product } from '@/lib/types';
import { initialProducts, initialVariants, initialModifierGroups, initialCategories, initialRawIngredients } from '@/lib/products';

const DB_VERSION_KEY = 'tokoc_db_version';
const CURRENT_DB_VERSION = '1.0.24'; // Versi baru untuk memicu re-seed otomatis

// --- Helper Local Formatter ---
const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(amount);
};

async function ensureIndexes(firesqlite: any, _db: any) {
    const { createIndex, createCompositeIndex } = firesqlite;
    
    console.log("Ensuring database indexes...");
    try {
        await Promise.all([
            // For transaction history ordering and filtering
            createIndex('transactions', 'created_at'),
            createCompositeIndex('transactions',[{field: 'shift_id', desc: true}, {field: 'created_at', desc: true}]),
            createCompositeIndex('transactions',[{field: 'shift_id', desc: true}, {field: 'status', desc: true}, {field: 'created_at', desc: true}]),
            
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

const getRandomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pickRandom = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

let isSeedingInProgress = false;

export const seedDatabase = async (firesqlite: any, db: any, force = false) => {
    if (!firesqlite || !db || isSeedingInProgress) return;
    
    try {
        const { collection, doc, getDocs, setDoc, writeBatch } = firesqlite;

        if (localStorage.getItem('tokoc_reset_flag') === 'true') {
            console.log("Reset flag detected. Skipping seeding.");
            localStorage.removeItem('tokoc_reset_flag');
            localStorage.setItem('on_seeding','false');
            localStorage.setItem(DB_VERSION_KEY, CURRENT_DB_VERSION);
            return;
        }

        const storedVersion = localStorage.getItem(DB_VERSION_KEY);
        if (storedVersion === CURRENT_DB_VERSION && !force) return;

        isSeedingInProgress = true;
        console.log('Starting Combined Seeding & 31-Day Simulation...');

        await ensureIndexes(firesqlite, db);

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

        // --- 1. DYNAMIC CONSIGNMENT PRODUCT SETUP ---
        const updatedProducts: Product[] = [...initialProducts];
        
        // Convert Product 8 (Telur) to Budi's Consignment (Percentage Split)
        const telurIdx = updatedProducts.findIndex(p => p.id === '8');
        if (telurIdx !== -1) {
            updatedProducts[telurIdx] = {
                ...updatedProducts[telurIdx],
                cost_price: 0, 
                is_consignment: true,
                consignor_name: 'Budi',
                consignment_commission_type: 'percentage',
                consignment_commission_value: 10 // 10% komisi toko
            };
        }

        // Add Sari's Consignment Product (Kue Lapis - Flat Split with Valid Unsplash Image)
        const kueLapis: Product = {
            id: '13', name: 'Kue Lapis (Box)', price: 40000, cost_price: 0, stock: 50,
            imageUrl: "https://images.unsplash.com/photo-1588195538326-c5b1e9f80a1b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=512",
            imageHint: "layered cake",
            track_stock: true, has_variant: false, has_modifier: false, is_active: true,
            product_type: 'retail', category_id: 'cat-2', sku: 'KUE-LAPIS-01',
            is_consignment: true, consignor_name: 'Sari',
            consignment_commission_type: 'flat', consignment_commission_value: 8000
        };

        // Add Sari's Consignment Product (Donat Kentang - Percentage Split with Valid Unsplash Image)
        const donatKentang: Product = {
            id: '14', name: 'Donat Kentang (6 pcs)', price: 30000, cost_price: 0, stock: 40,
            imageUrl: "https://images.unsplash.com/photo-1551024601-bec78aea704b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=512",
            imageHint: "donuts",
            track_stock: true, has_variant: false, has_modifier: false, is_active: true,
            product_type: 'retail', category_id: 'cat-2', sku: 'DONAT-KEN-01',
            is_consignment: true, consignor_name: 'Sari',
            consignment_commission_type: 'percentage', consignment_commission_value: 15
        };

        updatedProducts.push(kueLapis);
        updatedProducts.push(donatKentang);

        // --- 2. SEED BASE METADATA ---
        const mainBatch = writeBatch(db);

        initialCategories.forEach(c => mainBatch.set(doc(db, 'categories', c.id), c));
        updatedProducts.forEach(p => mainBatch.set(doc(db, 'products', p.id), p));
        initialVariants.forEach(v => mainBatch.set(doc(db, 'product_variants', v.id), v));
        initialModifierGroups.forEach(g => mainBatch.set(doc(db, 'modifier_groups', g.id), g));
        initialRawIngredients.forEach(ing => mainBatch.set(doc(db, 'raw_ingredients', ing.id), ing));
        
        const coffeeRecipe: Recipe = {
            product_id: '9',
            items: [{ ingredient_id: 'ing-1', quantity: 18 }, { ingredient_id: 'ing-3', quantity: 10 }]
        };
        mainBatch.set(doc(db, 'recipes', coffeeRecipe.product_id), coffeeRecipe);

        // --- 3. 31-DAY HISTORICAL SIMULATION ---
        const productStock = new Map(updatedProducts.map(p => [p.id, p.stock]));
        const variantStock = new Map(initialVariants.map(v => [v.id, v.stock]));
        const ingredientStock = new Map(initialRawIngredients.map(i => [i.id, i.stock_qty]));

        const txPayloadMap = new Map<string, any>();
        const shiftPayloadMap = new Map<string, any>();

        interface UnpaidItem {
            txId: string;
            itemIndex: number;
            consignorName: string;
            payoutAmount: number;
        }
        const unpaidConsignmentQueue: UnpaidItem[] = [];

        for (let i = 30; i >= 0; i--) {
            const baseDate = new Date();
            baseDate.setDate(baseDate.getDate() - i);
            const dateStr = baseDate.toISOString().split('T')[0];
            
            const shiftOpen = new Date(baseDate);
            shiftOpen.setHours(7, 0, 0, 0); 
            const shiftClose = new Date(baseDate);
            shiftClose.setHours(22, 0, 0, 0);

            const shiftId = `shift-${dateStr}`;
            let dailyTotalSales = 0;

            // Refill standard & consignment inventory periodically
            if ([6,15,22,29].includes(30 - i)) {
                updatedProducts.forEach((p) => {
                    const val = productStock.get(p.id) || 0;
                    const refill = p.is_consignment ? 80 : 120;
                    const reason = p.is_consignment ? `Pengiriman barang titipan: ${p.consignor_name}` : 'Auto restock';

                    productStock.set(p.id, val + refill);
                    mainBatch.set(doc(db, 'stock_movements', `restock-${dateStr}-${p.id}`), {
                        id: `restock-${dateStr}-${p.id}`, 
                        product_id: p.id, 
                        type: 'restock', 
                        qty_change: refill, 
                        reason: reason, 
                        created_at: shiftOpen.toISOString(),
                        product_name_snapshot: p.name
                    });
                });
                ingredientStock.forEach((val, id) => ingredientStock.set(id, val + 10000));
            }

            // Create transactions
            const dailyTxCount = getRandomInt(15, 35);
            for (let t = 0; t < dailyTxCount; t++) {
                const txId = `tx-${dateStr}-${t}`;
                const txTime = new Date(shiftOpen);
                txTime.setMinutes(txTime.getMinutes() + getRandomInt(15, 880));

                const txItems: any[] = [];
                let subtotal = 0;

                const cartSize = getRandomInt(1, 4);
                for (let j = 0; j < cartSize; j++) {
                    // --- FIXED: Picked from updatedProducts to ensure consignment sales occur ---
                    const product = pickRandom(updatedProducts); 
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

                    let costSnapshot = product.cost_price || 0;
                    if (product.is_consignment) {
                        const commType = product.consignment_commission_type;
                        const commVal = product.consignment_commission_value || 0;
                        if (commType === 'percentage') {
                            const storeComm = price * (commVal / 100);
                            costSnapshot = price - storeComm;
                        } else {
                            costSnapshot = Math.max(0, price - commVal);
                        }
                    }

                    const displayName = variant_snapshot ? `${product.name} (${variant_snapshot.name})` : product.name;

                    txItems.push({
                        id: `${txId}-item-${j}`,
                        transaction_id: txId,
                        product_snapshot: {
                            id: product.id,
                            name: displayName,
                            price, 
                            cost_price: costSnapshot, 
                            imageUrl: product.imageUrl, 
                            imageHint: product.imageHint,
                            product_type: product.product_type, 
                            is_composite: product.is_composite, 
                            sku: variant_snapshot ? variant_snapshot.sku : product.sku,
                            is_consignment: product.is_consignment,
                            consignor_name: product.consignor_name,
                            consignment_commission_type: product.consignment_commission_type,
                            consignment_commission_value: product.consignment_commission_value
                        },
                        price_snapshot: price, 
                        cost_snapshot: costSnapshot,
                        qty, 
                        subtotal: itemTotal,
                        is_consignment_settled: product.is_consignment ? false : undefined
                    });

                    if (product.is_consignment) {
                        unpaidConsignmentQueue.push({
                            txId,
                            itemIndex: j,
                            consignorName: product.consignor_name!,
                            payoutAmount: costSnapshot * qty
                        });
                    }

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
                        id: `sm-${txId}-${j}`, 
                        product_id: variant_snapshot?.id || product.id,
                        product_name_snapshot: displayName,
                        type: 'sale', 
                        qty_change: -qty, 
                        reference_id: txId, 
                        reason: `Penjualan: ${displayName}`, 
                        created_at: txTime.toISOString()
                    });
                }

                const tax = subtotal * 0.11;
                const total = subtotal + tax;
                dailyTotalSales += total;

                txPayloadMap.set(txId, {
                    id: txId, invoice_number: `INV-${dateStr.replace(/-/g, '')}-${t.toString().padStart(3, '0')}`,
                    shift_id: shiftId, status: 'paid', items: txItems, subtotal, tax_amount: tax, total,
                    cash_paid: Math.ceil(total / 1000) * 1000, change: (Math.ceil(total / 1000) * 1000) - total,
                    created_at: txTime.toISOString()
                });
            }

            // --- 4. WEEKLY CONSIGNMENT SETTLEMENT SIMULATION ---
            const dayIndex = 30 - i;
            let totalCashOutThisShift = 0;

            if (dayIndex > 0 && dayIndex % 7 === 0) {
                const consignors = ['Budi', 'Sari'];
                consignors.forEach(consignor => {
                    const unpaidItemsForConsignor = unpaidConsignmentQueue.filter(item => item.consignorName === consignor);
                    
                    if (unpaidItemsForConsignor.length > 0) {
                        unpaidItemsForConsignor.forEach(item => {
                            const txPayload = txPayloadMap.get(item.txId);
                            if (txPayload) {
                                const targetItem = txPayload.items[item.itemIndex];
                                targetItem.is_consignment_settled = true;
                                targetItem.consignment_settled_at = shiftOpen.toISOString();
                            }
                            totalCashOutThisShift += item.payoutAmount;
                        });

                        for (let k = unpaidConsignmentQueue.length - 1; k >= 0; k--) {
                            if (unpaidConsignmentQueue[k].consignorName === consignor) {
                                unpaidConsignmentQueue.splice(k, 1);
                            }
                        }
                    }

                    // --- REALISTIC RETUR & RESTOCK ON PAYOUT DAYS ---
                    const vendorProducts = updatedProducts.filter(p => p.is_consignment && p.consignor_name === consignor);
                    vendorProducts.forEach(p => {
                        const leftovers = productStock.get(p.id) || 0;
                        
                        // A. Process Retur
                        if (leftovers > 0) {
                            productStock.set(p.id, 0);
                            mainBatch.set(doc(db, 'stock_movements', `sm-retur-${dateStr}-${p.id}`), {
                                id: `sm-retur-${dateStr}-${p.id}`,
                                product_id: p.id,
                                product_name_snapshot: p.name,
                                type: 'correction',
                                qty_change: -leftovers,
                                reason: `Retur Barang Titipan: ${consignor}`,
                                created_at: shiftOpen.toISOString()
                            });
                        }

                        // B. Process Restok
                        const freshStock = 80;
                        productStock.set(p.id, freshStock);
                        mainBatch.set(doc(db, 'stock_movements', `sm-masuk-${dateStr}-${p.id}`), {
                            id: `sm-masuk-${dateStr}-${p.id}`,
                            product_id: p.id,
                            product_name_snapshot: p.name,
                            type: 'restock',
                            qty_change: freshStock,
                            reason: `Pengiriman barang titipan: ${consignor}`,
                            created_at: shiftOpen.toISOString()
                        });
                    });
                });
            }

            const system_cash = (500000 + dailyTotalSales) - totalCashOutThisShift;

            shiftPayloadMap.set(shiftId, {
                id: shiftId, opened_at: shiftOpen.toISOString(), closed_at: shiftClose.toISOString(),
                opening_cash: 500000, status: 'closed', system_cash,
                declared_cash: system_cash, variance: 0,
                total_cash_out: totalCashOutThisShift 
            });

            console.log(`Day complete: ${dateStr} (Payout Settle: ${formatCurrency(totalCashOutThisShift)})`);
        }

        txPayloadMap.forEach((payload, id) => {
            mainBatch.set(doc(db, 'transactions', id), payload);
        });

        shiftPayloadMap.forEach((payload, id) => {
            mainBatch.set(doc(db, 'shifts', id), payload);
        });

        await mainBatch.commit();

        // 5. FINALIZE STOCK LEVELS & STORE CONFIG
        console.log("Finalizing stock levels...");
        const updateBatch = writeBatch(db);
        
        productStock.forEach((stock, id) => updateBatch.update(doc(db, 'products', id), { stock }));
        variantStock.forEach((stock, id) => updateBatch.update(doc(db, 'product_variants', id), { stock }));
        ingredientStock.forEach((stock_qty, id) => updateBatch.update(doc(db, 'raw_ingredients', id), { stock_qty }));
        
        await setDoc(doc(db, 'store_config', 'main'), {
            id: 'main', store_name: 'TokoCepat Demo', address: 'Jl. Jenderal Sudirman No. 1, Jakarta',
            tax_rate: 0.11, currency: 'IDR', receipt_footer: 'Thank you for shopping!'
        });

        await updateBatch.commit();
        localStorage.setItem(DB_VERSION_KEY, CURRENT_DB_VERSION);
        localStorage.setItem('on_seeding','true');
        console.log("Seeding and simulation complete.");

    } catch (error) {
        console.error("Database seeding failed:", error);
    } finally {
        isSeedingInProgress = false;
    }
};