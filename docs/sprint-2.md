# 🛒 SPRINT 2 – Product Module & Search Engine

🎯 **Goal:** Produk bisa dikelola dan ditampilkan dengan performa tinggi.

---

### Execution Plan

#### 1️⃣ Product Management UI
- [x] Create a new page and form at `/dashboard/products/new` for adding products.
- [x] Develop a dynamic route and form at `/dashboard/products/[id]/edit` for modifying existing products.
- [x] Implement a "Delete Product" feature, including a confirmation dialog to prevent accidental deletion.
- [x] Integrate UI components on the product form to manage complex structures like `Variants` and `Modifiers`.
- [x] Add a switch control on the product form to toggle the `track_stock` boolean property.

#### 2️⃣ Product Listing & Display
- [x] Implement a view switcher component on the main POS interface to toggle between list modes.
- [x] Develop the "Simple List" view, showing only product names and prices for maximum density.
- [x] Develop the "Thumbnail List" view, showing a small image, name, and price.
- [x] Refactor the existing `ProductGrid.tsx` component to support the new display modes and the default "Card Grid" view.

#### 3️⃣ Search Engine
- [x] Enhance the product DAO to support indexed searches by `name`, `SKU`, and `barcode`.
- [x] Upgrade the UI search functionality to query against `SKU` and `barcode` fields in addition to `name`.
- [x] Implement debouncing on the search input to prevent excessive queries and improve UI responsiveness.

#### 4️⃣ Performance Optimization
- [x] Expand the database seed script to generate a large dataset (1,000+ products) for performance testing.
- [ ] Analyze list rendering performance and implement UI virtualization (e.g., `react-window`) or infinite scrolling if needed to maintain responsiveness.

---

### Definition of Done
- [x] All CRUD operations for products, including variants and modifiers, are fully functional.
- [x] The POS interface can smoothly switch between all three product listing modes.
- [x] The search functionality is fast and accurate, with a perceived latency of <300ms on a large dataset.
- [ ] The product list remains responsive and fluid, even when displaying over 1,000 items.
