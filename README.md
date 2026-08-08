# TokoCepat POS

**TokoCepat** is a high-performance, offline-first Point of Sale (POS) application designed for a wide range of businesses, from retail stores to cafés and restaurants. Built on a modern tech stack, it prioritizes speed, financial integrity, and the ability to function seamlessly without a constant internet connection.

## ✨ Core Features

-   **Offline-First Operation**: The core POS functionality (sales, cart management, shift control) works entirely offline using **FireLite**, an embedded document database backed by a single encrypted SQLite file.
-   **Fast & Responsive UI**: A cashier-optimized interface built with React, Vite, and Tailwind CSS for rapid sales processing.
-   **Comprehensive Product Management**: Supports retail and F&B product types, including variants, complex modifiers, and recipe-based ingredient tracking.
-   **Robust Inventory Control**: Features automated stock deduction on sales and a manual adjustment module with auditable logging for every stock movement.
-   **Financial Integrity**: Implements a strict shift-based system (Open/Close Shift) for cash reconciliation and an immutable transaction ledger.
-   **Secure Licensing Engine**: A hybrid online/offline licensing system that validates licenses locally after a one-time activation, making it secure and offline-capable.
-   **Automated License Delivery**: A self-service subscription flow where users can submit payment proof and have their license automatically delivered and activated via a secure heartbeat system.
-   **Hardware Integration**: Supports both camera-based and external hardware barcode scanners, as well as thermal receipt printing via ESC/POS (USB, serial, and Bluetooth printers).
-   **Multi-Device Sync**: Two optional replication layers powered by FireLite — **Net Sync** (P2P over LAN, mDNS discovery) and **Cloud Sync** (centralized replication over WebSockets).
-   **In-Depth Reporting**: Provides detailed reports for sales, inventory, stock movements, and ingredient consumption, with options to export to Excel and PDF.

## 🚀 Technical Architecture

TokoCepat is a Tauri 2 desktop (and Android) application with a clean split between a Rust backend and a React frontend.

### Client (Offline Application)

-   **Framework**: Tauri 2 + Rust backend, React 19 frontend built with Vite 7.
-   **UI**: ShadCN UI and Tailwind CSS for a modern, responsive design.
-   **State Management**: Zustand for efficient and centralized state control.
-   **Local Database**: **FireLite** (v0.7.0), an embedded document engine storing data in a single encrypted SQLite file (`tokocepat.db`) inside the app data directory. It provides a Firestore-style API (`collection().doc().set()`, `.where().orderBy()`, real-time snapshots), indexing, aggregation, and encrypted collections (`app_state`, `__firelite_security`).
-   **Data Bridge**: The frontend talks to FireLite through a MessagePack bridge exposed by the Rust `firelite_exec` command.
-   **Offline Licensing**: After a one-time online activation, a signed **JSON Web Token (JWT)** is stored locally in the encrypted database. All subsequent license checks (expiry, device HWID, clock tampering) happen offline using cryptography.

### Backend (Rust + Online Services)

-   **Backend logic**: Tauri commands implemented in Rust (`src-tauri/src/`).
-   **Licensing API**: A set of HTTPS endpoints (deployed separately) for activating, claiming, deactivating, and heartbeating licenses. The license server is the single source of truth for subscriptions.
-   **Sync engine**: FireLite's optional `net-sync` (LAN peer-to-peer) and `cloud-sync` (WebSocket hub/client) replication layers, controlled by start/stop/config commands.

The online license APIs and admin flows live in a separate repository/deployment; this project is the offline POS client.

## Getting Started

1.  Ensure you have Node.js, npm, and the Rust toolchain installed.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Set up your environment variables by copying `.env.example` to `.env`:
    ```bash
    cp .env.example .env
    ```
    - `FIRELITE_ENCRYPTION_KEY`: the key used to encrypt the local database. **If you have an existing database, use the same key it was created with.**
    - `VITE_API_BASE_URL`: the base URL of the license API (optional, defaults to the production server).
4.  Run the development server:
    ```bash
    npm run dev
    ```

The frontend Vite dev server runs on `http://localhost:9002`.