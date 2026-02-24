Berikut adalah **Product Management UI/UX Wireframe & Flow** dengan pendekatan:

- ✅ Split layout (Desktop & Tablet) mirip cashier
- ✅ Main content = Product List (reuse ProductList dari cashier)
- ✅ Search bar + Scan barcode di atas list
- ✅ Right panel tabs: Product | Categories | Modifiers
- ✅ Mobile: Default product list, right panel jadi drawer slide dari kanan
- ✅ Categories & Modifiers: form di atas, list di bawah
- ✅ Product: form di right panel, list tetap di main content
- ✅ Tidak pakai dialog modal

---

# 🎯 DESIGN PRINCIPLE

```text
Consistency with Cashier Layout
Reusable ProductList Component
No layout jump
Fast CRUD workflow
Right panel = contextual editor
```

---

# 🖥 DESKTOP / TABLET MODE (Split Layout)

## 📐 Layout Structure

```text
---------------------------------------------------------------
| SEARCH + SCAN BUTTON + VIEW TOGGLE                         |
---------------------------------------------------------------
| PRODUCT LIST (70%)             | RIGHT PANEL (30%)         |
|                                 |---------------------------|
| Reuse ProductList               | Tabs:                     |
| (Card default desktop)          | [ Product ] [ Categories ]|
|                                 | [ Modifiers ]             |
|                                 |---------------------------|
|                                 | Tab Content Area          |
---------------------------------------------------------------
```

---

# 🔍 TOP BAR (Same as Cashier)

```text
---------------------------------------------------------------
[ 🔍 Search product...          ] [📷 Scan] [☰ View Mode]
---------------------------------------------------------------
```

View mode:
- List
- Thumbnail
- Card (default desktop/tablet)

Search behavior:
- Indexed search
- Debounced 200ms
- Reuse same search hook from cashier

---

# 🧾 MAIN CONTENT (LEFT SIDE)

Uses **ProductList (Reusable)** from cashier.

Modes:
- Desktop default: Card
- Tablet default: Card
- Can toggle

---

## 🖥 ProductList (Card Mode Example)

```text
--------------------------------------------------
|  Image      Coca Cola 330ml    Rp 5.000      |
--------------------------------------------------
|  Image      Cappuccino         Rp 18.000     |
--------------------------------------------------
|  Image      Indomie Goreng     Rp 3.500      |
--------------------------------------------------
```

Tap behavior:
→ Load product data into right panel (Product tab)

---

# 👉 RIGHT PANEL (Desktop / Tablet)

Top section always tabs:

```text
-----------------------------------------
| [ Product ] [ Categories ] [ Modifiers ] |
-----------------------------------------
| Tab Content Area                        |
-----------------------------------------
```

---

# 🧩 TAB 1: PRODUCT (Add/Edit Form)

Main product list tetap di kiri.  
Right panel hanya form.

---

## 🖥 Product Form Wireframe

```text
-----------------------------------------
| PRODUCT FORM                          |
-----------------------------------------

Product Type:
(•) Retail
( ) Food & Beverage

Product Name:
[ ________________________ ]

Category:
[ Select ▼ ]

Base Price:
[ __________ ]

Cost Price:
[ __________ ]

Track Stock:
[ ✓ ]

Initial Stock:
[ ______ ]

Barcode:
[ 1234567890123 ] [ Scan ] [ Generate ]

Enable Variants:
[ ✓ ]

Enable Modifiers:
[ ✓ ]

-----------------------------------------
[ SAVE ]   [ DELETE ]
-----------------------------------------
```

Flow:
- Tap product → load into form
- Tap empty area → clear form for new product

---

# 🧩 TAB 2: CATEGORIES

Form di atas, list di bawah (inside right panel).

---

## 🖥 Categories Wireframe

```text
-----------------------------------------
| CATEGORY FORM                         |
-----------------------------------------

Category Name:
[ ________________________ ]

Icon:
[ Select Icon ]

-----------------------------------------
[ SAVE ]

-----------------------------------------
| CATEGORY LIST                         |
-----------------------------------------
| ☕ Beverages           (15)           |
| 🥤 Retail Drinks       (20)           |
| 🍰 Desserts            (8)            |
-----------------------------------------
```

Tap category:
→ Load to form

Delete:
→ Soft delete

---

# 🧩 TAB 3: MODIFIERS

Form di atas, list di bawah.

---

