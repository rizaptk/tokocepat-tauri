#!/usr/bin/env node
/**
 * Seed Transactions — 30 days, 20-30 per day, append, coherent with grosir products/customers/promos
 * Usage: node scripts/seed-transactions.mjs [--db "C:\\...\\kastoko.db"] [--days 30] [--min 20] [--max 30]
 * Output: seed/transactions.json, seed/shifts.json
 * Inject: firelite-cli --db kastoko.db set --fromfile seed/transactions.json --batch true
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

 // Precompute product helpers
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

for (let d = days - 1; d >= 0; d--) {
  const day = new Date(now);
  day.setDate(now.getDate() - d);
  day.setHours(8 + Math.floor(Math.random()*12), Math.floor(Math.random()*60), 0, 0);
  const shiftId = `shift-${day.toISOString().slice(0,10)}-seed`;
  // Shift per day
  shifts.push({
    id: shiftId,
    opened_at: new Date(day.getFullYear(), day.getMonth(), day.getDate(), 7, 0, 0).toISOString(),
    closed_at: new Date(day.getFullYear(), day.getMonth(), day.getDate(), 22, 0, 0).toISOString(),
    opening_cash: randomInt(200000, 500000),
    status: 'closed',
    device,
    total_cash_out: 0,
  });

  const perDay = randomInt(minPerDay, maxPerDay);
  for (let i = 0; i < perDay; i++) {
    const isWholesale = Math.random() < 0.3;
    const customer = isWholesale ? randomChoice(customers) : null;
    const groupId = customer?.groupId;
    const cartSize = randomInt(1, 5);
    const cartProducts = [];
    for (let k = 0; k < cartSize; k++) cartProducts.push(randomChoice(products));

    const items = [];
    let subtotal = 0;
    for (const prod of cartProducts) {
      const uoms = prod.uoms || [{ name: 'Pcs', factor: 1, isBase: true, id: `uom-${prod.id}-pcs` }];
      const uom = Math.random() < 0.6 ? uoms.find(u=>u.isBase) || uoms[0] : randomChoice(uoms);
      const qtyUom = uom.factor >= 12 ? randomInt(1, 3) : randomInt(1, 5);
      const qtyBase = qtyUom * uom.factor;
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
      });
    }

    // Random promo 30% retail
    let discountTotal = 0;
    let promoDiscount = 0;
    let appliedPromos = [];
    if (!isWholesale && Math.random() < 0.3 && promos.length > 0) {
      const promo = promos[0];
      const disc = Math.round(subtotal * 0.05);
      discountTotal = disc;
      promoDiscount = disc;
      appliedPromos = [{ promo_id: promo.id, name: promo.name, amount: disc, kind: 'voucher', voucher_code: promo.code }];
      // Apply to first line
      if (items[0]) { items[0].unit_discount = Math.round(disc / items[0].qty); items[0].discount_amount = disc; items[0].promo_ids = [promo.id]; }
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

    // Fill transaction_id in items
    for (const it of items) it.transaction_id = transactionId;

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
      manual_discount: 0,
      voucher_code: appliedPromos[0]?.voucher_code,
      applied_promos: appliedPromos,
      is_wholesale: isWholesale,
      customer_id: customer?.id,
      customer_name_snapshot: customer?.name,
      customer_group_snapshot: customer ? (customers.find(c=>c.id===customer.id)?.groupId ? '' : '') : undefined,
      due_date: dueDate,
      term_days: termDays || undefined,
      payment_status: paymentStatus,
    });
  }
}

// Fill customer_group_snapshot for wholesale txs
const groupMap = new Map((loadJson(join(seedDir, 'customer_groups.json')) || []).map(g=>[g.id,g.name]));
for (const tx of transactions) {
  if (tx.customer_id) {
    const cust = customers.find(c=>c.id===tx.customer_id);
    if (cust) tx.customer_group_snapshot = groupMap.get(cust.groupId) || '';
  }
}

mkdirSync(seedDir, { recursive: true });
writeFileSync(join(seedDir, 'shifts.json'), JSON.stringify(shifts, null, 2));
writeFileSync(join(seedDir, 'transactions.json'), JSON.stringify(transactions, null, 2));

console.log(`\nGenerated ${shifts.length} shifts and ${transactions.length} transactions (${minPerDay}-${maxPerDay}/day for ${days} days)`);
console.log(` - Wholesale: ${transactions.filter(t=>t.is_wholesale).length}, Retail: ${transactions.filter(t=>!t.is_wholesale).length}`);
console.log(` - Piutang: ${transactions.filter(t=>t.payment_status==='piutang').length}, Cicilan: ${transactions.filter(t=>t.payment_status==='lunas_sebagian').length}`);
console.log(` - With promo: ${transactions.filter(t=> (t.applied_promos||[]).length>0).length}`);
console.log(`\nInject (append, DB: ${dbPath}):`);
console.log(`firelite-cli --db "${dbPath}" set shifts --fromfile seed/shifts.json --batch true`);
console.log(`firelite-cli --db "${dbPath}" set transactions --fromfile seed/transactions.json --batch true`);
console.log(`\nPowerShell loop:`);
console.log(`Get-ChildItem seed/shifts.json,seed/transactions.json | ForEach-Object { $col = $_.BaseName; & "C:\\Dev\\bin\\firelite-cli" --db "${dbPath}" set $col --fromfile $_.FullName --batch true }`);
console.log(`\nVerify: firelite-cli --db "${dbPath}" query transactions --limit 5`);
