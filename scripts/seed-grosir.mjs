#!/usr/bin/env node
/**
 * Seed Grosir — Multi-UOM + Wholesale + Customer demo data for firelite-cli
 * 
 * Usage:
 *   node scripts/seed-grosir.mjs [--db "C:\\Users\\...\\tokocepat.db"] [--catalog-offset 0]
 *   # then inject:
 *   for file in seed/*.json; do firelite-cli --db tokocepat.db set --fromfile $file; done
 *   # or on Windows PowerShell:
 *   Get-ChildItem seed/*.json | ForEach-Object { firelite-cli --db tokocepat.db set --fromfile $_.FullName }
 * 
 * Output: seed/products.json, seed/customers.json, seed/customer_groups.json, seed/promos.json
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const seedDir = join(projectRoot, 'seed');
const defaultDb = 'C:\\Users\\Atin Nayiroh\\AppData\\Roaming\\com.tokocepat.desktop\\tokocepat.db';

const dbPath = process.argv.find(a => a === '--db' ? true : false) ? process.argv[process.argv.indexOf('--db') + 1] : defaultDb;

function randomPrice(min = 5000, max = 80000) {
  const v = Math.floor(Math.random() * (max - min) / 500) * 500 + min;
  return v;
}
function pickRandom(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

let catalog = [];
const catalogPath = join(projectRoot, 'src-tauri/resources/indonesian-catalog.json');
if (existsSync(catalogPath)) {
  try {
    const raw = readFileSync(catalogPath, 'utf-8');
    const parsed = JSON.parse(raw);
    catalog = Array.isArray(parsed) ? parsed : parsed.products || parsed.items || [];
    console.log(`Catalog loaded: ${catalog.length} items from ${catalogPath}`);
  } catch (e) {
    console.warn('Failed to parse catalog, using fallback:', e.message);
  }
}
if (catalog.length === 0) {
  // Fallback: try firelite-cli query? We'll generate dummy catalog-like items
  console.log('Using fallback dummy catalog (15 items)');
  catalog = Array.from({ length: 20 }, (_, i) => ({
    id: `cat-fallback-${i}`,
    barcode: `899123456${String(i).padStart(4, '0')}`,
    name: `Produk Katalog ${i + 1}`,
    brand: ['Indofood', 'Unilever', 'Wings', 'Mayora'][i % 4],
    category_id: `cat-${i % 3}`,
    category_name: ['Makanan Instan', 'Minuman', 'Sembako'][i % 3],
    price: randomPrice(8000, 30000),
    cost_price: randomPrice(5000, 20000),
    stock: 100,
    low_stock_alert: 10,
    track_stock: true,
    is_active: true,
    has_variant: false,
    image_url: '',
  }));
}

// Pick 15-20 catalog items with offsets for randomness (as user suggested: query several offsets)
const offsets = [0, 40, 80];
let selectedCatalog = [];
for (const off of offsets) {
  selectedCatalog.push(...catalog.slice(off, off + 7));
  if (selectedCatalog.length >= 18) break;
}
selectedCatalog = selectedCatalog.slice(0, 18);
if (selectedCatalog.length < 15) {
  selectedCatalog = pickRandom(catalog, Math.min(18, catalog.length));
}
console.log(`Selected ${selectedCatalog.length} catalog items for products`);

mkdirSync(seedDir, { recursive: true });

// --- Products from catalog (with UOM & wholesale) ---
const products = [];
for (let i = 0; i < selectedCatalog.length; i++) {
  const c = selectedCatalog[i];
  const id = `prod-${String(i + 1).padStart(4, '0')}-${c.id?.slice(0, 6) || 'cat'}`;
  const basePrice = c.price ? Math.round(c.price * 1.0) : randomPrice(10000, 35000);
  // Make price reasonable (catalog dummy prices often low)
  const reasonablePrice = basePrice < 3000 ? basePrice + 8000 : basePrice;
  const categoryId = c.category_id || `cat-${i % 3}`;
  const uoms = [
    { id: `uom-${id}-pcs`, name: 'Pcs', factor: 1, isBase: true },
    { id: `uom-${id}-pack`, name: 'Pack', factor: 6, price: reasonablePrice * 6 - 500, isBase: false },
    { id: `uom-${id}-dus`, name: 'Dus', factor: 24, price: reasonablePrice * 24 - 2000, isBase: false },
  ];
  // Random wholesale tiers for ~60% of products
  const isWholesale = Math.random() > 0.4;
  const wholesaleTiers = isWholesale ? [
    { id: `tier-${id}-1`, minQty: 12, maxQty: 49, price: Math.round(reasonablePrice * 0.9), label: 'Grosir 12-49' },
    { id: `tier-${id}-2`, minQty: 50, price: Math.round(reasonablePrice * 0.8), label: 'Grosir ≥50' },
  ] : [];
  products.push({
    id,
    sku: c.sku || `SKU-${id.toUpperCase()}`,
    barcode: c.barcode || `899${String(1000000000 + i).slice(-9)}`,
    name: c.name || c.generic_name || `Produk ${i + 1}`,
    brand: c.brand || c.brand_owner || '',
    category_id: categoryId,
    price: reasonablePrice,
    cost_price: c.cost_price || Math.round(reasonablePrice * 0.7),
    stock: 100 + Math.floor(Math.random() * 400),
    track_stock: true,
    has_variant: false,
    imageUrl: c.image_url || c.image_small_url || '',
    imageHint: c.brand || '',
    is_active: true,
    baseUom: 'Pcs',
    uoms,
    wholesaleTiers,
    isWholesaleEnabled: isWholesale,
    groupPrices: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

// Non-catalog products (5-7 manual grosir staples)
const manualProducts = [
  { name: 'Beras Premium 5kg', brand: 'Sania', category_id: 'cat-sembako', price: 65000 },
  { name: 'Minyak Goreng 1L', brand: 'Bimoli', category_id: 'cat-sembako', price: 18000 },
  { name: 'Gula Pasir 1kg', brand: 'Gulaku', category_id: 'cat-sembako', price: 15000 },
  { name: 'Tepung Terigu 1kg', brand: 'Segitiga', category_id: 'cat-sembako', price: 12000 },
  { name: 'Kopi Sachet Renceng', brand: 'Kapal Api', category_id: 'cat-minuman', price: 12000 },
  { name: 'Teh Celup Box', brand: 'Sariwangi', category_id: 'cat-minuman', price: 15000 },
];
for (let i = 0; i < manualProducts.length; i++) {
  const m = manualProducts[i];
  const id = `prod-manual-${String(i + 1).padStart(3, '0')}`;
  const uoms = [
    { id: `uom-${id}-pcs`, name: 'Pcs', factor: 1, isBase: true },
    { id: `uom-${id}-lusin`, name: 'Lusin', factor: 12, price: m.price * 12 - 1000, isBase: false },
    { id: `uom-${id}-dus`, name: 'Dus', factor: 24, price: m.price * 24 - 3000, isBase: false },
  ];
  products.push({
    id,
    sku: `MAN-${String(i + 1).padStart(4, '0')}`,
    barcode: `8999999000${String(i).padStart(3, '0')}`,
    name: m.name,
    brand: m.brand,
    category_id: m.category_id,
    price: m.price,
    cost_price: Math.round(m.price * 0.75),
    stock: 200 + Math.floor(Math.random() * 300),
    track_stock: true,
    has_variant: false,
    imageUrl: '',
    imageHint: m.brand,
    is_active: true,
    baseUom: 'Pcs',
    uoms,
    wholesaleTiers: [
      { id: `tier-${id}-1`, minQty: 12, maxQty: 49, price: Math.round(m.price * 0.92), label: 'Grosir 12-49' },
      { id: `tier-${id}-2`, minQty: 50, price: Math.round(m.price * 0.85), label: 'Grosir ≥50' },
    ],
    isWholesaleEnabled: true,
    groupPrices: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

// --- Customer Groups (upsert, keep default ids for coherence) ---
const customerGroups = [
  { id: 'grp-umum', name: 'Umum', rank: 0, topDays: 0, is_active: true, created_at: new Date().toISOString() },
  { id: 'grp-reseller', name: 'Reseller', rank: 1, topDays: 7, is_active: true, created_at: new Date().toISOString() },
  { id: 'grp-agen', name: 'Agen', rank: 2, topDays: 14, is_active: true, created_at: new Date().toISOString() },
  { id: 'grp-distributor', name: 'Distributor', rank: 3, topDays: 30, is_active: true, created_at: new Date().toISOString() },
];

// --- Customers (10) across groups ---
const customerNames = [
  'Toko Sumber Rejeki', 'Warung Bu Siti', 'Toko Makmur Jaya', 'Kios Berkah',
  'UD Maju Bersama', 'CV Distribusi Prima', 'Toko Amanah', 'Grosir Sentosa',
  'Warung Pojok', 'Toko Harapan Baru'
];
const customers = customerNames.map((name, i) => {
  const groups = ['grp-umum', 'grp-reseller', 'grp-agen', 'grp-distributor'];
  // 3 Umum, 3 Reseller, 2 Agen, 2 Distributor
  const groupId = i < 3 ? 'grp-umum' : i < 6 ? 'grp-reseller' : i < 8 ? 'grp-agen' : 'grp-distributor';
  const group = customerGroups.find(g => g.id === groupId);
  return {
    id: `cust-${String(i + 1).padStart(3, '0')}`,
    name,
    phone: `0812${String(10000000 + i * 123456).slice(-8)}`,
    address: `Jl. Contoh No. ${i + 1}, Kota`,
    groupId,
    topDays: group.topDays,
    creditLimit: groupId === 'grp-distributor' ? 5000000 : groupId === 'grp-agen' ? 3000000 : groupId === 'grp-reseller' ? 1000000 : 0,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
});

// --- Promos for seeded products (coherent ids) ---
const promos = [];
// Voucher example tied to first product's category
if (products.length > 0) {
  promos.push({
    id: 'promo-seed-voucher-001',
    name: 'Grosir Hemat 10K',
    kind: 'voucher',
    code: 'GROSIR10',
    discount_type: 'flat',
    discount_value: 10000,
    min_purchase: 100000,
    max_uses: 100,
    is_active: true,
    allowWholesale: true,
    created_at: new Date().toISOString(),
    starts_at: new Date().toISOString(),
    ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    applies_to_product_ids: [],
    applies_to_category_ids: [],
  });
}
// Flat promo for first wholesale product
const wholesaleProd = products.find(p => p.isWholesaleEnabled);
if (wholesaleProd) {
  promos.push({
    id: 'promo-seed-flat-001',
    name: 'Diskon Grosir Beras',
    kind: 'flat',
    discount_type: 'flat',
    discount_value: 2000,
    is_active: true,
    allowWholesale: true,
    created_at: new Date().toISOString(),
    starts_at: new Date().toISOString(),
    ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    applies_to_product_ids: [wholesaleProd.id],
    applies_to_category_ids: [],
  });
}

// Write files
writeFileSync(join(seedDir, 'products.json'), JSON.stringify(products, null, 2));
writeFileSync(join(seedDir, 'customer_groups.json'), JSON.stringify(customerGroups, null, 2));
writeFileSync(join(seedDir, 'customers.json'), JSON.stringify(customers, null, 2));
writeFileSync(join(seedDir, 'promos.json'), JSON.stringify(promos, null, 2));

console.log(`\nSeed written to ${seedDir}:`);
console.log(` - products.json: ${products.length} products (${selectedCatalog.length} catalog + 6 manual), UOM & wholesale tiers`);
console.log(` - customer_groups.json: ${customerGroups.length} groups`);
console.log(` - customers.json: ${customers.length} customers`);
console.log(` - promos.json: ${promos.length} promos (allowWholesale true)`);

console.log(`\nInject (PowerShell, upsert via set --fromfile --batch, DB: ${dbPath}):`);
console.log(`Get-ChildItem seed/*.json | ForEach-Object { & "C:\\Dev\\bin\\firelite-cli" --db "${dbPath}" set --fromfile $_.FullName --batch true }`);
console.log(`\nOr per-collection (batch upsert):`);
console.log(`firelite-cli --db "${dbPath}" set --fromfile seed/products.json --batch true`);
console.log(`firelite-cli --db "${dbPath}" set --fromfile seed/customer_groups.json --batch true`);
console.log(`firelite-cli --db "${dbPath}" set --fromfile seed/customers.json --batch true`);
console.log(`firelite-cli --db "${dbPath}" set --fromfile seed/promos.json --batch true`);
console.log(`\nIf batch unsupported, fallback per-doc:`);
console.log(`Get-Content seed/products.json | ConvertFrom-Json | ForEach-Object { $_ | ConvertTo-Json -Compress | Out-File temp.json; firelite-cli --db "${dbPath}" set products/$($_.id) --fromfile temp.json }`);
console.log(`\nVerify:`);
console.log(`firelite-cli --db "${dbPath}" query products --limit 5`);
console.log(`firelite-cli --db "${dbPath}" query customers --limit 10`);
