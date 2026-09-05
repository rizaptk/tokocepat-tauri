#!/usr/bin/env node
/**
 * Seed Transactions — linked to Stock Movements + weekly restock (stok masuk / mandiri / dealer)
 * Generates 30 days of transactions that deduct stock, plus weekly replenishment so final
 * product.stock = initial + Σrestock − Σsale and never goes strongly negative.
 *
 * Usage: node scripts/seed-transactions.mjs [--db "C:\...\kastoko.db"] [--days 30] [--min 20] [--max 30]
 * Output: seed/transactions.json, seed/shifts.json, seed/stock_movements.json, seed/products.json (stock updated)
 * Inject: firelite-cli --db kastoko.db set --fromfile seed/products.json --batch true
 *         firelite-cli --db kastoko.db set --fromfile seed/stock_movements.json --batch true
 *         firelite-cli --db kastoko.db set --fromfile seed/shifts.json --batch true
 *         firelite-cli --db kastoko.db set --fromfile seed/transactions.json --batch true
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const seedDir = join(projectRoot, 'seed');
const dbPath = process.argv.includes('--db') ? process.argv[process.argv.indexOf('--db') + 1] : 'C:\\Users\\Atin Nayiroh\\AppData\\Roaming\\com.kastoko.desktop\\kastoko.db';
const days = parseInt(process.argv.includes('--days') ? process.argv[process.argv.indexOf('--days') + 1] : '30', 10);
const minPerDay = parseInt(process.argv.includes('--min') ? process.argv[process.argv.indexOf('--min') + 1] : '20', 10);
const maxPerDay = parseInt(process.argv.includes('--max') ? process.argv[process.argv.indexOf('--max') + 1] : '30', 10);

function loadJson(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf-8'));
}

let products = loadJson(join(seedDir, 'products.json')) || [];
let customers = loadJson(join(seedDir, 'customers.json')) || [];
let promos = loadJson(join(seedDir, 'promos.json')) || [];
if (products.length === 0) {
  console.error('No seed/products.json found — run seed-grosir.mjs first');
  process.exit(1);
}
console.log(`Loaded ${products.length} products, ${customers.length} customers, ${promos.length} promos`);

// Preserve initial stock to compute final linked stock. We will mutate products[].stock to linked final.
const productById = new Map(products.map(p => [p.id, p]));
const initialStock = new Map(products.map(p => [p.id, p.stock]));
const currentStock = new Map(products.map(p => [p.id, p.stock]));
const weeklySold = new Map(); // productId -> base qty sold this week
const stockMovements = [];

const shifts = [];
const transactions = [];
const now = new Date();
const device = process.argv.includes('--device') ? process.argv[process.argv.indexOf('--device') + 1] : '41564E49-494C-0044-0000-000000000000';

function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randomChoice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function formatInvoice(date) {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `INV-${m}${d}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function getBaseUom(p) {
  const uoms = p.uoms || [{ name: 'Pcs', factor: 1, isBase: true }];
  return uoms.find(u => u.isBase) || uoms[0];
}
function resolvePrice(p, qtyBase, customer) {
  let basePrice = p.price;
  if (customer?.groupId && p.groupPrices) {
    const gp = p.groupPrices.find(g => g.groupId === customer.groupId);
    if (gp) basePrice = gp.price;
  }
  if (p.isWholesaleEnabled && p.wholesaleTiers) {
    const tier = p.wholesaleTiers.filter(t => qtyBase >= t.minQty && (t.maxQty == null || qtyBase <= t.maxQty)).sort((a,b)=>b.minQty-a.minQty)[0];
    if (tier) basePrice = tier.price;
  }
  return basePrice;
}

const RESTOCK_SOURCES = [
  { label: 'Stok Masuk', reason: 'Stok Masuk Mingguan' },
  { label: 'Pembelian Mandiri', reason: 'Pembelian Mandiri (Pasar Induk)' },
  { label: 'Suplai Dealer', reason: 'Suplai Dealer' },
];
const CASHIER_NAMES = ['Riza', 'Andi', 'Siti'];

function createRestockMovements(weekEndDate, weekIndex) {
  // weekEndDate = date of last day in week; restock is dated next morning 06:00
  const restockDate = new Date(weekEndDate);
  restockDate.setDate(restockDate.getDate() + 1);
  restockDate.setHours(6, 0, 0, 0);
  const iso = restockDate.toISOString();
  let created = 0;
  for (const p of products) {
    const consumed = weeklySold.get(p.id) || 0;
    let restockBase = 0;
    let source = randomChoice(RESTOCK_SOURCES);
    if (consumed > 0) {
      // replenish 110-130% of consumed + buffer, larger for dealer
      const factor = source.label === 'Suplai Dealer' ? 1.35 : source.label === 'Pembelian Mandiri' ? 1.15 : 1.25;
      restockBase = Math.ceil(consumed * factor) + randomInt(3, 12);
    } else if (Math.random() < 0.18) {
      // slow mover still gets small top-up ~15%
      restockBase = randomInt(8, 24);
      source = randomChoice(RESTOCK_SOURCES);
    } else {
      continue;
    }
    // clamp to avoid insane bulk — cap at 3x consumed or 120 max
    if (consumed > 0) restockBase = Math.min(restockBase, Math.max(60, consumed * 2));
    // apply to running stock
    currentStock.set(p.id, (currentStock.get(p.id) || 0) + restockBase);
    const baseUom = getBaseUom(p);
    stockMovements.push({
      id: `sm-restock-w${String(weekIndex).padStart(2,'0')}-${p.id}`,
      product_id: p.id,
      product_name_snapshot: p.name,
      type: 'restock',
      qty_change: restockBase,
      qty_change_uom: restockBase, // base units
      uom_id: baseUom.id,
      uom_name: baseUom.name,
      uom_factor: baseUom.factor,
      reason: `${source.reason} — ${p.name} (minggu ${weekIndex})`,
      reference_id: `restock-week-${weekIndex}-${p.id}`,
      created_at: iso,
    });
    created++;
  }
  // clear accumulator for next week
  weeklySold.clear();
  console.log(`  ↳ week ${weekIndex} restock ${created} produk pada ${iso.slice(0,10)} (stok masuk/mandiri/dealer)`);
}

let weekIndex = 1;
let daysProcessed = 0;

for (let d = days - 1; d >= 0; d--) {
  const day = new Date(now);
  day.setDate(now.getDate() - d);
  day.setHours(8 + Math.floor(Math.random()*12), Math.floor(Math.random()*60), 0, 0);
  const shiftId = `shift-${day.toISOString().slice(0,10)}-seed`;
  const openedBy = CASHIER_NAMES[shifts.length % CASHIER_NAMES.length];
  shifts.push({
    id: shiftId,
    opened_at: new Date(day.getFullYear(), day.getMonth(), day.getDate(), 7, 0, 0).toISOString(),
    closed_at: new Date(day.getFullYear(), day.getMonth(), day.getDate(), 22, 0, 0).toISOString(),
    opening_cash: randomInt(200000, 500000),
    opened_by: openedBy,
    status: 'closed',
    device,
    total_cash_out: 0,
  });

  const perDay = randomInt(minPerDay, maxPerDay);
  for (let i = 0; i < perDay; i++) {
    const isWholesale = Math.random() < 0.3;
    const customer = isWholesale ? randomChoice(customers) : null;
    const cartSize = randomInt(1, 5);
    const cartProducts = [];
    for (let k = 0; k < cartSize; k++) cartProducts.push(randomChoice(products));

    const items = [];
    let subtotal = 0;
    for (const prod of cartProducts) {
      const uoms = prod.uoms || [{ name: 'Pcs', factor: 1, isBase: true, id: `uom-${prod.id}-pcs` }];
      const uom = Math.random() < 0.6 ? uoms.find(u=>u.isBase) || uoms[0] : randomChoice(uoms);
      let qtyUom = uom.factor >= 12 ? randomInt(1, 3) : randomInt(1, 5);
      let qtyBase = qtyUom * uom.factor;
      // Guard: if stock would go very negative, cap qty to remaining + small overdraft (realistic backorder guard)
      // Keep linked: prefer to keep stock >= 10 after sale. If would drop below -20, shrink qty.
      const remaining = currentStock.get(prod.id) ?? 0;
      if (remaining - qtyBase < -20) {
        const maxBase = Math.max(1, remaining + 20);
        // convert back to uom qty
        qtyUom = Math.max(1, Math.floor(maxBase / uom.factor) || 1);
        qtyBase = qtyUom * uom.factor;
      }
      const pricePerBase = resolvePrice(prod, qtyBase, customer);
      const pricePerUom = uom.price ?? pricePerBase * uom.factor;
      const lineSubtotal = pricePerUom * qtyUom;
      subtotal += lineSubtotal;
      items.push({
        id: `tx-item-${Math.random().toString(36).slice(2,8)}`,
        transaction_id: '', // filled later
        product_snapshot: { id: prod.id, name: prod.name, price: pricePerUom, imageUrl: prod.imageUrl || '', imageHint: '', category_id: prod.category_id, sku: prod.sku, barcode: prod.barcode },
        price_snapshot: pricePerUom,
        price_base_snapshot: pricePerBase,
        cost_snapshot: prod.cost_price || Math.round(pricePerBase * 0.7),
        qty: qtyUom,
        qty_base: qtyBase,
        uom_id: uom.id,
        uom_name: uom.name,
        uom_factor: uom.factor,
        subtotal: lineSubtotal,
        unit_discount: 0,
        discount_amount: 0,
        promo_ids: [],
        is_free_item: false,
        _prodId: prod.id, // transient for movement linking
        _qtyBase: qtyBase,
        _uom: uom,
      });
    }

    // Promo: respect allowWholesale — voucher / flat / manual
    let discountTotal = 0;
    let promoDiscount = 0;
    let manualDiscount = 0;
    let appliedPromos = [];
    const rPromo = Math.random();
    const allowForTx = (p) => isWholesale ? (p.allowWholesale !== false) : true;
    const voucherPromos = promos.filter((p) => p.kind === 'voucher' && allowForTx(p));
    const flatPromos = promos.filter((p) => p.kind === 'flat' && allowForTx(p));
    if (rPromo < 0.18 && voucherPromos.length > 0) {
      const promo = voucherPromos[Math.floor(Math.random() * voucherPromos.length)];
      const disc = Math.round(subtotal * 0.05);
      discountTotal = disc;
      promoDiscount = disc;
      appliedPromos = [{ promo_id: promo.id, name: promo.name, amount: disc, kind: 'voucher', voucher_code: promo.code }];
      if (items[0]) { items[0].unit_discount = Math.round(disc / items[0].qty); items[0].discount_amount = disc; items[0].promo_ids = [promo.id]; }
    } else if (rPromo < 0.30 && flatPromos.length > 0) {
      const promo = flatPromos[Math.floor(Math.random() * flatPromos.length)];
      const disc = promo.discount_value || 2000;
      const capped = Math.min(disc, Math.round(subtotal * 0.4));
      discountTotal = capped;
      promoDiscount = capped;
      appliedPromos = [{ promo_id: promo.id, name: promo.name, amount: capped, kind: 'auto' }];
      if (items[0]) { items[0].unit_discount = Math.round(capped / items[0].qty); items[0].discount_amount = capped; items[0].promo_ids = [promo.id]; }
    } else if (rPromo < 0.40) {
      const disc = [5000, 8000, Math.round(subtotal * 0.07)][Math.floor(Math.random() * 3)];
      const capped = Math.min(disc, Math.round(subtotal * 0.3));
      discountTotal = capped;
      manualDiscount = capped;
      appliedPromos = [{ promo_id: 'manual', name: 'Diskon Kasir', amount: capped, kind: 'manual' }];
      if (items[0]) { items[0].unit_discount = Math.round(capped / items[0].qty); items[0].discount_amount = capped; items[0].promo_ids = ['manual']; }
    }

    const taxRate = 0.11;
    const taxBase = subtotal - discountTotal;
    const taxAmount = Math.round(taxBase * taxRate);
    const total = taxBase + taxAmount;

    const createdAt = new Date(day.getTime() + randomInt(0, 12*60*60*1000)).toISOString();
    const invoice = formatInvoice(new Date(createdAt));
    const transactionId = `tx-${Math.random().toString(36).slice(2,8)}`;

    // Payment handling for wholesale piutang
    let cashPaid = total;
    let paymentStatus = 'lunas';
    let dueDate = undefined;
    let termDays = 0;
    if (isWholesale && customer) {
      const top = customer.topDays ?? 0;
      termDays = top;
      if (top > 0) dueDate = new Date(new Date(createdAt).getTime() + top*24*60*60*1000).toISOString();
      const r = Math.random();
      if (r < 0.25) { // piutang
        cashPaid = 0;
        paymentStatus = 'piutang';
      } else if (r < 0.4) { // cicilan
        cashPaid = Math.round(total * 0.5);
        paymentStatus = 'lunas_sebagian';
      }
    }

    // Fill transaction_id in items and deduct linked stock + queue sale movements
    for (const it of items) {
      it.transaction_id = transactionId;
      const prodId = it._prodId;
      const qtyBase = it._qtyBase;
      // deduct running stock
      currentStock.set(prodId, (currentStock.get(prodId) || 0) - qtyBase);
      // accumulate weekly sold
      weeklySold.set(prodId, (weeklySold.get(prodId) || 0) + qtyBase);
      // create linked sale stock movement (mirrors transactionService.createTransaction sale loop)
      const prod = productById.get(prodId);
      const uom = it._uom;
      stockMovements.push({
        id: `sm-${transactionId}-${it.id}`,
        product_id: prodId,
        product_name_snapshot: it.product_snapshot.name,
        type: 'sale',
        qty_change: -qtyBase,
        qty_change_uom: -it.qty,
        uom_id: uom.id,
        uom_name: uom.name,
        uom_factor: uom.factor,
        reason: `Penjualan Produk: ${it.product_snapshot.name}${uom.name ? ` (${qtyBase} ${uom.name} ×${uom.factor})` : ''}`,
        reference_id: transactionId,
        created_at: createdAt,
      });
      // strip transient fields before persisting item
      delete it._prodId;
      delete it._qtyBase;
      delete it._uom;
    }

    // Event-stored money (v0.8.0 shape): freeze the cost split at write time,
    // mirroring splitTxCosts in src/lib/money.ts. Seed catalog has no
    // consignment products, so payout stays 0 — fields are still written so
    // seeded docs report from stored scalars like real transactions.
    let hppStandard = 0;
    let payoutConsignment = 0;
    for (const it of items) {
      const costVal = (it.cost_snapshot || 0) * it.qty;
      if (it.product_snapshot.is_consignment) payoutConsignment += costVal;
      else hppStandard += costVal;
    }

    transactions.push({
      id: transactionId,
      invoice_number: invoice,
      items,
      subtotal,
      tax_amount: taxAmount,
      total,
      cash_paid: cashPaid,
      change: cashPaid - total,
      created_at: createdAt,
      shift_id: shiftId,
      device,
      status: 'paid',
      gross_subtotal: subtotal,
      discount_total: discountTotal,
      promo_discount: promoDiscount,
      manual_discount: manualDiscount,
      voucher_code: appliedPromos[0]?.voucher_code,
      applied_promos: appliedPromos,
      hpp_standard: hppStandard,
      payout_consignment: payoutConsignment,
      money_v: 1,
      is_wholesale: isWholesale,
      customer_id: customer?.id,
      customer_name_snapshot: customer?.name,
      customer_group_snapshot: customer ? (customers.find(c=>c.id===customer.id)?.groupId ? '' : '') : undefined,
      due_date: dueDate,
      term_days: termDays || undefined,
      payment_status: paymentStatus,
      cashier_name_snapshot: openedBy,
    });
  }

  daysProcessed++;
  // Weekly restock every 7 days (stok masuk / mandiri / dealer), not after final day
  if (daysProcessed % 7 === 0 && d !== 0) {
    const weekEnd = new Date(day);
    createRestockMovements(weekEnd, weekIndex++);
  }
}

// Final week tail restock for last partial week (so final stock not depleted)
if (weeklySold.size > 0) {
  const tailDate = new Date(now);
  createRestockMovements(tailDate, weekIndex);
}

// Fill customer_group_snapshot for wholesale txs
const groupMap = new Map((loadJson(join(seedDir, 'customer_groups.json')) || []).map(g=>[g.id,g.name]));
for (const tx of transactions) {
  if (tx.customer_id) {
    const cust = customers.find(c=>c.id===tx.customer_id);
    if (cust) tx.customer_group_snapshot = groupMap.get(cust.groupId) || '';
  }
}

// Update products.json stock to linked final (currentStock) — keeps simulation coherent
for (const p of products) {
  const final = currentStock.get(p.id);
  if (typeof final === 'number') {
    p.stock = Math.max(0, final);
    p.updated_at = new Date().toISOString();
  }
}

mkdirSync(seedDir, { recursive: true });
writeFileSync(join(seedDir, 'shifts.json'), JSON.stringify(shifts, null, 2));
writeFileSync(join(seedDir, 'transactions.json'), JSON.stringify(transactions, null, 2));
writeFileSync(join(seedDir, 'stock_movements.json'), JSON.stringify(stockMovements, null, 2));
writeFileSync(join(seedDir, 'products.json'), JSON.stringify(products, null, 2));

const saleCount = stockMovements.filter(m => m.type === 'sale').length;
const restockCount = stockMovements.filter(m => m.type === 'restock').length;
const totalSoldBase = [...initialStock.entries()].reduce((sum,[id,init]) => sum + (init - (currentStock.get(id)||0) + stockMovements.filter(m=>m.product_id===id && m.type==='restock').reduce((a,m)=>a+m.qty_change,0)), 0);
const negative = products.filter(p => p.stock < 0).length;
console.log(`\nGenerated ${shifts.length} shifts and ${transactions.length} transactions (${minPerDay}-${maxPerDay}/day for ${days} days)`);
console.log(` - Wholesale: ${transactions.filter(t=>t.is_wholesale).length}, Retail: ${transactions.filter(t=>!t.is_wholesale).length}`);
console.log(` - Piutang: ${transactions.filter(t=>t.payment_status==='piutang').length}, Cicilan: ${transactions.filter(t=>t.payment_status==='lunas_sebagian').length}`);
console.log(` - With promo: ${transactions.filter(t=> (t.applied_promos||[]).length>0).length}`);
console.log(` - Stock movements: ${stockMovements.length} (sale ${saleCount}, restock ${restockCount} — stok masuk/mandiri/dealer mingguan)`);
console.log(` - Products final stock updated: ${products.length} (negative: ${negative})`);
console.log(`\nInject (append, DB: ${dbPath}):`);
console.log(`firelite-cli --db "${dbPath}" set products --fromfile seed/products.json --batch true`);
console.log(`firelite-cli --db "${dbPath}" set stock_movements --fromfile seed/stock_movements.json --batch true`);
console.log(`firelite-cli --db "${dbPath}" set shifts --fromfile seed/shifts.json --batch true`);
console.log(`firelite-cli --db "${dbPath}" set transactions --fromfile seed/transactions.json --batch true`);
console.log(`\nPowerShell loop:`);
console.log(`Get-ChildItem seed/products.json,seed/stock_movements.json,seed/shifts.json,seed/transactions.json | ForEach-Object { $col = $_.BaseName; & "C:\\Dev\\bin\\firelite-cli" --db "${dbPath}" set $col --fromfile $_.FullName --batch true }`);
console.log(`\nVerify: firelite-cli --db "${dbPath}" query stock_movements --limit 5`);