## 🖥 Modifier Group Wireframe

```text
-----------------------------------------
| MODIFIER GROUP FORM                   |
-----------------------------------------

Group Name:
[ Sugar Level ]

Required:
[ ✓ ]

Min Selection:
[ 1 ]

Max Selection:
[ 1 ]

-----------------------------------------
[ SAVE ]

-----------------------------------------
| MODIFIER GROUP LIST                   |
-----------------------------------------
| Sugar Level       Required 1–1       |
| Ice Level         Required 1–1       |
| Toppings          Optional 0–3       |
-----------------------------------------
```

Tap group:
→ Show items below

---

## 🖥 Modifier Items Section (Expandable)

```text
-----------------------------------------
| Modifier Items (Sugar Level)          |
-----------------------------------------
| Normal            +0                 |
| Less Sugar        +0                 |
| No Sugar          +0                 |
-----------------------------------------
[ + ADD ITEM ]
```

---

# 📱 MOBILE MODE

---

# 📐 Layout Structure

Default view:
→ Product List (Thumbnail mode)

Right panel becomes:
→ Slide drawer from right

---

## 📱 Mobile – Product Management Main

```text
------------------------------------------------
[ 🔍 Search product... ] [📷]
------------------------------------------------
| 🥤 Coca Cola 330ml    Rp 5.000             |
| ☕ Cappuccino         Rp 18.000            |
| 🍜 Indomie Goreng     Rp 3.500             |
------------------------------------------------
[ + Add Product ]   [ ☰ Manage ]
------------------------------------------------
```

Manage button:
→ Opens right drawer

---

# 📱 RIGHT DRAWER (Slide From Right)

```text
----------------------------------------
| [ Product ] [ Categories ] [ Modifiers ]
----------------------------------------
| Tab Content                          |
----------------------------------------
```

Drawer behavior:
- Slide animation
- Not modal dialog
- Overlay but non-blocking main layout

---

## 📱 Product Form (Inside Drawer)

```text
----------------------------------------
Product Name:
[ ____________________ ]

Category:
[ Select ▼ ]

Price:
[ ______ ]

Barcode:
[ ______ ] [ Scan ]

Track Stock:
[ ✓ ]

[ SAVE ]
----------------------------------------
```

---

# 🔁 FLOW SUMMARY

---

## Create Product

```text
Tap + Add Product
→ Open Product Tab
→ Fill Form
→ Save
→ ProductList auto-refresh
```

---

## Edit Product

```text
Tap Product in List
→ Load to Product Tab
→ Edit
→ Save
```

---

## Create Category

```text
Open Categories Tab
→ Fill Form
→ Save
→ Category List update
```

---

## Create Modifier

```text
Open Modifiers Tab
→ Create Group
→ Add Items
→ Assign to Product
```

---

# ⚡ PERFORMANCE DESIGN

---

## 1️⃣ Reuse ProductList

Same component used in:
- Cashier
- Product Management

Props change:
```text
mode
isSelectable
onItemClick
```

---

## 2️⃣ Memoization

```text
React.memo(ProductList)
useMemo(filteredProducts)
useCallback(onItemClick)
```

---

## 3️⃣ Virtualization

- react-window (web)
- FlatList (React Native)

---

## 4️⃣ Avoid Layout Jump

- No modal dialogs
- Right panel persistent
- Drawer instead of navigation

---

# 🧠 STATE MANAGEMENT

```text
activeTab
selectedProductId
searchQuery
filteredProducts
drawerOpen (mobile)
```

---

# 🎨 DEFAULT VIEW SETTINGS

| Device | Default Layout | Default View Mode |
|--------|---------------|------------------|
| Desktop | Split | Card |
| Tablet | Split | Card |
| Mobile | Single Column | Thumbnail |

---

# 🧩 COMPONENT STRUCTURE

```text
ProductManagementScreen
 ├── TopSearchBar
 ├── ProductList (Reusable)
 ├── RightPanel (Desktop/Tablet)
 │      ├── Tabs
 │      ├── ProductForm
 │      ├── CategoryForm + List
 │      ├── ModifierForm + List
 └── DrawerPanel (Mobile)
```

---

# 🎯 UX BENEFITS

- Konsisten dengan cashier
- Cepat navigasi tanpa page change
- Tidak ada dialog pop-up mengganggu
- Responsive layout
- Clean CRUD experience
- Performant meski ribuan produk

---
