#!/usr/bin/env node
/**
 * build_indo_catalog.mjs
 *
 * One-time build step: transforms the offline Open Food Facts Indonesian CSV export
 * into a compact bundled JSON used as start-data for the read-only `catalog` collection.
 *
 * Filters:
 *   - valid 13-digit EAN-13 barcode
 *   - non-empty product name
 * Maps OFF leaf categories -> a curated handful of Indonesian shelf categories using
 * simple keyword matching (fallback "Lainnya"). Images prefer image_small_url.
 *
 * Output: src-tauri/resources/indonesian-catalog.json  (bundled via tauri.conf.json)
 *
 * Usage:  node scripts/build_indo_catalog.mjs [path/to/indonesia_products_complete.csv]
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");

const DEFAULT_CSV = "C:\\Dev\\msys64\\home\\Atin Nayiroh\\Dev\\indonesia_products_complete.csv";
const OUT_PATH = resolve(ROOT, "src-tauri", "resources", "indonesian-catalog.json");

const CATALOG_DEFAULT_PRICE = 1000;

// Curated retail categories (id, label, keywords — matched against lowercased leaf tags + name/brand)
const CATEGORIES = [
  { id: "cat-makanan-instan", label: "Makanan Instan", keywords: ["instan", "mie instan", "mi instan", "indomie", "supramen", "cup noodles", "ramen", "instant noodle", "soup"] },
  { id: "cat-makanan-ringan", label: "Makanan Ringan", keywords: ["keripik", "kripik", "snack", "chips", "cracker", "popcorn", "kacang", "peanut", "semangkuk", "singkong"] },
  { id: "cat-kebutuhan-pokok", label: "Kebutuhan Pokok", keywords: ["beras", "rice", "gula", "sugar", "tepung", "flour", "telur", "egg", "minyak goreng", "cooking oil", "sagu", "jagung"] },
  { id: "cat-bumbu-saus", label: "Bumbu & Saus", keywords: ["bumbu", "kecap", "saus", "sauce", "sambal", "cabai", "chili", "penyedap", "seasoning", "kaldu", "merica", "perasa", "dressing", "maggi", "masako"] },
  { id: "cat-kopi-teh", label: "Kopi & Teh", keywords: ["kopi", "coffee", "teh", "tea", "kefir"] },
  { id: "cat-susu", label: "Susu & Olahan", keywords: ["susu", "milk", "uht", "yogurt", "yogurt"] },
  { id: "cat-makanan-beku", label: "Makanan Beku", keywords: ["frozen", "beku", "nugget", "ice cream"] },
  { id: "cat-makanan-kaleng", label: "Makanan Kaleng", keywords: ["canned", "kaleng", "sarden", "sardine", "corned"] },
  { id: "cat-permen-cokelat", label: "Permen & Cokelat", keywords: ["permen", "candy", "cokelat", "chocolate", "cocoa", "lollipop"] },
  { id: "cat-roti-biskuit", label: "Roti & Biskuit", keywords: ["roti", "bread", "biskuit", "biscuit", "wafer", "cookie", "kue", "cake"] },
  { id: "cat-minuman", label: "Minuman", keywords: ["minuman", "drink", "soda", "sirup", "syrup", "jus", "juice", "mineral", "pulpy", "isotonic"] },
  { id: "cat-perawatan", label: "Perawatan & Kebersihan", keywords: ["sabun", "soap", "shampoo", "shamp", "pasta gigi", "toothpaste", "cleaner", "detergent", "lotion", "wipes", "deodorant"] },
  { id: "cat-lainnya", label: "Lainnya", keywords: [] },
];
const FALLBACK_CAT = CATEGORIES[CATEGORIES.length - 1];

function classify(text) {
  const t = (text || "").toLowerCase();
  for (const c of CATEGORIES) {
    if (c.keywords.length && c.keywords.some((k) => k && t.includes(k))) return c;
  }
  return FALLBACK_CAT;
}

// Minimal RFC-4180 CSV parser (handles quoted fields + "" escapes)
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else { field += ch; }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field); field = "";
    } else if (ch === "\r") {
      // skip
    } else if (ch === "\n") {
      row.push(field); field = "";
      rows.push(row); row = [];
    } else {
      field += ch;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function build(csvPath) {
  const text = readFileSync(csvPath, "utf8");
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error("CSV has no data rows");

  const header = rows[0].map((h) => h.trim());
  const col = (name) => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`Missing column: ${name}`);
    return i;
  };
  const iBarcode = col("barcode");
  const iName = col("name");
  const iGeneric = col("generic_name");
  const iBrand = col("brand");
  const iCats = col("categories");
  const iSmall = col("image_small_url");
  const iImg = col("image_url");

  const seen = new Set();
  const products = [];
  let skipped = { invalidBarcode: 0, noName: 0, duplicate: 0 };

  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    if (cells.length !== header.length) continue;

    const barcode = (cells[iBarcode] || "").trim();
    const name = (cells[iName] || "").trim();

    if (!/^\d{13}$/.test(barcode)) { skipped.invalidBarcode++; continue; }
    if (!name) { skipped.noName++; continue; }
    if (seen.has(barcode)) { skipped.duplicate++; continue; }
    seen.add(barcode);

    const cat = classify(name + " " + (cells[iGeneric] || "") + " " + (cells[iCats] || "") + " " + (cells[iBrand] || ""));
    const small = (cells[iSmall] || "").trim();
    const large = (cells[iImg] || "").trim();

    products.push({
      id: barcode,
      barcode,
      name,
      brand: (cells[iBrand] || "").trim() || undefined,
      generic_name: (cells[iGeneric] || "").trim() || undefined,
      category_id: cat.id,
      category_name: cat.label,
      price: CATALOG_DEFAULT_PRICE,
      cost_price: 0,
      stock: 0,
      low_stock_alert: 0,
      track_stock: false,
      is_active: true,
      has_variant: false,
      image_url: small || large || undefined,
    });
  }

  const out = {
    version: 1,
    generated: new Date().toISOString(),
    count: products.length,
    default_price: CATALOG_DEFAULT_PRICE,
    categories: CATEGORIES.map(({ id, label }) => ({ id, label })),
    products,
  };
  writeFileSync(OUT_PATH, JSON.stringify(out)); // compact (no pretty-print) to keep the bundled resource small
  console.log(`Wrote ${OUT_PATH}`);
  console.log(`Products: ${products.length}`);
  console.log(`Skipped: invalid-barcode=${skipped.invalidBarcode} no-name=${skipped.noName} duplicate=${skipped.duplicate}`);
}

const csvPath = process.argv[2] || DEFAULT_CSV;
build(csvPath);