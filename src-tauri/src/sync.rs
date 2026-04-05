use firelite::net_sync::{NetSyncer, NetworkStatus};
use firelite::engine::{SecurityRule, AccessOp};
use tauri::State;
use std::sync::Arc;
use tokio::sync::Mutex;
use crate::license;
use firelite::tauri_gateway::FireLiteGateway;

pub struct SyncState {
    pub syncer: Arc<Mutex<Option<NetSyncer>>>,
    pub is_authority: Arc<Mutex<bool>>,
}

#[tauri::command]
pub async fn toggle_net_sync(
    enabled: bool,
    is_authority: bool,
    leader_id: String, // Consumer passes the designated Leader's HWID
    port: u16,
    state: State<'_, SyncState>,
    gateway: State<'_, FireLiteGateway>,
) -> Result<String, String> {
    let mut syncer_lock = state.syncer.lock().await;

    if !enabled {
        *syncer_lock = None;
        // Restore default behavior (allow local writes)
        gateway.db.set_security_rules(vec![]); 
        return Ok("Sync stopped".into());
    }

    // --- 1. LICENSE VALIDATION ---
    let license_data = license::get_license_db(&gateway).ok_or("License not found")?;
    // Note: Use the Claims struct from your license.rs
    let decoded = jsonwebtoken::dangerous_insecure_decode::<license::Claims>(&license_data.jwt)
        .map_err(|e| e.to_string())?;
    
    if decoded.claims.max_seats.unwrap_or(0) <= 1 {
        return Err("License plan does not support Multi-Device Sync".into());
    }

    // --- 2. ENGINE-LEVEL ACCESS CONTROL ---
    let mut rules = Vec::new();
    
    if !is_authority {
        // FOLLOWER PROTECTION: 
        // Prevent the local app/user from tampering with synced security data.
        // follower must receive their permissions via net_sync from the Leader.
        rules.push(SecurityRule {
            collection_prefix: "__firelite_security".to_string(),
            op: AccessOp::Put,
            allow: false,
        });
        rules.push(SecurityRule {
            collection_prefix: "__firelite_security".to_string(),
            op: AccessOp::Delete,
            allow: false,
        });
    }

    gateway.db.set_security_rules(rules);

    // --- 3. START SYNC ENGINE ---
    let db = Arc::clone(&gateway.db);
    let self_id = crate::hwid::get_license_hwid(); 
    
    // EXCLUSION LIST: 
    // "app_state" contains local license/JWT info unique to this hardware.
    // Syncing it would cause "Cloned License" errors on other devices.
    let excluded = vec!["app_state".to_string()];

    let new_syncer = NetSyncer::new(
        db, 
        &self_id, 
        &leader_id, 
        excluded, 
        is_authority
    );

    new_syncer.start(port).await.map_err(|e| e.to_string())?;
    
    *syncer_lock = Some(new_syncer);
    *state.is_authority.lock().await = is_authority;

    Ok(format!("Network Active as {}", if is_authority { "Leader" } else { "Follower" }))
}

#[tauri::command]
pub async fn get_sync_status(state: State<'_, SyncState>) -> Result<Option<NetworkStatus>, String> {
    let lock = state.syncer.lock().await;
    // status() returns the NetworkStatus struct defined in net_sync.rs
    Ok(lock.as_ref().map(|s| s.status()))
}

#[tauri::command]
pub async fn check_sync_security_exists(gateway: State<'_, FireLiteGateway>) -> bool {
    // Check if the internal security config document is present
    gateway.db.get("__firelite_security", "config")
        .map(|doc| doc.is_some())
        .unwrap_or(false)
}

#[tauri::command]
pub async fn init_sync_security(pin: String, gateway: State<'_, FireLiteGateway>) -> Result<(), String> {
    let mut doc = firelite::document::firelite_doc::FireLiteDoc::default();
    // It's recommended to hash the pin before saving, but for now we save as string
    doc.insert("leader_pin", firelite::document::value::Value::String(pin));
    doc.insert("created_at", firelite::document::value::Value::ServerTimestamp);
    
    gateway.db.put("__firelite_security", "config", &doc).map_err(|e| e.to_string())
}