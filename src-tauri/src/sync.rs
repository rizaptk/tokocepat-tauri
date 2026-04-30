use firelite::document::firelite_doc::FireLiteDoc;
use firelite::document::value::Value;
use firelite::net_sync::{NetSyncer, NetworkStatus};
use firelite::query::filter::Operator;
use firelite::query::query::Query;
use firelite::tauri_gateway::FireLiteGateway;
use std::collections::HashMap;
use std::sync::Arc;
use tauri::State;
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;

pub struct SyncState {
    pub syncer: Arc<Mutex<Option<NetSyncer>>>,
    pub app_handle: AppHandle,
}

#[tauri::command]
pub async fn toggle_net_sync(
    enabled: bool,
    port: u16,
    state: State<'_, SyncState>,
    gateway: State<'_, FireLiteGateway>,
) -> Result<String, String> {
    let mut syncer_lock = state.syncer.lock().await;
    let app = state.app_handle.clone();

    // OPTIMIZATION: Check if the state is already the same
    let current_config = gateway.db.get("app_state", "sync_prefs").ok().flatten();
    let doc = current_config.unwrap_or_default();
    let current_enabled = doc
        .get("enabled")
        .and_then(|v| v.to_json().as_bool())
        .unwrap_or(false);

    // println!("{} -> {}",&current_enabled, &enabled);

    if enabled != current_enabled {
        let mut prefs = FireLiteDoc::default();
        prefs.insert("enabled", Value::Bool(enabled));
        let _ = gateway.db.put("app_state", "sync_prefs", &prefs);
    }

    if !enabled {
        if !syncer_lock.is_none() {
            if let Some(s) = syncer_lock.take() {
                s.stop();
            }
        }
        let _ = app.emit("sync_off", ());
        return Ok("OFF".into());
    }

    // Only start if not already started
    if syncer_lock.is_none() {
        // 1. Acquire Multicast Lock ONLY when starting
        #[cfg(target_os = "android")]
        acquire_multicast_lock(); 
        
        let self_id = crate::hwid::get_license_hwid();
        let db = Arc::clone(&gateway.db);
        let excluded = vec!["app_state".to_string()];

        let new_syncer = NetSyncer::new(db, &self_id, "tokocepat", excluded);
        new_syncer.start(port).await.map_err(|e| e.to_string())?;

        *syncer_lock = Some(new_syncer);
        let _ = app.emit("sync_on", ());
    }

    Ok("ON".into())
}

#[tauri::command]
pub async fn get_sync_status(state: State<'_, SyncState>) -> Result<Option<NetworkStatus>, String> {
    let lock = state.syncer.lock().await;
    match lock.as_ref() {
        // NetSyncer::status() is public in the library implementation
        Some(s) => Ok(Some(s.status())),
        None => Ok(None),
    }
}

#[tauri::command]
pub async fn check_sync_security_exists(
    gateway: State<'_, FireLiteGateway>,
) -> Result<bool, String> {
    Ok(gateway
        .db
        .get("__firelite_security", "config")
        .map_err(|e| e.to_string())?
        .is_some())
}

#[tauri::command]
pub async fn list_network_peers(
    state: State<'_, SyncState>,
    gateway: State<'_, FireLiteGateway>,
) -> Result<Vec<serde_json::Value>, String> {
    // 1. Get the Live Peers (raw HWIDs)
    let syncer_guard = state.syncer.lock().await;
    let live_ids = match syncer_guard.as_ref() {
        Some(s) => s.status().known_peers,
        None => Vec::new(),
    };

    if live_ids.is_empty() {
        return Ok(Vec::new());
    }

    // 2. Map the Vec<String> of IDs to Vec<Value> for the FireLite Query
    let id_values: Vec<Value> = live_ids
        .iter()
        .map(|id| Value::String(id.clone()))
        .collect();

    // 2. Get Authorized Peers using the NEW "id" virtual field
    // Note: We use "id" here, not "_id"
    let query =
        Query::new("__firelite_security").where_filter("id", Operator::In, Value::Array(id_values));

    let db_results = gateway.db.query(query).map_err(|e| e.to_string())?;

    // 4. Create a lookup map for the results found in the database
    let mut db_map = HashMap::new();
    for (id, doc) in db_results {
        db_map.insert(id, doc);
    }

    // 5. Construct the final list based ONLY on live_ids
    let mut final_list = Vec::new();
    for id in live_ids {
        let db_doc = db_map.get(&id);

        final_list.push(serde_json::json!({
            "id": id,
            "is_online": true,
            // Status: use DB value if exists, otherwise "new_device"
            "status": db_doc.and_then(|d| d.get("status"))
                .map(|v| v.to_json())
                .unwrap_or(serde_json::json!("new_device")),
            // Name: use DB name if exists, otherwise "Perangkat Baru"
            "name": db_doc.and_then(|d| d.get("name"))
                .map(|v| v.to_json())
                .unwrap_or(serde_json::json!("Perangkat Baru"))
        }));
    }

    Ok(final_list)
}

#[tauri::command]
pub async fn bootstrap_sync(
    state: State<'_, SyncState>,
    gateway: State<'_, FireLiteGateway>,
) -> Result<(), String> {
    // 1. Check DB if sync was previously enabled
    let config = gateway.db.get("app_state", "sync_prefs").ok().flatten();
    if let Some(doc) = config {
        if let Some(Value::Bool(true)) = doc.get("enabled") {
            // Pass through to your existing toggle logic (port 8055 default)
            let _ = toggle_net_sync(true, 8055, state, gateway).await;
        }
    }
    Ok(())
}

#[cfg(target_os = "android")]
pub fn acquire_multicast_lock() {
    use jni::objects::JObject;
    
    let res = (|| {
        let ctx = ndk_context::android_context();
        let vm = unsafe { jni::JavaVM::from_raw(ctx.vm().cast()) }.ok()?;
        let mut env = vm.attach_current_thread().ok()?;

        let context = unsafe { JObject::from_raw(ctx.context().cast()) };
        let wifi_service_str = env.new_string("wifi").ok()?;
        
        let wifi_manager = env.call_method(
            &context, 
            "getSystemService", 
            "(Ljava/lang/String;)Ljava/lang/Object;", 
            &[(&wifi_service_str).into()]
        ).ok()?.l().ok()?;

        let lock_tag = env.new_string("tokocepat_sync_lock").ok()?;
        
        let mcast_lock = env.call_method(
            &wifi_manager, 
            "createMulticastLock", 
            "(Ljava/lang/String;)Landroid/net/wifi/WifiManager$MulticastLock;", 
            &[(&lock_tag).into()]
        ).ok()?.l().ok()?;

        let _ = env.call_method(&mcast_lock, "acquire", "()V", &[]);
        Some(())
    })();

    if res.is_none() {
        eprintln!("Failed to acquire Multicast Lock. Sync may not work on this WiFi.");
    }
}