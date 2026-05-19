#[cfg(not(target_os = "android"))]
use rusb::{Context, UsbContext};
#[cfg(not(target_os = "android"))]
use serialport::{available_ports, SerialPortType};
#[cfg(not(target_os = "android"))]
use std::io::{Read, Write};
#[cfg(not(target_os = "android"))]
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

#[cfg(not(target_os = "android"))]
const PROBE_BAUDS: [u32; 2] = [9600, 115200]; // Most common POS speeds

/// Helper to test a specific serial port for a response
#[cfg(not(target_os = "android"))]
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
    #[cfg(not(target_os = "android"))] 
    {
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
    }

    // --- ANDROID LOGIC (Get Paired Bluetooth Devices) ---
    #[cfg(target_os = "android")]
    {
        if let Some(list) = get_android_paired_bluetooth() {
            candidates.extend(list);
        }
    }

    candidates
}

#[cfg(target_os = "android")]
fn get_android_paired_bluetooth() -> Option<Vec<PrinterCandidate>> {
    // use jni::objects::JObject;
    let ctx = ndk_context::android_context();
    let vm = unsafe { jni::JavaVM::from_raw(ctx.vm().cast()) }.ok()?;
    let mut env = vm.attach_current_thread().ok()?;

    // 1. Get BluetoothAdapter.getDefaultAdapter()
    let adapter_class = env.find_class("android/bluetooth/BluetoothAdapter").ok()?;
    let adapter = env.call_static_method(adapter_class, "getDefaultAdapter", "()Landroid/bluetooth/BluetoothAdapter;", &[])
        .ok()?.l().ok()?;

    if adapter.is_null() { return None; }

    // 2. adapter.getBondedDevices() -> Set<BluetoothDevice>
    let paired_devices_set = env.call_method(&adapter, "getBondedDevices", "()Ljava/util/Set;", &[])
        .ok()?.l().ok()?;

    // 3. Convert Set to Array
    let array = env.call_method(&paired_devices_set, "toArray", "()[Ljava/lang/Object;", &[])
        .ok()?.l().ok()?;
    let array_obj: jni::objects::JObjectArray = array.into();
    let len = env.get_array_length(&array_obj).ok()?;

    let mut list = Vec::new();
    for i in 0..len {
        let device = env.get_object_array_element(&array_obj, i).ok()?;
        let name: String = env.call_method(&device, "getName", "()Ljava/lang/String;", &[]).ok()?.l().ok()
            .and_then(|n| Some(env.get_string(&n.into()).ok()?.into())).unwrap_or("Unknown".into());
        let address: String = env.call_method(&device, "getAddress", "()Ljava/lang/String;", &[]).ok()?.l().ok()
            .and_then(|a| Some(env.get_string(&a.into()).ok()?.into())).unwrap_or("".into());

        list.push(PrinterCandidate {
            kind: "bluetooth".into(),
            address,
            name,
            baud_rate: 0,
        });
    }
    Some(list)
}
