use rusb::{Context, UsbContext};
use serialport::{available_ports, SerialPortType};
use std::io::{Read, Write};
use std::sync::mpsc;
use std::thread;
use std::time::Duration;

#[derive(serde::Serialize, Clone, Debug)]
pub struct PrinterCandidate {
    pub kind: String,    // "usb-direct", "bluetooth", "serial"
    pub address: String, // "VID:PID" or "COMx"
    pub name: String,
    pub baud_rate: u32,
}

const PROBE_BAUDS: [u32; 2] = [9600, 115200]; // Most common POS speeds

/// Helper to test a specific serial port for a response
fn probe_serial_port(port_name: String) -> Option<(u32, String)> {
    for &baud in &PROBE_BAUDS {
        let builder = serialport::new(&port_name, baud)
            .timeout(Duration::from_millis(300))
            .data_bits(serialport::DataBits::Eight)
            .stop_bits(serialport::StopBits::One)
            .parity(serialport::Parity::None);

        if let Ok(mut port) = builder.open() {
            // Send DLE EOT 1 (Status Request)
            let _ = port.write_all(&[0x10, 0x04, 0x01]);

            let mut buf = [0u8; 1];
            // If the printer replies, we found the right baud rate
            if port.read_exact(&mut buf).is_ok() {
                return Some((baud, port_name));
            }
        }
    }
    None
}

#[tauri::command]
pub fn auto_detect_printer() -> Vec<PrinterCandidate> {
    let mut candidates = Vec::new();

    // --- 1. Direct USB Scanning (via rusb) ---
    if let Ok(context) = Context::new() {
        if let Ok(devices) = context.devices() {
            for device in devices.iter() {
                let Ok(desc) = device.device_descriptor() else {
                    continue;
                };

                let is_printer = device
                    .config_descriptor(0)
                    .map(|c| {
                        c.interfaces().any(
                            |i| i.descriptors().any(|d| d.class_code() == 7), // Printer Class
                        )
                    })
                    .unwrap_or(false);

                if is_printer || desc.vendor_id() == 0x0fe6 || desc.vendor_id() == 0x0416 {
                    candidates.push(PrinterCandidate {
                        kind: "usb-direct".into(),
                        address: format!("{:04x}:{:04x}", desc.vendor_id(), desc.product_id()),
                        name: format!("USB Thermal Printer ({:04x})", desc.product_id()),
                        baud_rate: 0,
                    });
                }
            }
        }
    }

    // --- 2. Threaded Serial/Bluetooth Probing ---
    if let Ok(ports) = available_ports() {
        let (tx, rx) = mpsc::channel();
        let mut threads = 0;

        for p in ports {
            let address = p.port_name.clone();
            if address.contains("Bluetooth-Incoming") {
                continue;
            }

            let tx_clone = tx.clone();
            let p_type = p.port_type.clone();
            threads += 1;

            thread::spawn(move || {
                if let Some((baud, name)) = probe_serial_port(address.clone()) {
                    let kind = match p_type {
                        SerialPortType::BluetoothPort => "bluetooth".into(),
                        _ => "serial".into(),
                    };
                    let _ = tx_clone.send(PrinterCandidate {
                        kind,
                        address: name.clone(),
                        name: format!("Printer on {}", name),
                        baud_rate: baud,
                    });
                }
            });
        }

        drop(tx); // Close the original sender

        // Wait up to 2 seconds for serial probes to finish
        let timeout = Duration::from_secs(2);
        let start = std::time::Instant::now();
        while start.elapsed() < timeout {
            if let Ok(found) = rx.try_recv() {
                candidates.push(found);
            }
            if candidates.len() >= threads + 1 {
                break;
            } // Optimization
            thread::sleep(Duration::from_millis(50));
        }
    }

    candidates
}
