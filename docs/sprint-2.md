# 🛒 SPRINT 2 – Product Module & Search Engine

🎯 **Goal:** Produk bisa dikelola dan ditampilkan dengan performa tinggi.

---

### Execution Plan

#### 1️⃣ Product Management UI
- [ ] Create a new page and form at `/dashboard/products/new` for adding products.
- [ ] Develop a dynamic route and form at `/dashboard/products/[id]/edit` for modifying existing products.
- [ ] Implement a "Delete Product" feature, including a confirmation dialog to prevent accidental deletion.
- [ ] Integrate UI components on the product form to manage complex structures like `Variants` and `Modifiers`.
- [ ] Add a switch control on the product form to toggle the `track_stock` boolean property.

#### 2️⃣ Product Listing & Display
- [ ] Implement a view switcher component on the main POS interface to toggle between list modes.
- [ ] Develop the "Simple List" view, showing only product names and prices for maximum density.
- [ ] Develop the "Thumbnail List" view, showing a small image, name, and price.
- [ ] Refactor the existing `ProductGrid.tsx` component to support the new display modes and the default "Card Grid" view.

#### 3️⃣ Search Engine
- [ ] Enhance the product DAO to support indexed searches by `name`, `SKU`, and `barcode`.
- [ ] Upgrade the UI search functionality to query against `SKU` and `barcode` fields in addition to `name`.
- [ ] Implement debouncing on the search input to prevent excessive queries and improve UI responsiveness.

#### 4️⃣ Performance Optimization
- [ ] Expand the database seed script to generate a large dataset (1,000+ products) for performance testing.
- [ ] Analyze list rendering performance and implement UI virtualization (e.g., `react-window`) or infinite scrolling if needed to maintain responsiveness.

---

### Definition of Done
- [ ] All CRUD operations for products, including variants and modifiers, are fully functional.
- [ ] The POS interface can smoothly switch between all three product listing modes.
- [ ] The search functionality is fast and accurate, with a perceived latency of <300ms on a large dataset.
- [ ] The product list remains responsive and fluid, even when displaying over 1,000 items.