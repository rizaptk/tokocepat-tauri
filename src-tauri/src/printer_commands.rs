use std::io::Write;
use std::time::Duration;

#[tauri::command]
pub fn print_receipt(port: String, data: Vec<u8>) -> Result<(), String> {
    // 1. Open the port
    let mut serial_port = serialport::new(port, 9600)
        .timeout(Duration::from_millis(5000))
        .open()
        .map_err(|e| format!("Failed to open port: {}", e))?;

    // 2. Write the binary data directly
    // This 'data' variable is the Uint8Array coming from generateReceiptBinary
    serial_port.write_all(&data)
        .map_err(|e| format!("Failed to write to printer: {}", e))?;

    // 3. Ensure everything is sent
    serial_port.flush()
        .map_err(|e| format!("Failed to flush: {}", e))?;

    Ok(())
}