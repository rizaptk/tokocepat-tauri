mod printer_commands;
mod printer_detect;
use tauri::Manager;
use tauri_plugin_store::Builder;
use std::collections::HashSet;

// 1. Import the tauri_gateway module itself, not just the function
use firelite::config::FireLiteConfig;
use firelite::engine::FireLite;
pub use firelite::tauri_gateway::{self, FireLiteGateway}; // Note the 'self'

mod printmon;
mod license;
mod maintenance;
mod hwid;
mod sync;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    license::init_env(); 
    tauri::Builder::default()
        .plugin(Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let package_info = app.package_info();
            let version = &package_info.version;
            let app_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to resolve app data dir");
            std::fs::create_dir_all(&app_dir).ok();
            let db_path = app_dir.join("tokocepat.db");

            // restore pending flag
            let flag_path = app_dir.join("restore_pending.flag");

            // --- NATIVE RESTORE LOGIC ---
            if flag_path.exists() {
                if let Ok(staging_path_str) = std::fs::read_to_string(&flag_path) {
                    let staging_path = std::path::PathBuf::from(staging_path_str);
                    if staging_path.exists() {
                        // Replace live DB with staging DB
                        let _ = std::fs::remove_file(&db_path);
                        let _ = std::fs::rename(&staging_path, &db_path);
                    }
                }
                let _ = std::fs::remove_file(&flag_path);
            }

            let mut cfg = FireLiteConfig::default();
            cfg.encryption_key = Some("e172dd95f4feb21412a692e73929961e".to_string());
            cfg.encrypted_cols = Some(["app_state", "__firelite_security"].into_iter().map(|s| s.to_string()).collect::<HashSet<String>>());

            let db = FireLite::open(db_path, cfg)
                .expect("Failed to init FireLite");
                

            let gateway = FireLiteGateway::new(db);
            
            app.manage(gateway.clone());
            
            let sync_state = sync::SyncState {
                syncer: std::sync::Arc::new(tokio::sync::Mutex::new(None)),
                app_handle: app.handle().clone(),
            };
            
            app.manage(sync_state);
            
            printmon::start_monitor(app.handle().clone());
            
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                license::run_heartbeat(handle).await;
            });

            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_title(&format!("TokoCepat v{}", version));
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                if let Some(gateway) = window.try_state::<FireLiteGateway>() {
                    let _ = gateway.db.flush();
                    gateway.cleanup_window_subscriptions(window.label());
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            printer_detect::auto_detect_printer,
            printer_commands::print_receipt,
            tauri_gateway::firelite_exec,
            hwid::get_license_hwid,
            license::check_license,
            license::activate_trial,
            license::claim_license,
            license::activate_manual_license,
            license::deactivate_license, 
            
            maintenance::native_backup,
            // maintenance::native_restore,

            sync::toggle_net_sync,
            sync::get_sync_status,
            sync::check_sync_security_exists,
            sync::list_network_peers,
            sync::bootstrap_sync,

        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
