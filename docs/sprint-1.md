# 🧱 SPRINT 1 – Project Foundation & Architecture

🎯 **Goal:** Menyiapkan fondasi aplikasi dan database offline-first.

---

### Execution Plan

#### 1️⃣ Project Setup
- [ ] Initialize modular folder structure within `src/` for `modules`, `database`, `services`, `lib`, and `context`.
- [ ] Migrate existing `StoreContext` to a more robust state management solution using Zustand in `src/lib/store.ts`.
- [ ] Set up `firesqlite` integration for offline database persistence in a new `src/lib/database.ts` file.
- [ ] Define and implement a Data Access Object (DAO) pattern by creating service layers (e.g., `productService.ts`, `transactionService.ts`) within `src/services/`.

#### 2️⃣ Database Schema (Core Tables)
- [ ] In `src/lib/database.ts`, define and initialize the schema for `StoreConfig`.
- [ ] Define and initialize schemas for `Products`, `ProductVariants`, `ModifierGroups`, and `ModifierItems`.
- [ ] Define and initialize schemas for `Cart` and `CartItems` to support pending cart functionality.
- [ ] Define and initialize schemas for immutable `Transactions` and `TransactionItems` (with product data snapshots).
- [ ] Define and initialize the schema for `Shifts` to manage cashier sessions.
- [ ] Define and initialize the schema for `StockMovements` to log all inventory changes.

#### 3️⃣ Infrastructure
- [ ] Create a database seeding function in `src/lib/database.ts` to populate tables with initial dummy data.
- [ ] Refactor the application to fetch initial data from the `firesqlite` database via the service layer instead of static files.
- [ ] Implement a global error handler or boundary to gracefully manage application-wide errors.

---

### Definition of Done
- [ ] Database service layer can perform all CRUD (Create, Read, Update, Delete) operations on core tables.
- [ ] Application state is successfully managed by Zustand.
- [ ] Data persists offline and is correctly loaded on application startup.
- [ ] The application boots without any setup-related crashes.