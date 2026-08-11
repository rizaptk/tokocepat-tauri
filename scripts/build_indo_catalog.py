#!/usr/bin/env python3
"""
build_indo_catalog.py

Transforms the offline Open Food Facts Indonesian retail CSV export into a
compact bundled JSON used as start-data for the read-only `catalog` collection.

Filters:
  - Non-empty, numeric barcode (8–14 digits; EAN-8/12/13/14 and shorter retail codes)
  - Every row with a valid barcode is kept; the name falls back through
    name -> generic_name -> product_name -> brand -> brand_owner -> barcode
    so as much of the dataset as possible lands in the catalog.
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

DEFAULT_CSV = Path(r"C:\Dev\msys64\home\Atin Nayiroh\Dev\indonesia_products_retail_complete.csv")
OUT_PATH = ROOT / "src-tauri" / "resources" / "indonesian-catalog.json"

CATALOG_DEFAULT_PRICE = 1000
CATALOG_VERSION = 2

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

# Matches numeric barcodes between 8 and 14 digits (EAN-8/12/13, ITF-14, and
# shorter retail codes). Longer concatenated delivery-service codes are skipped.
BARCODE_RE = re.compile(r"^\d{8,14}$")


def classify(text: str) -> dict:
    t = (text or "").lower()
    for cat in CATEGORIES:
        if cat["keywords"] and any(k and k in t for k in cat["keywords"]):
            return cat
    return FALLBACK_CAT


def get(row: dict, key: str) -> str:
    return (row.get(key) or "").strip()


def build(csv_path: Path) -> None:
    with open(csv_path, "r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    if not rows:
        raise SystemExit("CSV has no data rows")

    # Minimum required headers to execute
    required = {"barcode"}
    missing = required - set(reader.fieldnames or [])
    if missing:
        raise SystemExit(f"Missing column(s): {', '.join(sorted(missing))}")

    seen: set[str] = set()
    products: list[dict] = []
    skipped = {"invalid_barcode": 0, "duplicate": 0}

    for row in rows:
        barcode = get(row, "barcode")

        if not BARCODE_RE.match(barcode):
            skipped["invalid_barcode"] += 1
            continue
        if barcode in seen:
            skipped["duplicate"] += 1
            continue
        seen.add(barcode)

        # Expanded fields (best effort; emitted only when non-empty)
        brand = get(row, "brand")
        brand_owner = get(row, "brand_owner")
        brand_tags = get(row, "brand_tags")
        generic = get(row, "generic_name")
        categories = get(row, "categories")
        category_tags = get(row, "category_tags")
        labels = get(row, "labels")
        countries = get(row, "countries")
        origins = get(row, "origins")
        quantity = get(row, "quantity")
        net_weight_value = get(row, "net_weight_value")
        net_weight_unit = get(row, "net_weight_unit")
        packaging = get(row, "packaging")
        serving_size = get(row, "serving_size")
        ingredients_text = get(row, "ingredients_text")
        allergens = get(row, "allergens")
        small = get(row, "image_small_url")
        large = get(row, "image_url")

        net_weight = " ".join(x for x in (net_weight_value, net_weight_unit) if x)

        # Name fallback hierarchy — keeps every valid-barcode row in the catalog.
        name = get(row, "name") or generic or get(row, "product_name")
        if not name and brand:
            name = f"Produk {brand}"
        if not name and brand_owner:
            name = f"Produk {brand_owner}"
        if not name:
            name = barcode

        cat = classify(
            f"{name} {generic} {categories} {category_tags} {brand} {brand_owner} {labels}"
        )
        image = small or large

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

        optional_fields = {
            "brand": brand,
            "brand_owner": brand_owner,
            "brand_tags": brand_tags,
            "generic_name": generic,
            "categories": categories,
            "category_tags": category_tags,
            "labels": labels,
            "countries": countries,
            "origins": origins,
            "quantity": quantity,
            "net_weight": net_weight,
            "packaging": packaging,
            "serving_size": serving_size,
            "ingredients_text": ingredients_text,
            "allergens": allergens,
            "image_url": image,
            "image_small_url": small,
        }
        for key, value in optional_fields.items():
            if value:
                product[key] = value

        products.append(product)

    out = {
        "version": CATALOG_VERSION,
        "generated": datetime.now(timezone.utc).isoformat(),
        "count": len(products),
        "default_price": CATALOG_DEFAULT_PRICE,
        "categories": [{"id": c["id"], "label": c["label"]} for c in CATEGORIES],
        "products": products,
    }

    # Ensure output directory exists before writing
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")

    print(f"Wrote {OUT_PATH}")
    print(f"Products: {len(products)}")
    print(f"Skipped: invalid-barcode={skipped['invalid_barcode']} duplicate={skipped['duplicate']}")


def main() -> None:
    csv_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_CSV
    build(csv_path)


if __name__ == "__main__":
    main()
