mod printer_detect;
mod printer_commands;
mod data_sqlite;

use tauri::Manager;
use tauri_plugin_store::Builder;

// use data_sqlite::init_db;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {

    tauri::Builder::default()

        // .plugin(tauri_plugin_store::init())
        .plugin(Builder::default().build())

        .setup(|app| {

            let handle = app.handle();

            tauri::async_runtime::block_on(async move {

                let app_dir = handle
                    .path()
                    .app_data_dir()
                    .expect("Failed to resolve app data dir");

                // ensure directory exists
                std::fs::create_dir_all(&app_dir).expect("Failed to create app dir");

                let db_path = app_dir.join("tokoc.db");

                let db = data_sqlite::init_db(db_path)
                    .await
                    .expect("Failed to initialize DB");
                

                handle.manage(db);

            });

            Ok(())
        })

        .invoke_handler(tauri::generate_handler![

            printer_detect::auto_detect_printer,
            printer_commands::print_receipt,

            data_sqlite::update_doc_patch,
            data_sqlite::execute_sql,
            data_sqlite::execute_batch,
            data_sqlite::upload_file,
            data_sqlite::get_file,
            data_sqlite::delete_file,
            data_sqlite::export_db_binary,
            data_sqlite::import_db_binary,

        ])

        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}