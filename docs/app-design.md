> **Note:** This document was written when the app was planned as a web/mobile app (React Native/Capacitor). The shipped application is a **Tauri 2 desktop + Android app** (React 19 + Vite frontend, Rust backend) with **FireLite** as the embedded encrypted database. The architectural concepts (offline-first, immutable ledger, shift control, snapshot model) remain accurate.

Berikut adalah rancangan arsitektur dan desain sistem untuk aplikasi kasir mobile multi-toko (kafe hingga retail store) berbasis **client-side React** dengan pendekatan **single-device, offline-first, high financial integrity**.

---

# 1️⃣ Arsitektur Sistem (High-Level)

## 🎯 Prinsip Desain
- **Offline-first architecture**
- **Single device – no authentication**
- **High integrity financial control**
- **Modular & scalable (multi-type business)**
- **Optimized for fast cashier workflow**

## 🧱 Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | React Native / React + Capacitor |
| State Management | Zustand |
| Local Database | firesqlite |
| Charts & Analytics | Recharts / Victory Native |
| PDF Export | pdf-lib / react-pdf |
| Excel Export | SheetJS |
| Printer | ESC/POS Bluetooth / USB |
| Barcode Scan | Camera-based scanner (ZXing / MLKit wrapper) |

---

# 2️⃣ Database Design (Offline Persistence)

## Core Tables

### 🏬 Store Config
- store_name
- tax_rate
- currency
- receipt_footer
- printer_config

---

### 📦 Products
- id
- sku
- barcode
- name
- category_id
- base_price
- cost_price
- stock_qty
- track_stock (boolean)
- has_variant (boolean)
- has_modifier (boolean)
- image_url
- is_active

---

### 🎨 Product Variants
- id
- product_id
- name (Size M, Red, etc.)
- additional_price
- sku
- barcode
- stock_qty

---

### ➕ Modifier Groups
- id
- name
- min_select
- max_select
- required (boolean)

### ➕ Modifier Items
- id
- group_id
- name
- additional_price

---

### 🛒 Cart (Pending Support)
- id
- status (active / pending / paid / void)
- created_at
- updated_at

### 🛍 Cart Items
- id
- cart_id
- product_id
- variant_id (nullable)
- qty
- unit_price
- subtotal
- notes

---

### 💰 Transactions
- id
- invoice_number
- subtotal
- tax_amount
- total
- cash_paid
- change
- created_at
- shift_id

---

### 🧾 Transaction Items
- id
- transaction_id
- product_snapshot
- price_snapshot
- cost_snapshot
- qty
- subtotal

(Snapshot penting untuk akuntabilitas historis)

---

### 📊 Stock Movements
- id
- product_id
- type (sale, adjustment, lost, initial_balance)
- qty_change
- reference_id
- created_at

---

### 🕒 Shifts
- id
- opened_at
- opening_cash
- closed_at
- declared_cash
- system_cash
- variance
- status (open/closed)

---

# 3️⃣ Modul Utama Sistem

---

# 🛒 A. Modul Transaksi & Fast Tap Cart

## UI Konsep
Split layout:

| Kiri | Kanan |
|------|--------|
| Product Listing | Cart |

### Fitur:
- Tap produk → langsung masuk cart
- Tap cepat = +1 qty
- Hold = edit qty
- Swipe = hapus
- Pending cart (park transaction)

---

## 🔁 Pending Cart Flow

```
Active Cart
   ↓
Save as Pending
   ↓
Load Pending
   ↓
Checkout
```

---

## 💵 Cash Payment Flow

1. Total muncul besar
2. Input jumlah bayar
3. Auto-calc change
4. Confirm → Print → Save transaction
5. Lock data (tidak bisa edit)

---

# 4️⃣ Open Shift – Close Shift (Kontrol Internal)

## 🟢 Open Shift
- Input beginning balance (cash drawer)
- Generate shift record
- Lock transaksi hanya jika shift open

---

## 🔴 Close Shift
System calculates:
- Total sales
- Total tax
- Expected cash

Kasir input:
- Declared cash

System:
- Variance = declared - expected
- Flag jika tidak nol

---

## Internal Control Features

