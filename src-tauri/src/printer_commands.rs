use rusb::UsbContext;
use std::io::Write;
use std::time::Duration; // Removed DeviceHandle as it's inferred

#[tauri::command]
pub fn print_receipt(address: String, baud_rate: u32, data: Vec<u8>) -> Result<(), String> {

    #[cfg(not(target_os = "android"))]
    {
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

    // --- ANDROID LOGIC ---
    #[cfg(target_os = "android")]
    {
        print_to_android_bluetooth(address, data)
    }

}

#[cfg(target_os = "android")]
fn print_to_android_bluetooth(address: String, data: Vec<u8>) -> Result<(), String> {
    use jni::objects::{JObject, JValue};
    let ctx = ndk_context::android_context();
    let vm = unsafe { jni::JavaVM::from_raw(ctx.vm().cast()) }.map_err(|e| e.to_string())?;
    let mut env = vm.attach_current_thread().map_err(|e| e.to_string())?;

    // 1. Get Adapter and Remote Device
    let adapter_class = env.find_class("android/bluetooth/BluetoothAdapter").map_err(|e| e.to_string())?;
    let adapter = env.call_static_method(adapter_class, "getDefaultAdapter", "()Landroid/bluetooth/BluetoothAdapter;", &[]).map_err(|e| e.to_string())?.l().map_err(|e| e.to_string())?;
    
    let j_address = env.new_string(address).map_err(|e| e.to_string())?;
    let device = env.call_method(&adapter, "getRemoteDevice", "(Ljava/lang/String;)Landroid/bluetooth/BluetoothDevice;", &[(&j_address).into()]).map_err(|e| e.to_string())?.l().map_err(|e| e.to_string())?;

    // 2. Create Socket (Standard SPP UUID)
    let uuid_class = env.find_class("java/util/UUID").map_err(|e| e.to_string())?;
    let uuid_str = env.new_string("00001101-0000-1000-8000-00805F9B34FB").map_err(|e| e.to_string())?;
    let uuid = env.call_static_method(uuid_class, "fromString", "(Ljava/lang/String;)Ljava/util/UUID;", &[(&uuid_str).into()]).map_err(|e| e.to_string())?.l().map_err(|e| e.to_string())?;

    let socket = env.call_method(&device, "createRfcommSocketToServiceRecord", "(Ljava/util/UUID;)Landroid/bluetooth/BluetoothSocket;", &[(&uuid).into()]).map_err(|e| e.to_string())?.l().map_err(|e| e.to_string())?;

    // 3. Connect and Write
    env.call_method(&socket, "connect", "()V", &[]).map_err(|_| "Could not connect to printer. Is it on?")?;
    
    let out_stream = env.call_method(&socket, "getOutputStream", "()Ljava/io/OutputStream;", &[]).map_err(|e| e.to_string())?.l().map_err(|e| e.to_string())?;
    
    let j_data = env.byte_array_from_slice(&data).map_err(|e| e.to_string())?;
    env.call_method(&out_stream, "write", "([B)V", &[(&j_data).into()]).map_err(|e| e.to_string())?;
    env.call_method(&out_stream, "flush", "()V", &[]).map_err(|e| e.to_string())?;

    // 4. Close
    let _ = env.call_method(&socket, "close", "()V", &[]);
    
    Ok(())
}
