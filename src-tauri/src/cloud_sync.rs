use firelite::cloud_sync::{CloudStatus, CloudSync, CloudSyncMode};
use firelite::document::firelite_doc::FireLiteDoc;
use firelite::document::value::Value;
use firelite::tauri_gateway::FireLiteGateway;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use tokio::sync::Mutex;

pub struct CloudSyncState {
    pub syncer: Arc<Mutex<Option<CloudSync>>>,
    pub app_handle: AppHandle,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudSyncConfig {
    pub enabled: bool,
    pub mode: CloudSyncMode,
    pub server_url: Option<String>,
    pub bind_addr: Option<String>,
    pub room_name: Option<String>,
    pub room_key: Option<String>,
    pub auth_token: String,
}

fn mode_to_str(mode: &CloudSyncMode) -> String {
    match mode {
        CloudSyncMode::Server => "server".to_string(),
        CloudSyncMode::Client => "client".to_string(),
    }
}

fn parse_mode(mode: &str) -> CloudSyncMode {
    if mode.eq_ignore_ascii_case("server") {
        CloudSyncMode::Server
    } else {
        CloudSyncMode::Client
    }
}

fn save_config(gateway: &FireLiteGateway, config: &CloudSyncConfig) {
    let mut prefs = FireLiteDoc::default();
    prefs.insert("enabled", Value::Bool(config.enabled));
    prefs.insert("mode", Value::String(mode_to_str(&config.mode)));
    if let Some(v) = &config.server_url {
        prefs.insert("server_url", Value::String(v.clone()));
    }
    if let Some(v) = &config.bind_addr {
        prefs.insert("bind_addr", Value::String(v.clone()));
    }
    if let Some(v) = &config.room_name {
        prefs.insert("room_name", Value::String(v.clone()));
    }
    if let Some(v) = &config.room_key {
        prefs.insert("room_key", Value::String(v.clone()));
    }
    prefs.insert("auth_token", Value::String(config.auth_token.clone()));
    let _ = gateway.db.put("app_state", "cloud_sync_prefs", &prefs);
}

/// Start/stop Cloud Sync. Mirrors the net_sync toggle flow. In
/// client mode, `server_url` points to the central server (ws:// or wss://).
/// In server mode, `bind_addr` is the bind address to host the cloud hub.
#[tauri::command]
pub async fn toggle_cloud_sync(
    enabled: bool,
    mode: String,
    server_url: Option<String>,
    bind_addr: Option<String>,
    room_name: Option<String>,
    room_key: Option<String>,
    auth_token: String,
    state: State<'_, CloudSyncState>,
    gateway: State<'_, FireLiteGateway>,
) -> Result<String, String> {
    let mut syncer_lock = state.syncer.lock().await;
    let app = state.app_handle.clone();
    let mode = parse_mode(&mode);
    let self_id = crate::hwid::get_license_hwid();

    let config = CloudSyncConfig {
        enabled,
        mode: mode.clone(),
        server_url: server_url.clone(),
        bind_addr: bind_addr.clone(),
        room_name: room_name.clone(),
        room_key: room_key.clone(),
        auth_token: auth_token.clone(),
    };

    // OPTIMIZATION: Check if the state is already the same
    let current_config = gateway
        .db
        .get("app_state", "cloud_sync_prefs")
        .ok()
        .flatten();
    let doc = current_config.unwrap_or_default();
    let current_enabled = doc
        .get("enabled")
        .and_then(|v| v.to_json().as_bool())
        .unwrap_or(false);

    if enabled != current_enabled {
        save_config(&gateway, &config);
    }

    if !enabled {
        if !syncer_lock.is_none() {
            if let Some(s) = syncer_lock.take() {
                s.stop();
            }
        }
        let _ = app.emit("cloud_sync_off", ());
        return Ok("OFF".into());
    }

    // Only start if not already started
    if syncer_lock.is_none() {
        let db = Arc::clone(&gateway.db);

        let new_syncer = match mode {
            CloudSyncMode::Server => {
                let bind = bind_addr
                    .clone()
                    .unwrap_or_else(|| "0.0.0.0:8056".to_string());
                let cs = CloudSync::server(db, &self_id, &auth_token);
                cs.start(&bind)
                    .await
                    .map_err(|e| format!("cloud sync server start failed: {}", e))?;
                cs
            }
            CloudSyncMode::Client => {
                let url = server_url
                    .clone()
                    .unwrap_or_else(|| "ws://127.0.0.1:8056".to_string());
                let room_name = room_name.unwrap_or_else(|| "default".to_string());
                let room_key = room_key.unwrap_or_default();
                let cs = CloudSync::client(db, &self_id, &room_name, &room_key, &auth_token);
                cs.start(&url)
                    .await
                    .map_err(|e| format!("cloud sync client start failed: {}", e))?;
                cs
            }
        };

        *syncer_lock = Some(new_syncer);
        let _ = app.emit("cloud_sync_on", ());
    }

    Ok("ON".into())
}

#[tauri::command]
pub async fn get_cloud_sync_status(
    state: State<'_, CloudSyncState>,
) -> Result<Option<CloudStatus>, String> {
    let lock = state.syncer.lock().await;
    Ok(lock.as_ref().map(|s| s.status()))
}

/// Re-enable Cloud Sync on startup if it was previously enabled.
#[tauri::command]
pub async fn bootstrap_cloud_sync(
    state: State<'_, CloudSyncState>,
    gateway: State<'_, FireLiteGateway>,
) -> Result<(), String> {
    let config = gateway.db.get("app_state", "cloud_sync_prefs").ok().flatten();
    if let Some(doc) = config {
        let enabled = doc
            .get("enabled")
            .and_then(|v| v.to_json().as_bool())
            .unwrap_or(false);
        if enabled {
            let mode = doc
                .get("mode")
                .and_then(|v| v.to_json().as_str())
                .unwrap_or("client")
                .to_string();
            let server_url = doc
                .get("server_url")
                .and_then(|v| v.to_json().as_str())
                .map(|s| s.to_string());
            let bind_addr = doc
                .get("bind_addr")
                .and_then(|v| v.to_json().as_str())
                .map(|s| s.to_string());
            let room_name = doc
                .get("room_name")
                .and_then(|v| v.to_json().as_str())
                .map(|s| s.to_string());
            let room_key = doc
                .get("room_key")
                .and_then(|v| v.to_json().as_str())
                .map(|s| s.to_string());
            let auth_token = doc
                .get("auth_token")
                .and_then(|v| v.to_json().as_str())
                .unwrap_or_default()
                .to_string();

            let _ = toggle_cloud_sync(
                true,
                mode,
                server_url,
                bind_addr,
                room_name,
                room_key,
                auth_token,
                state,
                gateway,
            )
            .await;
        }
    }
    Ok(())
}