- Semua transaksi immutable
- Void butuh reason
- Manual stock adjustment butuh reason
- Auto numbering invoice
- Daily summary locked after shift close

---

# 5️⃣ Produk & Modifier Engine

## 🧠 Variant Logic

Jika product.has_variant:
- Pilih variant dulu
- Harga = base_price + additional_price

---

## 🧠 Modifier Logic

Jika has_modifier:
- Modal popup
- Required group harus dipilih
- Validate min/max selection

---

## 💡 Final Price Formula

```
Base price
+ Variant price
+ Sum(modifiers)
= Final unit price
```

---

# 6️⃣ Multi Listing Search Mode

User bisa switch mode:

### 1️⃣ Simple List
- Text only
- Ultra fast

### 2️⃣ Thumbnail List
- Image kecil + nama + harga

### 3️⃣ Card Grid
- Visual store mode (cafe cocok)

---

## 🔎 Search Engine

- Indexed search by name + SKU + barcode
- Auto-complete
- Debounced query

---

# 7️⃣ Stock Control System

## Auto Deduct
Saat transaksi sukses:
→ Insert StockMovement (sale)

## Manual Adjustment
- Lost
- Damage
- Correction
- Beginning stock

---

## Optional Advanced Tracking
- Location bin
- Product placement tagging
- Missing tracking

---

# 8️⃣ Pajak Otomatis

Configurable:
- Inclusive tax
- Exclusive tax

### Formula Exclusive:
```
Tax = subtotal × rate
Total = subtotal + tax
```

### Formula Inclusive:
```
Tax = subtotal × (rate / (1 + rate))
```

---

# 9️⃣ Laporan & Analitik Profesional

## 📊 Dashboard
- Sales Today
- Revenue trend
- Hourly heatmap
- Top products
- Low stock alert
- Profit margin

---

## 📈 Analytical Metrics

- Gross revenue
- Net revenue
- COGS
- Gross profit
- Average order value
- Peak hours
- Product velocity

---

## Export

### Excel:
- Daily sales
- Inventory
- Profit report

### PDF:
- Shift report
- Financial summary
- Audit trail

---

# 🔥 Customer Insights Engine

- Top 10 products
- Slow moving items
- Category performance
- Hourly transaction density
- Trend per week/month

---

# 🖨 Printer Thermal POS

Support:
- ESC/POS command
- Bluetooth
- USB OTG

Receipt contains:
- Store name
- Invoice
- Items
- Tax breakdown
- Cash paid
- Change
- Shift number

---

# 1️⃣0️⃣ Financial Integrity & Audit Layer

Untuk akuntabilitas maksimal:

### 🔐 Data Rules
- Tidak boleh delete transaksi
- Void = reverse transaction
- Stock movement immutable
- Timestamped records

---

# 1️⃣1️⃣ Performance Optimization

- Local SQLite indexing
- Lazy rendering list
- Memoized components
- Batched writes
- Transactional DB commit

---

# 1️⃣2️⃣ Struktur Folder React (Scalable)

```
/app
  /modules
    /products
    /cart
    /transactions
    /inventory
    /shift
    /reports
  /components
  /database
  /services
  /utils
```

---

# 1️⃣3️⃣ Roadmap Pengembangan

## Phase 1
- Core POS
- Cash only
- Offline DB
- Shift control

## Phase 2
- Advanced analytics
- Export
- Printer integration

## Phase 3
- Multi-branch ready
- Cloud sync (optional future)
- Role permission (future)

---

# 🔥 Rekomendasi Final Arsitektur

Untuk kebutuhan Anda (single device, no login, offline full):

> ✅ React Native + SQLite  
> ✅ Strict financial snapshot model  
> ✅ Immutable transaction engine  
> ✅ Shift-based cash control  
> ✅ Offline-first analytics  

---

Jika Anda ingin, saya bisa lanjutkan ke:

- 🔹 ERD diagram lengkap
- 🔹 Flowchart sistem transaksi
- 🔹 Desain UI/UX wireframe
- 🔹 Skema struktur database SQL
- 🔹 Desain arsitektur yang siap production-grade
- 🔹 Breakdown sprint development plan
- 🔹 Atau bantu Anda memecahnya menjadi dokumen PRD profesional untuk investor

Silakan pilih arah berikutnya.