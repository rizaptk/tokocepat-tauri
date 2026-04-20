use std::fs::{self, File};
use std::io::{Write, Read};
use std::path::Path;
use tauri::{AppHandle, Runtime};
use crate::tauri_gateway::FireLiteGateway;
use walkdir::WalkDir;
use zip::write::SimpleFileOptions;

#[tauri::command]
pub async fn native_backup<R: Runtime>(
    _app: AppHandle<R>,
    state: tauri::State<'_, FireLiteGateway>,
    target_path: String,
) -> Result<(), String> {
    let gateway = state.inner();
    
    // 1. Setup a temporary directory for an atomic snapshot
    // This ensures we copy a consistent state of all shards
    let mut temp_snapshot_dir = std::env::temp_dir();
    temp_snapshot_dir.push(format!("fl_snapshot_{}", uuid::Uuid::new_v4()));

    // 2. Perform the FireLite atomic backup (copies folders/files to temp)
    gateway.db.backup(&temp_snapshot_dir)
        .map_err(|e| format!("Database snapshot failed: {}", e))?;

    // 3. Create the ZIP archive at the target path
    let path = Path::new(&target_path);
    let file = File::create(path).map_err(|e| format!("Failed to create backup file: {}", e))?;
    let mut zip = zip::ZipWriter::new(file);
    let options = SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .unix_permissions(0o755);

    // 4. Recursively walk through the temp snapshot and add to ZIP
    let prefix = &temp_snapshot_dir;
    let walk = WalkDir::new(prefix);

    for entry in walk.into_iter().filter_map(|e| e.ok()) {
        let entry_path = entry.path();
        let name = entry_path.strip_prefix(prefix).unwrap();

        // Write file or directory to ZIP
        if entry_path.is_file() {
            zip.start_file(name.to_string_lossy(), options)
                .map_err(|e| e.to_string())?;
            let mut f = File::open(entry_path).map_err(|e| e.to_string())?;
            let mut buffer = Vec::new();
            f.read_to_end(&mut buffer).map_err(|e| e.to_string())?;
            zip.write_all(&buffer).map_err(|e| e.to_string())?;
        } else if !name.as_os_str().is_empty() {
            zip.add_directory(name.to_string_lossy(), options)
                .map_err(|e| e.to_string())?;
        }
    }

    zip.finish().map_err(|e| format!("Failed to finalize ZIP: {}", e))?;

    // 5. Cleanup the temporary snapshot folder
    let _ = fs::remove_dir_all(temp_snapshot_dir);

    Ok(())
}

// #[tauri::command]
// pub async fn native_restore<R: Runtime>(
//     app: AppHandle<R>,
//     state: tauri::State<'_, FireLiteGateway>,
//     source_path: String,
// ) -> Result<(), String> {
//     let gateway = state.inner();
    
//     // 1. Flush current DB to ensure everything is written
//     let _ = gateway.db.flush();

//     // 2. Decompress the backup file to a staging file
//     let db_dir = app.path().app_data_dir().unwrap();
//     let staging_path = db_dir.join("tokocepat.db.staging");
//     // Removed unused actual_db_path variable

//     let compressed_file = File::open(&source_path).map_err(|e| e.to_string())?;
//     let mut decoder = GzDecoder::new(compressed_file);
//     let mut staging_file = File::create(&staging_path).map_err(|e| e.to_string())?;

//     std::io::copy(&mut decoder, &mut staging_file).map_err(|e| e.to_string())?;

//     // 3. Write a "pending restore" flag file
//     let restore_flag = db_dir.join("restore_pending.flag");
//     fs::write(restore_flag, staging_path.to_str().unwrap()).map_err(|e| e.to_string())?;

//     // 4. Force restart the app.
//     // Since app.restart() terminates the process, we use an attribute 
//     // to tell the compiler it's okay that the following Ok(()) is unreachable.
//     app.restart();
    
//     #[allow(unreachable_code)]
//     Ok(())
// }