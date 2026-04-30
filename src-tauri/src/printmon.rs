#[cfg(desktop)]
use rusb::UsbContext;

use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

pub fn start_monitor(app_handle: AppHandle) {
    thread::spawn(move || {
        let mut last_device_count = 0;
        loop {
            let mut current_count = 0;

            // --- DESKTOP POLLING ---
            #[cfg(desktop)]
            {
                // 1. Count Serial/COM ports
                let serial_count = serialport::available_ports().map(|p| p.len()).unwrap_or(0);

                // 2. Count USB devices
                let usb_count = rusb::Context::new()
                    .and_then(|ctx| ctx.devices())
                    .map(|d| d.len())
                    .unwrap_or(0);

                current_count = serial_count + usb_count + current_count;
            }

            // --- ANDROID POLLING (Paired Bluetooth Devices) ---
            #[cfg(target_os = "android")]
            {
                current_count = get_android_paired_count().unwrap_or(0) + current_count;
            }

            // 3. If count changed, notify frontend
            if current_count != last_device_count {
                last_device_count = current_count;
                let _ = app_handle.emit("hardware-change", ());
            }

            // Check every 2 seconds to keep CPU usage near 0%
            thread::sleep(Duration::from_secs(2));
        }
    });
}


#[cfg(target_os = "android")]
fn get_android_paired_count() -> Option<usize> {
    use jni::objects::JObject;
    let ctx = ndk_context::android_context();
    let vm = unsafe { jni::JavaVM::from_raw(ctx.vm().cast()) }.ok()?;
    let mut env = vm.attach_current_thread().ok()?;

    let adapter_class = env.find_class("android/bluetooth/BluetoothAdapter").ok()?;
    let adapter = env.call_static_method(adapter_class, "getDefaultAdapter", "()Landroid/bluetooth/BluetoothAdapter;", &[])
        .ok()?.l().ok()?;

    if adapter.is_null() { return Some(0); }

    let paired_devices_set = env.call_method(&adapter, "getBondedDevices", "()Ljava/util/Set;", &[])
        .ok()?.l().ok()?;

    let size = env.call_method(&paired_devices_set, "size", "()I", &[])
        .ok()?.i().ok()?;

    Some(size as usize)
}