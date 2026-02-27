# TokoCepat POS

**TokoCepat** is a high-performance, offline-first Point of Sale (POS) application designed for a wide range of businesses, from retail stores to cafés and restaurants. Built on a modern tech stack, it prioritizes speed, financial integrity, and the ability to function seamlessly without a constant internet connection.

## ✨ Core Features

-   **Offline-First Operation**: The core POS functionality (sales, cart management, shift control) is designed to work entirely offline using a browser-based SQLite database.
-   **Fast & Responsive UI**: A cashier-optimized interface built with Next.js, React, and Tailwind CSS for rapid sales processing.
-   **Comprehensive Product Management**: Supports retail and F&B product types, including variants, complex modifiers, and recipe-based ingredient tracking.
-   **Robust Inventory Control**: Features automated stock deduction on sales and a manual adjustment module with auditable logging for every stock movement.
-   **Financial Integrity**: Implements a strict shift-based system (Open/Close Shift) for cash reconciliation and an immutable transaction ledger.
-   **Secure Licensing Engine**: A hybrid online/offline licensing system that validates licenses locally after a one-time activation, making it secure and offline-capable.
-   **Automated License Delivery**: A self-service subscription flow where users can submit payment proof and have their license automatically delivered and activated via a secure heartbeat system.
-   **Hardware Integration**: Supports both camera-based and external hardware barcode scanners, as well as thermal receipt printing via the browser's print API.
-   **Full-Featured Admin Panel**: A secure, server-side section for administrators to manage customers, licenses, subscription plans, and view payment history and online user sessions.
-   **In-Depth Reporting**: Provides detailed reports for sales, inventory, stock movements, and ingredient consumption, with options to export to Excel and PDF.

## 🚀 Technical Architecture

TokoCepat uses a modern, robust architecture designed for both performance and security, with a clear separation between client-side and server-side logic.

### Client-Side (Offline Application)

-   **Framework**: Next.js with the App Router & React
-   **UI**: ShadCN UI and Tailwind CSS for a modern, responsive design.
-   **State Management**: Zustand for efficient and centralized state control.
-   **Offline Database**: **`firesqlite`**, which leverages `wa-sqlite` to run a full SQLite database in the browser's Origin Private File System (OPFS). This is the cornerstone of the offline-first capability, ensuring data persistence and high performance without network dependency.
-   **Offline Licensing**: After a one-time online activation, a signed **JSON Web Token (JWT)** is stored in a tamper-resistant local "secure enclave" (HMAC-signed localStorage). All subsequent license checks (for expiry, device ID, clock tampering) are performed offline using cryptography.

### Server-Side (Online Services & Admin)

The server-side logic is handled by Next.js API Routes and Server Actions, ensuring that no sensitive credentials or admin logic are ever exposed to the client.

-   **Backend Logic**: Next.js API Routes (`/api/*`) written in TypeScript.
-   **Database**: **Firebase Firestore** is used as the central, authoritative database for the admin panel, storing all license, customer, plan, and payment data.
-   **Admin SDK**: The **Firebase Admin SDK** is used exclusively on the server to securely interact with Firestore.
-   **Admin Authentication**: Admin access is secured using **Firebase Authentication**, allowing only designated admin Google accounts to sign in.
-   **Licensing & Heartbeat API**: A set of secure endpoints for:
    -   Activating licenses (manual key or automated).
    -   Deactivating devices.
    -   Receiving "heartbeat" pings from clients to log online presence and deliver newly activated licenses.

## Getting Started

1.  Ensure you have Node.js and npm installed.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Set up your environment variables (`.env` file) for Firebase configuration.
4.  Run the development server:
    ```bash
    npm run dev
    ```

The application will be available at `http://localhost:9002`.
