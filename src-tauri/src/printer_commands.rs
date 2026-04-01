use rusb::UsbContext;
use std::io::Write;
use std::time::Duration; // Removed DeviceHandle as it's inferred

#[tauri::command]
pub fn print_receipt(address: String, baud_rate: u32, data: Vec<u8>) -> Result<(), String> {
    if address.contains(':') {
        // --- DIRECT USB PATH (Zadig/WinUSB) ---
        let parts: Vec<&str> = address.split(':').collect();
        let vid = u16::from_str_radix(parts[0], 16).map_err(|_| "Invalid VID")?;
        let pid = u16::from_str_radix(parts[1], 16).map_err(|_| "Invalid PID")?;

        let context = rusb::Context::new().map_err(|e| e.to_string())?;

        // Removed 'mut' here as it's not required for write_bulk
        let handle = context
            .open_device_with_vid_pid(vid, pid)
            .ok_or("Printer not found. If using USB, ensure WinUSB driver is active via Zadig.")?;

        handle
            .claim_interface(0)
            .map_err(|e| format!("USB Claim Failed: {}", e))?;

        // Standard endpoints for POS printers
        let endpoints = [0x01, 0x02, 0x03];
        let mut success = false;

        for ep in endpoints {
            if handle.write_bulk(ep, &data, Duration::from_secs(5)).is_ok() {
                success = true;
                break;
            }
        }

        if !success {
            return Err("Failed to write to USB endpoints. Check if the printer is on or endpoint is correct.".into());
        }

        Ok(())
    } else {
        // --- SERIAL/BLUETOOTH PATH ---
        let mut port = serialport::new(&address, baud_rate)
            .timeout(Duration::from_millis(5000))
            .open()
            .map_err(|e| format!("Serial error on {}: {}", address, e))?;

        port.write_all(&data).map_err(|e| e.to_string())?;
        let _ = port.flush();
        Ok(())
    }
}
