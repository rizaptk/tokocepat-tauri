// lib/database.ts

export async function ensureIndexes(firesqlite: any, _db: any) {
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