
"use client";

import { useEffect, useState } from 'react';
import { usePrintStore } from '@/lib/print-store';
import { printerManager } from '@/lib/webUSBprinter';
import { generateReceiptBinary } from '@/lib/receipt';
import { useToast } from './use-toast';
import { useStore } from '@/lib/store';
import { usePrinterStore } from '@/lib/print-detect-store';

export const usePrinter = () => {
  const { printQueue, getAndRemoveFirstFromQueue } = usePrintStore();
  const { savedPrinter } = usePrinterStore();
  const { storeConfig } = useStore();
  const { toast } = useToast();
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    const processQueue = async () => {
      if (isPrinting || printQueue.length === 0 || !savedPrinter) {
        return;
      }

      setIsPrinting(true);
      const transactionToPrint = getAndRemoveFirstFromQueue();

      if (!transactionToPrint || !storeConfig) {
        setIsPrinting(false);
        return;
      }

      try {
        const paired = await printerManager.getPairedDevices();
        if (paired.length === 0) {
          // This toast is for when a print job is initiated but no printer is set up.
          toast({
              title: "Payment Successful",
              description: "No printer connected. Pair one in Settings for automatic receipts.",
          });
          setIsPrinting(false);
          return;
        }

        await printerManager.connect();
        const binaryData = generateReceiptBinary(transactionToPrint, storeConfig);

        await printerManager.print(binaryData);
        
      } catch (err: any) {
        console.error("Direct print failed:", err);
        toast({
          variant: 'destructive',
          title: 'Print Failed',
          description: err.message || "Could not connect to the printer.",
        });
      } finally {
        if ((printerManager as any).device) {
          await printerManager.disconnect();
        }
        setIsPrinting(false);
      }
    };

    // Use a timeout to ensure the effect runs on the next tick, preventing rapid re-renders
    const timer = setTimeout(processQueue, 0);
    return () => clearTimeout(timer);
    
  }, [printQueue, isPrinting, getAndRemoveFirstFromQueue, storeConfig, toast, savedPrinter]);
};
