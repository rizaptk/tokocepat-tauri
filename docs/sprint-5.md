# 📦 SPRINT 5 – Inventory Control System

🎯 **Goal:** Guarantee stock integrity with real-time, auditable tracking of all inventory movements.

---

### Execution Plan

#### 1️⃣ Automated Stock Deduction
- [ ] In the `checkout` service, after a transaction is successfully created, automatically trigger a stock deduction for each item sold.
- [ ] For each deduction, create a corresponding record in the `StockMovements` table with `type: 'sale'`. This ensures every change is logged.

#### 2️⃣ Manual Stock Adjustment Module
- [ ] Create a dedicated UI view at `/dashboard/inventory` for managing stock.
- [ ] Develop a form within this view for making manual stock adjustments.
- [ ] The form must include:
    - [ ] Product selection.
    - [ ] Adjustment type (e.g., `Initial Balance`, `Correction`, `Lost`, `Damaged`).
    - [ ] Quantity change (positive or negative).
    - [ ] A **required** text field for the adjustment reason to ensure accountability.
- [ ] Submitting the form must update the `stock_qty` in the `Products` table and log the event in the `StockMovements` table.

#### 3️⃣ Low Stock Alerts
- [ ] Implement a configurable low-stock threshold in the `StoreConfig` settings.
- [ ] On the main dashboard, create a dedicated "Low Stock" component that lists all products at or below this threshold.
- [ ] Visually distinguish low-stock items in the POS product grid to alert the cashier.

#### 4️⃣ Advanced Tracking (Optional)
- [ ] Add optional, non-critical fields like `location_bin` to the product schema for future enhancements.

---

### Definition of Done
- [ ] Product stock levels decrease automatically and correctly after every sale.
- [ ] All manual stock adjustments are logged immutably with a reason.
- [ ] A full reconciliation of the `StockMovements` table accurately matches the current `stock_qty` of any product.
- [ ] The dashboard correctly alerts users to low-stock items.