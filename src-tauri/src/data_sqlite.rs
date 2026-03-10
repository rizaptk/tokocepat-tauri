use tauri::{command, AppHandle, Runtime, State, Manager};

use serde::Deserialize;
use serde_json::Value;

use std::fs;
use std::path::PathBuf;

use sqlx::{SqlitePool, sqlite::{SqliteConnectOptions, SqlitePoolOptions}, Row, Column};

pub struct DbState {
    pub pool: SqlitePool,
}

#[derive(Deserialize)]
pub struct BatchQuery {
    pub sql: String,
    pub bindings: Vec<Value>,
}

pub async fn init_db(path: PathBuf) -> Result<DbState, sqlx::Error> {

    // let db_url = format!("sqlite://{}", path.to_string_lossy());
    // let path_str = path.to_string_lossy().replace("\\", "/");

    // let db_url = format!("sqlite:///{path_str}");

    // Build connection options directly from path
    let options = SqliteConnectOptions::new()
        .filename(&path)
        .create_if_missing(true);

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        // .connect(&db_url)
        .connect_with(options)
        .await?;

    // SQLite performance settings
    sqlx::query("PRAGMA journal_mode=WAL").execute(&pool).await?;
    sqlx::query("PRAGMA synchronous=NORMAL").execute(&pool).await?;
    sqlx::query("PRAGMA temp_store=MEMORY").execute(&pool).await?;
    sqlx::query("PRAGMA mmap_size = 268435456").execute(&pool).await?;

    // schema
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS documents (
            collection_id TEXT,
            doc_id TEXT,
            data TEXT,
            PRIMARY KEY (collection_id, doc_id)
        );

        CREATE TABLE IF NOT EXISTS files (
            path TEXT PRIMARY KEY,
            data BLOB,
            contentType TEXT,
            size INTEGER,
            updatedAt TEXT
        );
        "#
    )
    .execute(&pool)
    .await?;

    Ok(DbState { pool })
}

pub fn resolve_db_path<R: Runtime>(
    app: &AppHandle<R>,
    db_url: &str
) -> Result<PathBuf, String> {

    let db_filename = db_url.strip_prefix("sqlite:").unwrap_or(db_url);

    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    Ok(app_data.join(db_filename))
}

#[command]
pub async fn update_doc_patch(
    db: State<'_, DbState>,
    collection_id: String,
    doc_id: String,
    patch: Value,
) -> Result<(), String> {

    sqlx::query(
        "UPDATE documents
         SET data = json_patch(data, ?)
         WHERE collection_id = ? AND doc_id = ?"
    )
    .bind(patch.to_string())
    .bind(collection_id)
    .bind(doc_id)
    .execute(&db.pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[command]
pub async fn execute_sql(
    db: State<'_, DbState>,
    sql: String,
    bindings: Vec<Value>,
) -> Result<Vec<Value>, String> {

    let mut query = sqlx::query(&sql);

    for b in bindings {

        query = match b {
            Value::String(s) => query.bind(s),
            Value::Number(n) => {
                if let Some(i) = n.as_i64() {
                    query.bind(i)
                } else if let Some(f) = n.as_f64() {
                    query.bind(f)
                } else {
                    query.bind(n.to_string())
                }
            }
            Value::Bool(b) => query.bind(b),
            Value::Null => query.bind(None::<String>),
            _ => query.bind(b.to_string()),
        };

    }

    let rows = query
        .fetch_all(&db.pool)
        .await
        .map_err(|e| e.to_string())?;

    let mut result = Vec::new();

    for row in rows {

        let mut obj = serde_json::Map::new();

        for column in row.columns() {

            let name = column.name();

            let val: Result<String, _> = row.try_get(name);

            obj.insert(
                name.to_string(),
                val.unwrap_or_default().into(),
            );
        }

        result.push(Value::Object(obj));
    }

    Ok(result)
}

#[command]
pub async fn execute_batch(
    db: State<'_, DbState>,
    queries: Vec<BatchQuery>,
) -> Result<(), String> {

    let mut tx = db.pool
        .begin()
        .await
        .map_err(|e| e.to_string())?;

    for q in queries {

        let mut query = sqlx::query(&q.sql);

        for b in q.bindings {

            query = match b {
                Value::String(s) => query.bind(s),
                Value::Number(n) => {
                    if let Some(i) = n.as_i64() {
                        query.bind(i)
                    } else if let Some(f) = n.as_f64() {
                        query.bind(f)
                    } else {
                        query.bind(n.to_string())
                    }
                }
                Value::Bool(b) => query.bind(b),
                Value::Null => query.bind(None::<String>),
                _ => query.bind(b.to_string()),
            };

        }

        query
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;
    }

    tx.commit()
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[command]
pub async fn upload_file(
    db: State<'_, DbState>,
    path: String,
    data: Vec<u8>,
    content_type: String,
) -> Result<(), String> {

    sqlx::query(
        "INSERT INTO files (path, data, contentType, size, updatedAt)
         VALUES (?, ?, ?, ?, datetime('now'))
         ON CONFLICT(path) DO UPDATE SET
            data=excluded.data,
            contentType=excluded.contentType,
            size=excluded.size,
            updatedAt=datetime('now')"
    )
    .bind(path)
    .bind(data.clone())
    .bind(content_type)
    .bind(data.len() as i64)
    .execute(&db.pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[command]
pub async fn export_db_binary<R: Runtime>(
    app: AppHandle<R>,
    db_path: String,
) -> Result<Vec<u8>, String> {

    let path = resolve_db_path(&app, &db_path)?;

    fs::read(path)
        .map_err(|e| format!("Failed to read DB file: {e}"))
}

#[command]
pub async fn import_db_binary<R: Runtime>(
    app_handle: AppHandle<R>,
    db: State<'_, DbState>,
    db_path: String,
    data: Vec<u8>,
) -> Result<(), String> {

    let path = resolve_db_path(&app_handle, &db_path)?;

    db.pool.close().await;

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| e.to_string())?;
    }

    fs::write(path, data)
        .map_err(|e| format!("Failed to write DB file: {e}"))?;

    Ok(())
}

#[command]
pub async fn get_file(
    db: State<'_, DbState>,
    path: String,
) -> Result<Option<serde_json::Value>, String> {

    let row = sqlx::query(
        "SELECT data, contentType FROM files WHERE path=?"
    )
    .bind(path)
    .fetch_optional(&db.pool)
    .await
    .map_err(|e| e.to_string())?;

    if let Some(row) = row {

        let data: Vec<u8> = row.try_get(0).unwrap_or_default();
        let content_type: String = row.try_get(1).unwrap_or_default();

        Ok(Some(serde_json::json!({
            "data": data,
            "contentType": content_type
        })))

    } else {
        Ok(None)
    }
}

#[command]
pub async fn delete_file(
    db: State<'_, DbState>,
    path: String,
) -> Result<(), String> {

    sqlx::query("DELETE FROM files WHERE path=?")
        .bind(path)
        .execute(&db.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}