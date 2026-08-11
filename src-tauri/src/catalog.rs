use firelite::document::firelite_doc::FireLiteDoc;
use firelite::document::value::Value;
use firelite::engine::BatchMutation;
use firelite::tauri_gateway::FireLiteGateway;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Emitter, Manager, State};

/// Read-only reference catalog shipped as a bundled resource.
///
/// The catalog is imported into its own `catalog` collection which is **excluded**
/// from net-sync (see `sync.rs`), so every machine keeps an identical local copy
/// and there is no cross-peer replication churn. Cashier/inventory only read
/// real `products`; the Produk page uses the catalog as a fallback reference.
const COLLECTION: &str = "catalog";
const MARKER_DOC: &str = "catalog_import";
const CHUNK_SIZE: usize = 2000;

#[derive(Deserialize)]
struct CatalogBundle {
    version: u64,
    products: Vec<CatalogProduct>,
}

#[derive(Deserialize, Serialize)]
struct CatalogProduct {
    id: String,
    barcode: String,
    name: String,
    brand: Option<String>,
    brand_owner: Option<String>,
    brand_tags: Option<String>,
    generic_name: Option<String>,
    category_id: String,
    category_name: String,
    price: u64,
    cost_price: u64,
    stock: u64,
    low_stock_alert: u64,
    track_stock: bool,
    is_active: bool,
    has_variant: bool,
    image_url: Option<String>,
    image_small_url: Option<String>,
    categories: Option<String>,
    category_tags: Option<String>,
    labels: Option<String>,
    countries: Option<String>,
    origins: Option<String>,
    quantity: Option<String>,
    net_weight: Option<String>,
    packaging: Option<String>,
    serving_size: Option<String>,
    ingredients_text: Option<String>,
    allergens: Option<String>,
}

fn json_to_doc(json: &serde_json::Value) -> Result<FireLiteDoc, String> {
    let obj = json.as_object().ok_or("document must be object")?;
    let mut doc = FireLiteDoc::default();
    for (k, v) in obj {
        doc.insert(k.clone(), Value::from_json(v.clone()).map_err(|e| e)?);
    }
    Ok(doc)
}

fn catalog_path(app: &AppHandle) -> Result<PathBuf, String> {
    // Packaged builds expose the file at the resource root (relative entry from `bundle.resources`).
    if let Ok(p) = app.path().resolve("indonesian-catalog.json", BaseDirectory::Resource) {
        if p.exists() {
            return Ok(p);
        }
    }
    // `tauri dev` fallback: keep a manifest-relative copy discoverable.
    let dev = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("resources")
        .join("indonesian-catalog.json");
    if dev.exists() {
        return Ok(dev);
    }
    Err("Catalog resource (indonesian-catalog.json) not found".into())
}

fn docs_equal(existing: &FireLiteDoc, target: &FireLiteDoc) -> bool {
    // Cheap content comparison for the fields we own (ignores _id/_time).
    const FIELDS: [&str; 4] = ["name", "barcode", "price", "image_url"];
    FIELDS.iter().all(|f| {
        let a = existing.get(*f);
        let b = target.get(*f);
        match (a, b) {
            (Some(x), Some(y)) => x == y,
            (None, None) => true,
            _ => false,
        }
    })
}

/// Imports the bundled Indonesian product catalog into the local `catalog`
/// collection. Idempotent: skips rows that already exist unchanged, and once a
/// whole bundle version is imported it will not run again until the JSON version
/// bumps. Emits progress/done events so the UI can show non-blocking status.
/// Ensures an FTS index exists on `catalog.name` so `MatchPrefix` queries can
/// resolve to the prefix scan instead of a full collection scan. Idempotent:
/// only creates the index when the definition is absent. The catalog is
/// bundled reference data (identical on every machine), so a local FTS index
/// costs nothing extra across peers.
fn ensure_catalog_fts(gateway: &FireLiteGateway) -> Result<(), String> {
    let existing = gateway.db.list_indexes(Some(COLLECTION));
    let has_name = existing
        .fts
        .get(COLLECTION)
        .map(|fields| fields.iter().any(|f| f == "name"))
        .unwrap_or(false);
    if !has_name {
        gateway
            .db
            .create_fts_index(COLLECTION, "name")
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn import_catalog(
    app: AppHandle,
    gateway: State<'_, FireLiteGateway>,
) -> Result<usize, String> {
    ensure_catalog_fts(&gateway)?;

    let path = catalog_path(&app)?;
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    let bundle: CatalogBundle = serde_json::from_slice(&bytes).map_err(|e| e.to_string())?;
    let total = bundle.products.len();

    // Fast path: same version already imported.
    if let Ok(Some(marker)) = gateway.db.get("app_state", MARKER_DOC) {
        if let Some(Value::Int(v)) = marker.get("version") {
            if (*v as u64) == bundle.version {
                return Ok(total);
            }
        }
    }

    let mut imported: usize = 0;
    let mut batch: Vec<BatchMutation> = Vec::with_capacity(CHUNK_SIZE);

    for product in &bundle.products {
        // Serialize the row as the target doc.
        let data = serde_json::to_value(product).map_err(|e| e.to_string())?;
        let target = json_to_doc(&data)?;

        // Skip unchanged existing rows so re-runs are cheap.
        if let Ok(Some(existing)) = gateway.db.get(COLLECTION, &product.id) {
            if docs_equal(&existing, &target) {
                continue;
            }
        }

        batch.push(BatchMutation::Put {
            collection: COLLECTION.to_string(),
            doc_id: product.id.clone(),
            doc: target,
        });

        if batch.len() >= CHUNK_SIZE {
            gateway
                .db
                .write_batch(std::mem::take(&mut batch))
                .map_err(|e| e.to_string())?;
            imported += CHUNK_SIZE;
            let _ = app.emit(
                "catalog://progress",
                serde_json::json!({ "loaded": imported, "total": total }),
            );
        }
    }

    if !batch.is_empty() {
        imported += batch.len();
        gateway
            .db
            .write_batch(batch)
            .map_err(|e| e.to_string())?;
        let _ = app.emit(
            "catalog://progress",
            serde_json::json!({ "loaded": imported, "total": total }),
        );
    }

    // Record completion so a later boot skips re-importing this version.
    let mut marker = FireLiteDoc::default();
    marker.insert(
        "version",
        Value::from_json(serde_json::json!(bundle.version))?,
    );
    gateway
        .db
        .put("app_state", MARKER_DOC, &marker)
        .map_err(|e| e.to_string())?;

    let _ = app.emit("catalog://done", serde_json::json!({ "count": total }));

    Ok(total)
}
