import { useEffect, useState, useCallback } from "react";
import { detectPrinter } from "@/services/printerDetect";
import { usePrinterStore } from "@/lib/print-detect-store";
import { useRefreshStore } from "@/lib/print-refresh-store";
import { listen } from "@tauri-apps/api/event";

export const PrinterMonitor = () => {
    const { reloadPrinter, setReloadPrinter } = useRefreshStore();
    const { savedPrinter, setAvailablePrinters, availablePrinters, setOnline, isEnabled } = usePrinterStore();
    const [isScanning, setIsScanning] = useState(false);

    // Fungsi Scan (Hanya update list printer yang ada di kabel/BT)
    const performScan = useCallback(async () => {
        if (isScanning || !isEnabled) return;
        
        setIsScanning(true);
        try {
            const found = await detectPrinter();
            setAvailablePrinters(found || []);
        } catch (err) {
            console.error("Scan Error:", err);
        } finally {
            setIsScanning(false);
            setReloadPrinter(false);
        }
    }, [isScanning, isEnabled, setAvailablePrinters, setReloadPrinter]);

    // 1. Jalankan Scan saat start atau hardware berubah
    useEffect(() => {
        if (reloadPrinter) {
            performScan();
        }
    }, [reloadPrinter, performScan]);

    // 2. Pasang Hardware Listener
    useEffect(() => {
        if (!isEnabled) return;

        let unlisten: any;

        setup();
        async function setup() {
            unlisten = await listen("hardware-change", () => setReloadPrinter(true));
        }
        return () => { if (unlisten) unlisten(); };
    }, [setReloadPrinter, isEnabled]);

    useEffect(() => {
        if (!isEnabled) {
            setOnline(false);
            return;
        }

        if (savedPrinter && availablePrinters.length > 0) {
            const isFound = availablePrinters.some(
                p => p.address.toLowerCase() === savedPrinter.toLowerCase()
            );
            setOnline(isFound);
        } else {
            // Jika tidak ada printer disimpan atau list kosong, pastikan offline
            setOnline(false);
        }
    }, [savedPrinter, availablePrinters, isEnabled, setOnline]);

    return null;
};