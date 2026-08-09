#!/usr/bin/env python3
"""
build_indo_catalog.py

Python equivalent of scripts/build_indo_catalog.mjs: transforms the offline
Open Food Facts Indonesian CSV export into a compact bundled JSON used as
start-data for the read-only `catalog` collection.

Filters:
  - valid 13-digit EAN-13 barcode
  - non-empty product name
Maps OFF leaf categories -> a curated handful of Indonesian shelf categories
using simple keyword matching (fallback "Lainnya"). Images prefer
image_small_url.

Output matches the exact schema the Rust `import_catalog` command and the
frontend `CatalogProduct` type expect, so both run unchanged:

  src-tauri/resources/indonesian-catalog.json  (bundled via tauri.conf.json)

Usage:
  python scripts/build_indo_catalog.py [path/to/indonesia_products_complete.csv]

Only standard-library modules are used (csv/json), no extra dependencies.
"""

from __future__ import annotations

import csv
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent

DEFAULT_CSV = Path(r"C:\Dev\msys64\home\Atin Nayiroh\Dev\indonesia_products_complete.csv")
OUT_PATH = ROOT / "src-tauri" / "resources" / "indonesian-catalog.json"

CATALOG_DEFAULT_PRICE = 1000

# Curated retail categories (id, label, keywords — matched against lowercased leaf tags + name/brand)
CATEGORIES: list[dict] = [
    {"id": "cat-makanan-instan", "label": "Makanan Instan", "keywords": ["instan", "mie instan", "mi instan", "indomie", "supramen", "cup noodles", "ramen", "instant noodle", "soup"]},
    {"id": "cat-makanan-ringan", "label": "Makanan Ringan", "keywords": ["keripik", "kripik", "snack", "chips", "cracker", "popcorn", "kacang", "peanut", "semangkuk", "singkong"]},
    {"id": "cat-kebutuhan-pokok", "label": "Kebutuhan Pokok", "keywords": ["beras", "rice", "gula", "sugar", "tepung", "flour", "telur", "egg", "minyak goreng", "cooking oil", "sagu", "jagung"]},
    {"id": "cat-bumbu-saus", "label": "Bumbu & Saus", "keywords": ["bumbu", "kecap", "saus", "sauce", "sambal", "cabai", "chili", "penyedap", "seasoning", "kaldu", "merica", "perasa", "dressing", "maggi", "masako"]},
    {"id": "cat-kopi-teh", "label": "Kopi & Teh", "keywords": ["kopi", "coffee", "teh", "tea", "kefir"]},
    {"id": "cat-susu", "label": "Susu & Olahan", "keywords": ["susu", "milk", "uht", "yogurt", " yogurt"]},
    {"id": "cat-makanan-beku", "label": "Makanan Beku", "keywords": ["frozen", "beku", "nugget", "ice cream"]},
    {"id": "cat-makanan-kaleng", "label": "Makanan Kaleng", "keywords": ["canned", "kaleng", "sarden", "sardine", "corned"]},
    {"id": "cat-permen-cokelat", "label": "Permen & Cokelat", "keywords": ["permen", "candy", "cokelat", "chocolate", "cocoa", "lollipop"]},
    {"id": "cat-roti-biskuit", "label": "Roti & Biskuit", "keywords": ["roti", "bread", "biskuit", "biscuit", "wafer", "cookie", "kue", "cake"]},
    {"id": "cat-minuman", "label": "Minuman", "keywords": ["minuman", "drink", "soda", "sirup", "syrup", "jus", "juice", "mineral", "pulpy", "isotonic"]},
    {"id": "cat-perawatan", "label": "Perawatan & Kebersihan", "keywords": ["sabun", "soap", "shampoo", "shamp", "pasta gigi", "toothpaste", "cleaner", "detergent", "lotion", "wipes", "deodorant"]},
    {"id": "cat-lainnya", "label": "Lainnya", "keywords": []},
]
FALLBACK_CAT = CATEGORIES[-1]

EAN13_RE = re.compile(r"^\d{13}$")


def classify(text: str) -> dict:
    t = (text or "").lower()
    for cat in CATEGORIES:
        if cat["keywords"] and any(k and k in t for k in cat["keywords"]):
            return cat
    return FALLBACK_CAT


def build(csv_path: Path) -> None:
    with open(csv_path, "r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    if not rows:
        raise SystemExit("CSV has no data rows")

    required = {"barcode", "name", "generic_name", "brand", "categories", "image_small_url", "image_url"}
    missing = required - set(reader.fieldnames or [])
    if missing:
        raise SystemExit(f"Missing column(s): {', '.join(sorted(missing))}")

    seen: set[str] = set()
    products: list[dict] = []
    skipped = {"invalid_barcode": 0, "no_name": 0, "duplicate": 0}

    for row in rows:
        barcode = (row.get("barcode") or "").strip()
        name = (row.get("name") or "").strip()

        if not EAN13_RE.match(barcode):
            skipped["invalid_barcode"] += 1
            continue
        if not name:
            skipped["no_name"] += 1
            continue
        if barcode in seen:
            skipped["duplicate"] += 1
            continue
        seen.add(barcode)

        cat = classify(f"{name} {row.get('generic_name') or ''} {row.get('categories') or ''} {row.get('brand') or ''}")
        small = (row.get("image_small_url") or "").strip()
        large = (row.get("image_url") or "").strip()

        product: dict = {
            "id": barcode,
            "barcode": barcode,
            "name": name,
            "category_id": cat["id"],
            "category_name": cat["label"],
            "price": CATALOG_DEFAULT_PRICE,
            "cost_price": 0,
            "stock": 0,
            "low_stock_alert": 0,
            "track_stock": False,
            "is_active": True,
            "has_variant": False,
        }
        brand = (row.get("brand") or "").strip()
        generic = (row.get("generic_name") or "").strip()
        image = small or large
        if brand:
            product["brand"] = brand
        if generic:
            product["generic_name"] = generic
        if image:
            product["image_url"] = image

        products.append(product)

    out = {
        "version": 1,
        "generated": datetime.now(timezone.utc).isoformat(),
        "count": len(products),
        "default_price": CATALOG_DEFAULT_PRICE,
        "categories": [{"id": c["id"], "label": c["label"]} for c in CATEGORIES],
        "products": products,
    }

    OUT_PATH.write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")
    print(f"Wrote {OUT_PATH}")
    print(f"Products: {len(products)}")
    print(f"Skipped: invalid-barcode={skipped['invalid_barcode']} no-name={skipped['no_name']} duplicate={skipped['duplicate']}")


def main() -> None:
    csv_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_CSV
    build(csv_path)


if __name__ == "__main__":
    main()