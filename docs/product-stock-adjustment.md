Berikut adalah **flow manajemen produk & tata kelola stok/inventori** yang dirancang untuk aplikasi kasir mobile single-device (offline-first), cocok untuk retail, café, coffee shop, dan small restaurant.

Struktur ini fokus pada:
- Akurasi finansial
- Kontrol internal
- Auditability
- Fleksibel untuk retail & non-retail
- Siap untuk laporan bulanan inventori

---

# 1️⃣ PRODUCT MANAGEMENT FLOW

## A. Product Lifecycle Flow

```text
Create Product
   ↓
Assign Category
   ↓
Assign Variant (optional)
   ↓
Assign Modifier Group (optional)
   ↓
Assign Barcode/Generate Barcode
   ↓
Define Stock Tracking Method
   ↓
Save → Active
   ↓
Stock Movement (Purchase / Adjustment / Sale)
   ↓
Monthly Closing & Reporting
```

---

# 2️⃣ PRODUCT FORM – FIELD STRUCTURE

Produk harus mendukung:
- Retail berbasis barcode
- Non-retail (café, kitchen production)
- Produk dengan varian
- Produk dengan modifier

---

## A. Basic Product Information

| Field | Type | Keterangan |
|-------|------|------------|
| Product Name | Text | Nama utama |
| SKU | Auto/Manual | Unique code internal |
| Barcode / QR | Scan / Generate | Jika retail |
| Category | Dropdown | Wajib |
| Description | Text | Opsional |
| Thumbnail | Image | Opsional |
| Active Status | Toggle | Aktif / Nonaktif |

---

## B. Pricing Section

| Field | Type | Keterangan |
|-------|------|------------|
| Cost Price | Number | Harga modal |
| Selling Price | Number | Harga jual |
| Tax Type | Dropdown | Include / Exclude PPN |
| Tax Rate | % | Default sesuai sistem |
| Allow Custom Price | Toggle | Untuk kasus fleksibel |

---

## C. Product Type

| Type | Keterangan |
|------|------------|
| Stocked Product | Mengurangi stok |
| Non-Stock Service | Tidak mengurangi stok |
| Raw Material | Bahan baku |
| Composite Product (Recipe) | Mengurangi bahan baku |

---

## D. Variant Section (Optional)

Jika produk memiliki ukuran/warna:

| Field | Type |
|-------|------|
| Variant Group Name | Text (e.g. Size) |
| Variant Options | Small / Medium / Large |
| Variant SKU | Auto |
| Variant Price Adjustment | + / - |
| Variant Barcode | Scan/Generate |

---

## E. Modifier Section (Optional)

| Field | Type |
|-------|------|
| Modifier Group | Multi Select |
| Required / Optional | Toggle |
| Min / Max Selection | Number |

---

## F. Stock Configuration

| Field | Type | Keterangan |
|-------|------|------------|
| Track Stock | Toggle |
| Initial Stock | Number |
| Minimum Stock Alert | Number |
| Storage Location | Dropdown |
| Unit Type | pcs / gram / liter |
| Allow Negative Stock | Toggle |

---

# 3️⃣ STOCK & INVENTORY MANAGEMENT FLOW

## A. Stock Movement Types

Semua perubahan stok harus tercatat sebagai **movement log**:

```text
Opening Balance
Purchase In
Manual Adjustment +
Manual Adjustment -
Sales Auto Deduction
Return In
Return Out
Waste / Spoilage
Transfer (future-ready)
```

---

## B. Stock Management Flow

```text
Open Shift
   ↓
Normal Sales (auto deduct)
   ↓
Manual Adjustment (if needed)
   ↓
Waste Recording (kitchen loss)
   ↓
Stock Count (Cycle Count / Monthly)
   ↓
Variance Detection
   ↓
Adjustment with Reason
   ↓
End of Month Closing
```

---

# 4️⃣ INVENTORY CONTROL LOGIC

## A. Movement Ledger Structure

Setiap produk memiliki:

```
Product Ledger:
Date
Reference Type
Reference ID
Qty In
Qty Out
Balance
User
Reason
```

Contoh:

| Date | Ref | In | Out | Balance |
|------|-----|----|-----|---------|
| 1 Jan | Opening | 100 | - | 100 |
| 1 Jan | Sale | - | 3 | 97 |
| 2 Jan | Purchase | 50 | - | 147 |

---

## B. Stock Accuracy Control

Untuk menjaga akuntabilitas:
- Tidak boleh edit transaksi lama
- Semua koreksi melalui adjustment log
- Setiap adjustment wajib reason
- Closing bulanan lock period

---

# 5️⃣ INVENTORY FLOW – RETAIL VS CAFÉ

## Retail Product

```text
Scan Barcode → Sale → Auto deduct stock
```

Simple deduction per unit.

---

## Café / Kitchen (Recipe Based)

Produk: Cappuccino  
Recipe:
- Coffee Bean 18g
- Milk 150ml
- Sugar 10g

Flow:

```text
Sell Cappuccino
   ↓
System deduct:
Coffee Bean -18g
Milk -150ml
Sugar -10g
```

---

# 6️⃣ MONTHLY STOCK / INVENTORY REPORT

## A. Report Structure

### 1. Stock Summary Report

| Product | Opening | In | Out | Adjustment | Closing |
|---------|---------|----|-----|------------|---------|

---

### 2. Movement Detail Report

Filtered by:
- Date range
- Category
- Location
- Product

---

### 3. Stock Valuation Report

Formula:

```
Closing Stock x Cost Price
```

Output:

| Product | Closing Qty | Cost | Total Value |

Digunakan untuk:
- Neraca
- Laporan akuntan

---

### 4. Slow Moving & Fast Moving

- Top Selling Product
- Dead Stock (no sales 30 days)
- Low Stock Alert

---

# 7️⃣ MONTHLY INVENTORY CLOSING FLOW

```text
End of Month
   ↓
Run Physical Count
   ↓
Input Actual Quantity
   ↓
System Compare:
System Qty vs Actual Qty
   ↓
Variance Calculation
   ↓
Approve Adjustment
   ↓
Lock Period
   ↓
Generate Reports (PDF / Excel)
```

---

# 8️⃣ INVENTORY REPORT EXPORT

Format:

- Excel (.xlsx)
- PDF (summary + charts)

Isi PDF:
- Stock valuation total
- Total inventory value
- Variance summary
- Top product
- Waste percentage

---

# 9️⃣ INTERNAL CONTROL DESIGN

Untuk mencegah fraud & kesalahan:

### A. Rules

- Opening balance hanya saat early open
- Closing wajib declared cash
- Adjustment harus ada reason
- Lock historical data after EOD
- Stock count requires confirmation

---

### B. Audit Trail

Semua perubahan simpan:

```
Timestamp
Device ID
User (optional future multi-user)
Action Type
Old Value
New Value
```

---

# 🔟 PERFORMANCE DESIGN (Offline-First)

- IndexedDB / SQLite local
- Stock ledger indexed by product_id + date
- Monthly aggregation cached
- Memoized report calculation
- Background recalculation on idle

---

# 11️⃣ DATA STRUCTURE (Simplified)

```text
Product
Variant
ModifierGroup
ModifierOption
StockLedger
StockAdjustment
StockCount
Category
StorageLocation
Recipe
```

---

# 12️⃣ RINGKASAN STRUKTUR FLOW

### Produk
Create → Configure → Assign Stock → Sell → Track → Report

### Stok
Opening → Movement → Count → Variance → Close → Report

---
