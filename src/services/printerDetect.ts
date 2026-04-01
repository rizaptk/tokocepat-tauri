import { invoke } from "@tauri-apps/api/core"

export interface PrinterCandidate {
    kind: "usb" | "bluetooth"
    address: string,
    name: string,
    baud_rate: number; // Added
}

export async function detectPrinter(): Promise<PrinterCandidate[] | null> {
    return invoke("auto_detect_printer")
}