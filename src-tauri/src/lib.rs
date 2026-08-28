mod printer_commands;
mod printer_detect;
use std::collections::HashSet;
use tauri::Manager;
use tauri_plugin_store::Builder;

// 1. Import the tauri_gateway module itself, not just the function
use firelite::config::FireLiteConfig;
use firelite::engine::FireLite;
pub use firelite::tauri_gateway::{self, FireLiteGateway}; // Note the 'self'

mod hwid;
mod license;
mod maintenance;
mod printmon;
mod sync;
mod theme;
mod android;
mod cloud_sync;
mod catalog;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    license::init_env();
    let mut builder = tauri::Builder::default();
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|_app, _args, _cwd| {}));
    }
    // tauri::Builder::default()
    //     .plugin(tauri_plugin_single_instance::init(|_app, _args, _cwd| {}))
    builder.plugin(Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            #[cfg(target_os = "android")]
            android::android_wake_lock();

            #[cfg(desktop)]
            let package_info = app.package_info();

            #[cfg(desktop)]
            let version = &package_info.version;
            
            let app_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to resolve app data dir");
            std::fs::create_dir_all(&app_dir).ok();
            let db_path = app_dir.join("kastoko.db");

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
            cfg.encryption_key = std::env::var("FIRELITE_ENCRYPTION_KEY")
                .ok()
                .filter(|k| !k.is_empty())
                .or_else(|| {
                    eprintln!("FIRELITE_ENCRYPTION_KEY not set in environment, using legacy fallback key");
                    Some("e172dd95f4feb21412a692e73929961e".to_string())
                });
            cfg.encrypted_cols = Some(
                ["app_state", "__firelite_security"]
                    .into_iter()
                    .map(|s| s.to_string())
                    .collect::<HashSet<String>>(),
            );

            let db = FireLite::open(db_path, cfg).expect("Failed to init FireLite");

            let gateway = FireLiteGateway::new(db);

            license::migrate_legacy_anchors(&gateway, &app_dir);

            app.manage(gateway.clone());

            let sync_state = sync::SyncState {
                syncer: std::sync::Arc::new(tokio::sync::Mutex::new(None)),
                app_handle: app.handle().clone(),
            };

            app.manage(sync_state);

            let cloud_sync_state = cloud_sync::CloudSyncState {
                syncer: std::sync::Arc::new(tokio::sync::Mutex::new(None)),
                app_handle: app.handle().clone(),
            };

            app.manage(cloud_sync_state);

            printmon::start_monitor(app.handle().clone());

            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                license::run_heartbeat(handle).await;
            });

            #[cfg(desktop)]
            {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_title(&format!("Kastoko v{}", version));
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            #[cfg(target_os = "android")]
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close(); 
            }

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
    license::start_trial,
    license::claim_license,
            license::activate_manual_license,
            license::deactivate_license,
            license::open_pricing,
            maintenance::native_backup,
            
            sync::toggle_net_sync,
            sync::get_sync_status,
            sync::check_sync_security_exists,
            sync::list_network_peers,
            sync::bootstrap_sync,

            cloud_sync::toggle_cloud_sync,
            cloud_sync::get_cloud_sync_status,
            cloud_sync::bootstrap_cloud_sync,

            catalog::import_catalog,

            theme::set_theme,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
