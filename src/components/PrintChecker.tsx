import { useEffect, useState } from "react"
import { detectPrinter } from "@/services/printerDetect"
import { usePrinterStore } from "@/lib/print-detect-store"
import { usePrintStore } from "@/lib/print-store";
import { generateReceiptBinary } from "@/lib/receipt";
import { useStore } from "@/lib/store";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "@/hooks/use-toast";

export default function PrinterDetector() {

    const { savePrinter, savedPrinter, setAvailablePrinters } = usePrinterStore();
    const { printQueue, getAndRemoveFirstFromQueue } = usePrintStore();
    const [isPrinting, setIsPrinting] = useState(false);
    const { storeConfig } = useStore();

    useEffect(() => {

        async function autoSetup() {
            const found = await detectPrinter()

            if (found && found.length > 0) {
                setAvailablePrinters(found);
                savePrinter(found[0].address);
                console.log("Printer detected:", found)
            }
        }

        autoSetup()

    }, [savePrinter])

    useEffect(() => {
        const processQueue = async () => {
            if (isPrinting || printQueue.length === 0) {
                return;
            }

            setIsPrinting(true);
            const transactionToPrint = getAndRemoveFirstFromQueue();

            if (!transactionToPrint || !savedPrinter || !storeConfig) {
                setIsPrinting(false);
                return;
            }

            try {
                const binaryData = generateReceiptBinary(transactionToPrint, storeConfig);
                await invoke("print_receipt", {
                    port: savePrinter, 
                    data: Array.from(binaryData) 
                });
            } catch (error) {
                console.error("Error generating receipt binary:", error);
                toast({
                    variant: 'destructive',
                    title: 'Print Failed',
                    description: (error as Error).message || "Could not connect to the printer.",
                });
            } finally {
                setIsPrinting(false);
            }
        };

        if (savedPrinter) {
            processQueue();
        }
    }, [savedPrinter, printQueue])

    return null

}