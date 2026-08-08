# TokoCepat - System Blueprint

This document outlines the architectural blueprint for the TokoCepat application. It is designed as a single-device, offline-first Point of Sale (POS) system with a focus on high performance and financial integrity, suitable for various retail environments from cafes to stores.

## 1. Core Principles

- **Offline-First:** Fully functional without an internet connection. All data is stored and managed locally on the device.
- **Single Device Focus:** The architecture is optimized for a standalone POS terminal without requiring user authentication or cloud synchronization.
- **High Financial Integrity:** Employs an immutable transaction ledger. Once a transaction is recorded, it cannot be altered, ensuring data accuracy for auditing and financial control.
- **Speed & Efficiency:** The user interface and workflow are streamlined for fast cashier operations, featuring a "tap-to-add" cart and simplified payment processing.
- **Modular Design:** Built with a modular structure to accommodate different business types and allow for future scalability.

## 2. Technology Stack

> **Note:** Earlier versions of this document described a web-app stack (Next.js/Capacitor + browser SQLite/OPFS). The shipped application is a **Tauri 2 desktop + Android app** with a Rust backend and a React frontend, using **FireLite** for storage.

| Layer              | Technology                        | Purpose                                 |
| ------------------ | --------------------------------- | --------------------------------------- |
| **UI/Frontend**    | React 19 + Vite 7 (Tauri 2)        | Cross-platform user interface           |
| **Backend**        | Rust (Tauri commands)              | DB access, license, printer, sync       |
| **State Mgt**      | Zustand                           | Lightweight, centralized state control  |
| **Local Database** | **FireLite v0.7.0** (embedded)    | Encrypted single-file storage (`tokocepat.db`) |
| **UI Components**  | ShadCN UI & Tailwind CSS          | Modern and consistent design system     |
- **Charts:** Recharts
- **PDF/Excel Export:** `pdf-lib`, `SheetJS`
- **Hardware Integration:** ESC/POS (USB/serial/Bluetooth) via Rust, Camera/`@zxing` for barcode scanning
- **Replication:** FireLite `net-sync` (LAN) and `cloud-sync` (WebSocket) features

## 3. Key Modules & Features

### A. Transaction & POS
- **Fast Tap Cart:** Instantly add items to the cart with a single tap.
- **Cash Payment:** Efficiently process cash payments and calculate change.
- **Pending Carts:** Park active transactions to be resumed later.
- **Immutable Ledger:** All sales are recorded as final, with voids handled as reverse transactions.

### B. Product & Inventory
- **Product Catalog:** Manage products, including SKU, price, and stock levels.
- **Variants & Modifiers:** Support for complex products with options (e.g., sizes, toppings).
- **Stock Control:** Real-time inventory tracking with automatic deduction on sales and support for manual adjustments.
- **Product Search:** Fast, indexed search across products by name, SKU, or barcode.

### C. Financial & Shift Control
- **Shift Management:** Formal "Open Shift" and "Close Shift" workflows.
- **Cash Drawer Control:** Track beginning balance, expected cash at end of day, and declare final cash amount.
- **Variance Reporting:** Automatically calculate and flag discrepancies in cash.

### D. Reporting & Analytics
- **Dashboard:** At-a-glance view of daily sales, top-selling products, and low-stock alerts.
- **Detailed Reports:** Generate reports for sales, inventory, and profit.
- **Data Export:** Export reports to Excel and PDF for analysis and record-keeping.

## 4. Data Model Overview

The local database is structured around these core entities:

- **StoreConfig:** General store settings (e.g., tax rate, currency).
- **Products:** The item catalog.
- **Transactions:** Immutable records of all completed sales.
- **Shifts:** Sessions for cash control, containing opening/closing balances.
- **StockMovements:** A detailed log of all inventory changes.
