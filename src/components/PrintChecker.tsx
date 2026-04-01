import { useEffect, useState } from "react"
import { usePrinterStore } from "@/lib/print-detect-store"
import { usePrintStore } from "@/lib/print-store";
import { generateReceiptBinary } from "@/lib/receipt";
import { useStore } from "@/lib/store";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "@/hooks/use-toast";

export default function PrinterDetector() {
    const { savedPrinter, savedBaudRate, isOnline, setOnline, isEnabled } = usePrinterStore();
    const { printQueue, getAndRemoveFirstFromQueue } = usePrintStore();
    const { storeConfig } = useStore();
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        // Jika printer dimatikan, bersihkan antrean (opsional) atau biarkan menunggu
        if (!isEnabled) return;

        const processQueue = async () => {
            if (isProcessing || printQueue.length === 0) return;

            // Jika status Offline, langsung beri peringatan dan buang antrean
            if (!isOnline || !savedPrinter) {
                const tx = getAndRemoveFirstFromQueue();
                if (tx) {
                    toast({
                        variant: 'destructive',
                        title: 'Printer Offline',
                        description: `Gagal cetak ${tx.invoice_number}. Pastikan printer menyala.`
                    });
                }
                return;
            }

            setIsProcessing(true);
            const tx = getAndRemoveFirstFromQueue();
            if (!tx || !storeConfig) {
                setIsProcessing(false);
                return;
            }

            try {
                const binaryData = generateReceiptBinary(tx, storeConfig);
                await invoke("print_receipt", {
                    address: savedPrinter,
                    data: Array.from(binaryData),
                    baudRate: savedBaudRate || 9600,
                });
            } catch (error) {
                console.error("Print Error:", error);
                setOnline(false); // Hardware error = Offline
                toast({
                    variant: 'destructive',
                    title: 'Cetak Gagal',
                    description: "Terjadi gangguan pada hardware printer.",
                });
            } finally {
                setIsProcessing(false);
            }
        };

        processQueue();
    }, [printQueue, isOnline, isEnabled, isProcessing]);

    return null;
}