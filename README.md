# TokoCepat POS v0.4.0

**TokoCepat** is a high-performance, offline-first Point of Sale (POS) application designed for retail stores, cafés, and restaurants. Built on a modern tech stack, it prioritizes speed, financial integrity, and the ability to function seamlessly without a constant internet connection.

---

## ✨ Core Features

- **Offline-First Operation**: Core POS functionality (sales, cart management, shift control) works entirely offline using **FireLite**, an embedded document database backed by a single encrypted SQLite file.
- **Fast & Responsive UI**: Cashier-optimized interface built with React 19, Vite 7, and Tailwind CSS for rapid sales processing.
- **Comprehensive Product Management**: Supports retail and F&B product types, including variants, complex modifiers, and recipe-based ingredient tracking.
- **Robust Inventory Control**: Automated stock deduction on sales and a manual adjustment module with auditable logging for every stock movement.
- **Financial Integrity**: Strict shift-based system (Open/Close Shift) for cash reconciliation and an immutable transaction ledger.
- **Secure Licensing Engine**: Hybrid online/offline licensing with one-time activation; all subsequent checks (expiry, device HWID, clock tampering) happen offline via cryptography.
- **Automated License Delivery**: Self-service subscription flow where users submit payment proof and receive their license automatically via a secure heartbeat system.
- **Hardware Integration**: Camera-based and external hardware barcode scanners, thermal receipt printing via ESC/POS (USB, serial, Bluetooth printers).
- **Multi-Device Sync**: Optional replication layers — **Net Sync** (P2P over LAN, mDNS discovery) and **Cloud Sync** (centralized WebSocket replication).
- **In-Depth Reporting**: Sales, inventory, stock movements, ingredient consumption with Excel/PDF export.
- **✅ Full Promo System (v0.4.0)**: Voucher codes, per-row manual discounts, automatic product discounts, BOGO, criteria/conditional promos — all stack correctly and apply at the cashier in real time.

---

## 🛠️ Cashier Keyboard Shortcuts (Classic Mode)

| Key | Action |
|-----|--------|
| **F1** | Focus product search / scan |
| **F2** | Open transaction history (current shift) |
| **F3** | Park current cart |
| **F4** | Open Return / Retur dialog |
| **F5** | **Voucher** — type code, press **Enter** or **Selesai** to claim (draft not applied until confirmed) |
| **F6** | **Diskon Kasir** — applies **only to the highlighted row**; select a row first, then enter % or Rp amount |
| **F8** | Focus / toggle **Bayar** (cash input) |

---

## 💰 Discount Engine (v0.4.0)

The engine evaluates discounts **in order** on the current cart:

1. **Auto Diskon Produk** (`flat` / `criteria` / `conditional`): money-off or BOGO on scoped products/categories. One diskon per line (best value wins).
2. **Voucher** (`voucher`): percentage or flat Rp, optionally scoped. Stacks on top of the single diskon per line.
3. **Diskon Kasir** (manual): flat Rp or % — **applies only to the currently highlighted row** (F6). Clears with "Hapus" in the payment bar.

**Stacking rules**: A line receives at most **one auto diskon** (money-off OR free units). A voucher may stack on top. Diskon kasir is distributed across the target line (or whole cart if no row selected — legacy fallback). Free items from BOGO are granted to lines without any diskon.

**Checkout** re-evaluates with authoritative DB usage counts for voucher caps.

---

## 🔁 Returns (Retur)

- Enter invoice number or scan barcode in the Retur dialog (F4).
- Select lines and quantities to return.
- Refund is calculated on the **net price actually paid** (`price − unit_discount`), so free/discounted units return 0 cash but restock correctly.
- A separate `return` transaction is created (negative amounts) so reports net automatically.
- Original transaction is never modified.

---

## 🧾 Receipts

Both on-screen (virtual tape) and physical ESC/POS receipts show:

- Per-line net total (gross − discount)
- Voucher code (if applied)
- Promo & Diskon Produk breakdown
- Diskon Kasir breakdown
- Tax by rate group
- Cash / Change

---

## 🏗️ Technical Architecture

### Client (Offline Application)

