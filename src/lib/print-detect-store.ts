import { PrinterCandidate } from '@/services/printerDetect';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type PaperWidth = '58mm' | '80mm' | '112mm';

interface PrinterState {
  savedPrinter: string | null;
  savedPrinterName: string | null;
  savedBaudRate: number;
  availablePrinters: PrinterCandidate[];
  isOnline: boolean; // New State
  isEnabled: boolean;
  // Saat printer nonaktif, tunjukkan simulasi struk di layar (Aurora Till).
  // Default false → pengguna langsung kembali ke kasir tanpa dokumen apa pun.
  showTapeWhenDisabled: boolean;
  paperWidth: PaperWidth;
  setIsEnabled: (isEnabled: boolean) => void;
  setShowTapeWhenDisabled: (show: boolean) => void;
  setPaperWidth: (paperWidth: PaperWidth) => void;
  savePrinter: (port: string | null, baud?: number, name?: string | null) => void;
  setAvailablePrinters: (printers: PrinterCandidate[]) => void;
  setOnline: (status: boolean) => void; // New Action
}

export const usePrinterStore = create<PrinterState>()(
  persist(
    (set) => ({
      savedPrinter: null,
      savedPrinterName: null,
      savedBaudRate: 9600,
      availablePrinters: [], // Akan diisi saat runtime
      isOnline: false,       // Akan diisi saat runtime
      isEnabled: true,
      showTapeWhenDisabled: false,
      paperWidth: '58mm',
      setIsEnabled: (isEnabled) => set({ isEnabled }),
      setShowTapeWhenDisabled: (showTapeWhenDisabled) => set({ showTapeWhenDisabled }),
      setPaperWidth: (paperWidth) => set({ paperWidth }),
      savePrinter: (port, baud = 9600, name = null) => set({ 
        savedPrinter: port, 
        savedBaudRate: baud,
        savedPrinterName: name,
      }),
      setAvailablePrinters: (availablePrinters) => set({ availablePrinters }),
      setOnline: (isOnline) => set({ isOnline }),
    }),
    { 
      name: 'tokoc-printer-settings', 
      // HANYA simpan alamat, baudrate, dan status aktif
      partialize: (state) => ({ 
        savedPrinter: state.savedPrinter, 
        savedBaudRate: state.savedBaudRate,
        savedPrinterName: state.savedPrinterName,
        isEnabled: state.isEnabled,
        showTapeWhenDisabled: state.showTapeWhenDisabled,
        paperWidth: state.paperWidth,
      }),
    }
  )
);