use serialport::{available_ports, SerialPortType};
use std::io::{Read, Write};
use std::time::Duration;

// threads
use std::thread;
use std::sync::mpsc;

// hid usb
use hidapi::HidApi;

#[derive(serde::Serialize)]
pub struct PrinterCandidate {
    pub kind: String,   // "usb" | "bluetooth"
    pub address: String, // COM3 | /dev/ttyUSB0
    pub name: String, // Friendly name: "Epson TM-T88V" or "USB Serial Port"
}

// ESC/POS Commands
const ESC_INIT: &[u8] = &[0x1B, 0x40];      // Initialize printer
const DLE_EOT: &[u8] = &[0x10, 0x04, 0x01]; // Real-time status transmission (Status Type 1)

fn is_printer(port_name: &str) -> bool {
    // Open port with a short timeout so we don't hang the UI
    let port_builder = serialport::new(port_name, 9600)
        .timeout(Duration::from_millis(200));

    if let Ok(mut port) = port_builder.open() {
        // 1. Reset/Initialize
        let _ = port.write_all(ESC_INIT);
        // 2. Ask for status
        let _ = port.write_all(DLE_EOT);

        // 3. Wait for 1 byte response
        let mut buf = [0u8; 1];
        if port.read_exact(&mut buf).is_ok() {
            // If the device sent any byte back after DLE EOT, 
            // it's almost certainly an ESC/POS printer.
            return true;
        }
    }
    false
}

// #[tauri::command]
// pub fn auto_detect_printer() -> Option<PrinterCandidate> {
//     let ports = available_ports().ok()?;

//     for p in ports {
//         let (kind, name) = match p.port_type {
//             // Most modern thermal printers connect via USB but appear as Serial
//             SerialPortType::UsbPort(info) => (
//                 "usb", 
//                 info.product.clone().unwrap_or_else(|| "USB Printer".into())
//             ),
//             // Bluetooth printers (usually mobile/portable ones)
//             SerialPortType::BluetoothPort => ("bluetooth", "Bluetooth Printer".into()),
//             // Ignore standard motherboard COM ports and PCI cards to save time
//             _ => continue,
//         };

//         if is_printer(&p.port_name) {
//             return Some(PrinterCandidate {
//                 kind: kind.into(),
//                 address: p.port_name,
//                 name
//             });
//         }
//     }

//     None
// }

fn detect_hid_printer() -> Option<PrinterCandidate> {
    let api = HidApi::new().ok()?;

    for device in api.device_list() {
        let vid = device.vendor_id();
        let pid = device.product_id();

        let name = device.product_string().unwrap_or("HID Printer");

        // Example printer vendors
        if vid == 0x04b8 || vid == 0x0519 {
            return Some(PrinterCandidate {
                kind: "usb-hid".into(),
                address: format!("{:04x}:{:04x}", vid, pid),
                name: name.into(),
            });
        }
    }

    None
}

#[tauri::command]
pub fn auto_detect_printer() -> Option<PrinterCandidate> {

    // check HID first (fast)
    if let Some(p) = detect_hid_printer() {
        return Some(p);
    }

    // let ports = available_ports().ok()?;
    let ports: Vec<_> = available_ports()
        .ok()?
        .into_iter()
        .filter(|p| matches!(
            p.port_type,
            SerialPortType::UsbPort(_) | SerialPortType::BluetoothPort
        ))
        .collect();

    let (tx, rx) = mpsc::channel();

    for p in ports {
        let tx_clone = tx.clone();
        let port_name = p.port_name.clone();

        thread::spawn(move || {
            if is_printer(&port_name) {
                let _ = tx_clone.send(port_name);
            }
        });
    }

    drop(tx);

    if let Ok(port) = rx.recv_timeout(Duration::from_secs(1)) {
        return Some(PrinterCandidate {
            kind: "usb".into(),
            address: port,
            name: "Thermal Printer".into(),
        });
    }

    None
}