use std::fs::{self, File};
// Removed unused Read, Write, and PathBuf
use flate2::write::GzEncoder;
use flate2::read::GzDecoder;
use flate2::Compression;
use tauri::{AppHandle, Manager, Runtime};
use crate::tauri_gateway::FireLiteGateway;
use std::path::PathBuf;

#[tauri::command]
pub async fn native_backup<R: Runtime>(
    _app: AppHandle<R>, // Changed to _app as we'll use env::temp_dir
    state: tauri::State<'_, FireLiteGateway>,
    target_path: String,
) -> Result<(), String> {
    let gateway = state.inner();
    
    // 1. Use the System Temp directory instead of AppData
    // This avoids permission issues common in AppData/Roaming on some Windows setups
    let mut temp_db_path = std::env::temp_dir();
    temp_db_path.push(format!("backup_{}.db", uuid::Uuid::new_v4()));

    // 2. Perform the backup
    gateway.db.backup(temp_db_path.to_str().unwrap())
        .map_err(|e| format!("Database backup failed: {}", e))?;

    // 3. Tiny delay to ensure Windows OS releases the file lock from the backup process
    std::thread::sleep(std::time::Duration::from_millis(100));

    // 4. Compress the file
    {
        let input_file = File::open(&temp_db_path)
            .map_err(|e| format!("Failed to open temp file (lock issue?): {}", e))?;
        
        let output_file = File::create(PathBuf::from(&target_path))
            .map_err(|e| format!("Access Denied to destination path: {}. Try saving to 'Documents'.", e))?;
        
        let mut encoder = GzEncoder::new(output_file, Compression::default());
        let mut reader = std::io::BufReader::new(input_file);
        
        std::io::copy(&mut reader, &mut encoder).map_err(|e| e.to_string())?;
        encoder.finish().map_err(|e| e.to_string())?;
    } // Brackets ensure files are closed here

    // 5. Cleanup
    let _ = fs::remove_file(temp_db_path);

    Ok(())
}

#[tauri::command]
pub async fn native_restore<R: Runtime>(
    app: AppHandle<R>,
    state: tauri::State<'_, FireLiteGateway>,
    source_path: String,
) -> Result<(), String> {
    let gateway = state.inner();
    
    // 1. Flush current DB to ensure everything is written
    let _ = gateway.db.flush();

    // 2. Decompress the backup file to a staging file
    let db_dir = app.path().app_data_dir().unwrap();
    let staging_path = db_dir.join("tokocepat.db.staging");
    // Removed unused actual_db_path variable

    let compressed_file = File::open(&source_path).map_err(|e| e.to_string())?;
    let mut decoder = GzDecoder::new(compressed_file);
    let mut staging_file = File::create(&staging_path).map_err(|e| e.to_string())?;

    std::io::copy(&mut decoder, &mut staging_file).map_err(|e| e.to_string())?;

    // 3. Write a "pending restore" flag file
    let restore_flag = db_dir.join("restore_pending.flag");
    fs::write(restore_flag, staging_path.to_str().unwrap()).map_err(|e| e.to_string())?;

    // 4. Force restart the app.
    // Since app.restart() terminates the process, we use an attribute 
    // to tell the compiler it's okay that the following Ok(()) is unreachable.
    app.restart();
    
    #[allow(unreachable_code)]
    Ok(())
}