- **Framework**: Tauri 2 + Rust backend, React 19 frontend built with Vite 7.
- **UI**: ShadCN UI and Tailwind CSS for a modern, responsive design.
- **State Management**: Zustand for efficient, centralized state control.
- **Local Database**: **FireLite** (embedded document engine) storing data in a single encrypted SQLite file (`tokocepat.db`). Provides a Firestore-style API (`collection().doc().set()`, `.where().orderBy()`, real-time snapshots), indexing, aggregation, and encrypted collections (`app_state`, `__firelite_security`).
- **Data Bridge**: Frontend talks to FireLite through a MessagePack bridge exposed by the Rust `firelite_exec` command.
- **Offline Licensing**: After one-time online activation, a signed **JSON Web Token (JWT)** is stored locally in the encrypted DB. All subsequent license checks (expiry, device HWID, clock tampering) happen offline via cryptography.

### Backend (Rust + Online Services)

- **Tauri Commands**: Implemented in Rust (`src-tauri/src/`).
- **Licensing API**: HTTPS endpoints (deployed separately) for activating, claiming, deactivating, and heartbeating licenses. The license server is the single source of truth for subscriptions.
- **Sync Engine**: FireLite's optional `net-sync` (LAN peer-to-peer) and `cloud-sync` (WebSocket hub/client) replication layers, controlled by start/stop/config commands.

> The online license APIs and admin flows live in a separate repository/deployment; this project is the offline POS client.

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+, npm
- Rust toolchain (stable)
- Tauri prerequisites for your platform

### Install

```bash
git clone https://github.com/rizaptk/tokocepat-tauri.git
cd tokocepat-tauri
npm install
```

### Environment

```bash
cp .env.example .env
```

Required variables:
- `FIRELITE_ENCRYPTION_KEY` — key used to encrypt the local database. **If you have an existing database, use the same key it was created with.**
- `VITE_API_BASE_URL` — base URL of the license API (optional, defaults to production server).

### Development

```bash
npm run dev
```

Frontend Vite dev server runs on `http://localhost:9002`. The Tauri app window will open automatically.

### Production Build

```bash
npm run build
npm run tauri build
```

Outputs a signed installer/bundle in `src-tauri/target/release/bundle/`.

---

## 📁 Key Project Structure

```
src/
├── lib/
│   ├── store.ts           # Zustand state (cart, promos, transactions, shifts, etc.)
│   ├── promo-model.ts     # normalizePromo, isPromoLive, date sanitizer
│   ├── promoService.ts    # evaluateDiscounts — core discount engine
│   ├── tauri.ts           # FireLite bridge (MessagePack, snapshot deltas)
│   └── defaults.ts        # DEFAULT_STORE_CONFIG
├── pages/
│   ├── ClassicCashierPage.tsx   # Main cashier (table, payment bar, F5/F6 modals)
│   └── Dashboard/
│       └── promos/page.tsx      # Promo editor (voucher, flat, bogo, criteria, conditional)
├── services/
│   ├── promoService.ts      # Discount evaluation
│   ├── transactionService.ts # Checkout, void, returns
│   └── returnService.ts     # Retur transaction creation
└── components/
    ├── ReceiptTape.tsx      # On-screen / virtual receipt
    ├── ReturnDialog.tsx     # Retur flow (F4)
    └── VariantPanel.tsx     # Product variant selection
```

---

## 🧪 Quality Gates

```bash
npm run typecheck      # TypeScript strict (zero errors)
npm run lint           # ESLint (zero warnings)
npm run build          # Vite production build
```

Detector baseline: 25 advisories (design-system-color false positives only; no logic regressions).

---

## 📝 Version History

| Version | Date | Highlights |
|---------|------|------------|
| **0.4.0** | 2026-08-26 | **Promo system fully working**: voucher claim-on-confirm, per-row diskon kasir, auto promos (flat/bogo/criteria/conditional), retur net refund, receipt breakdown; fixed `filter(isPromoLive)` callback-index bug, seeded `store_config/main`, `_time`-less delta acceptance, malformed date sanitizer, panel-scope sync. |
| 0.3.4 | 2026-08-25 | Payment rail cleanup, fixed qty column, retur table, diskon toggle, inventory alasan removal. |
| 0.3.3 | 2026-08-24 | Cashier top payment bar, multi-search worksheet, per-row catatan, products barcode/composite indexes. |
| 0.3.2 | 2026-08-20 | Exclusive inventory modes (count vs rapid). |
| 0.3.1 | 2026-08-15 | FireLite integration, offline licensing, Net/Cloud sync. |

---

## 📄 License

Proprietary — TokoCepat POS. All rights reserved.