# 📦 SPRINT 2-A – Advanced Product & Stock Management

🎯 **Goal:** Implement the complete product and inventory management system as defined in `stocks-management.md`, covering categories, variants, modifiers, and auditable stock control.

---

### Execution Plan

#### 1️⃣ Category Management
- [x] Create a new database schema for `Categories` in `src/lib/types.ts`.
- [x] Create a new service `categoryService.ts` for all CRUD operations.
- [x] Develop a new page at `/dashboard/categories` to list, add, edit, and delete categories.
- [x] Implement a soft-delete mechanism (`is_active` flag) and prevent deletion if a category contains products.
- [x] Integrate a category selection dropdown into the "Add/Edit Product" form.

#### 2️⃣ Core Product Enhancements
- [x] Add a `product_type` field ('retail' vs 'food_and_beverage') to the `Product` schema in `src/lib/types.ts`.
- [x] Update the "Add/Edit Product" form to include the `product_type` radio button selector.
- [x] Conditionally render form fields based on the selected `product_type` (e.g., show barcode options for 'retail', modifier options for 'F&B').
- [x] Add a `cost_price` field to the Product schema and form to enable profit tracking.
- [x] Add a `low_stock_alert` field to the Product schema and form.

#### 3️⃣ Variant & Modifier Engine
- [x] **Variants:**
    - [x] Add a "Has Variants" toggle to the product form.
    - [x] When enabled, create a sub-form to dynamically add/edit/remove variants (Name, Additional Price, SKU, Stock).
    - [x] Implement logic to disable parent product stock tracking if variants are enabled and track stock per-variant instead.
    - [x] Update `productService` to handle the nested variant data during product creation and updates.
- [x] **Modifiers:**
    - [x] Create a new page at `/dashboard/modifiers` for managing global modifier groups.
    - [x] Implement full CRUD for `ModifierGroups` (Name, Min/Max Select, Required).
    - [x] Within the modifier management page, implement full CRUD for `ModifierItems` (Name, Additional Price) nested under each group.
    - [x] On the "Add/Edit Product" page (for F&B products), add a multi-select component to associate existing modifier groups with the product.
    - [x] Update `productService` to handle saving the association between products and modifier groups.

#### 4️⃣ Barcode / QR System
- [x] Add `barcode` and `sku` fields to the `Product` and `ProductVariant` schemas.
- [x] Implement a "Scan Barcode" button that opens the camera modal (integration with a scanning library can be a separate task).
- [x] Add a button to auto-generate a unique internal barcode/SKU if none is provided.
- [x] Implement a backend check in `productService` to ensure all barcodes and SKUs are unique across all products and variants.

#### 5️⃣ Inventory & Stock Management
- [x] Create a new page at `/dashboard/inventory` to serve as the stock management dashboard.
- [x] The inventory dashboard should list all stock-tracked products and their current quantities.
- [x] Create a "Manual Stock Adjustment" form/modal accessible from the inventory dashboard.
- [x] The adjustment form must include: product selection, adjustment type (`restock`, `lost`, `damaged`, `correction`), quantity, and a required `reason` field.
- [x] Create a `stockService.ts` to handle adjustments. This service must:
    - [x] Update the `stock` property on the `Product` or `ProductVariant`.
    - [x] Create an immutable record in the `StockMovements` table for every adjustment, capturing the reason and quantity change.

#### 6️⃣ UI/UX Polish & Integration
- [x] On the main `/dashboard` page, add a "Low Stock Items" card that lists all products at or below their `low_stock_alert` threshold.
- [x] In the POS/Cashier grid view, add a visual indicator (e.g., a red border or badge) for products that are out of stock or low on stock.
- [x] Update the product list on the main stock management page (`/dashboard/products`) to show stock status more clearly (e.g., quantity for tracked items, "Untracked" for others).

---

### Definition of Done
- [x] All product CRUD operations, including for variants and modifiers, are fully functional and align with `stocks-management.md`.
- [x] A complete, auditable trail of all stock changes is recorded in the `StockMovements` table.
- [x] The UI provides clear feedback for different product types, stock levels, and configurations.
- [x] All new pages are integrated into the main application navigation.
