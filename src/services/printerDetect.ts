import { invoke } from "@tauri-apps/api/core"

export interface PrinterCandidate {
    kind: "serial" | "network"
    address: string,
    name: string
}

export async function detectPrinter(): Promise<PrinterCandidate[] | null> {
    return invoke("auto_detect_printer")
}