import { PrinterCandidate } from '@/services/printerDetect';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { zustandStorage } from './tauristorage';

interface PrinterState {
  savedPrinter: string | null;
  savePrinter: (port: string | null) => void;
  availablePrinters: PrinterCandidate[];
  setAvailablePrinters: (printers: PrinterCandidate[]) => void;
}

export const usePrinterStore = create<PrinterState>()(
  persist(
    (set) => ({
      savedPrinter: null,
      savePrinter: (port) => set({ savedPrinter: port }),
      availablePrinters: [],
      setAvailablePrinters: (printers) => set({ availablePrinters: printers }),
    }),
    {
      name: 'tokoc-printer-settings',
      storage: zustandStorage,
    }
  )
);