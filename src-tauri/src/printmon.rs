use rusb::UsbContext;
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

pub fn start_monitor(app_handle: AppHandle) {
    thread::spawn(move || {
        let mut last_device_count = 0;
        loop {
            // 1. Count Serial/COM ports
            let serial_count = serialport::available_ports().map(|p| p.len()).unwrap_or(0);

            // 2. Count USB devices
            let usb_count = rusb::Context::new()
                .and_then(|ctx| ctx.devices())
                .map(|d| d.len())
                .unwrap_or(0);

            let current_count = serial_count + usb_count;

            // 3. If count changed, notify frontend
            if current_count != last_device_count {
                // If it's not the first run (last_device_count > 0),
                // it means something was plugged in or pulled out.
                // We emit even on first run so the UI knows initial state.
                last_device_count = current_count;

                // Emit event to all windows
                let _ = app_handle.emit("hardware-change", ());
            }

            // Check every 2 seconds to keep CPU usage near 0%
            thread::sleep(Duration::from_secs(2));
        }
    });
}
