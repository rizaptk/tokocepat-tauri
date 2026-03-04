# Direct Thermal Printing Documentation (WebUSB)

This system enables a React PWA to print directly to a USB thermal printer (58mm/80mm) by bypassing the browser's print dialog and the OS print spooler.

## 🚀 Overview

The system consists of three main parts:
1.  **`WebUSBPrinter.ts`**: A TypeScript library that manages the low-level USB connection.
2.  **`Receipt Encoder`**: Uses `@point-of-sale/receipt-printer-encoder` to convert text/data into raw ESC/POS binary commands.
3.  **`WebUSB API`**: The browser technology that allows direct communication with hardware.

---

## 📦 Prerequisites

### Hardware
*   **USB Thermal Printer**: Standard ESC/POS compatible printer.
*   **Android Devices**: Requires a USB-OTG (On-The-Go) adapter.
*   **Windows Devices**: Requires a driver swap (see [Platform Setup](#platform-setup)).

### Software/Libraries
Install the required dependencies:
```bash
# The Binary Encoder
npm install @point-of-sale/receipt-printer-encoder

# WebUSB TypeScript definitions
npm install --save-dev @types/w3c-web-usb
```

---

## 🛠️ Components

### 1. The Hardware Manager (`WebUSBPrinter.ts`)
This utility handles the lifecycle of the USB device. It includes:
*   **Pairing**: Opening the browser's native device picker.
*   **Auto-Reconnect**: Detecting previously paired devices on app load.
*   **Endpoint Discovery**: Automatically finding the correct USB "OUT" port to send data.

**Key Methods:**
*   `printerManager.request()`: Opens the hardware picker.
*   `printerManager.connect()`: Claims the USB interface for exclusive use.
*   `printerManager.print(data)`: Sends `Uint8Array` binary data to the printer.

### 2. The Logic (`generateReceiptBinary.ts`)
This function takes your `Transaction` and `StoreConfig` data and transforms it into a binary format the printer understands. It handles:
*   Center alignment for headers.
*   Bold text for totals.
*   Two-column layouts (Item name on left, Price on right).
*   Automatic paper cutting.

---

## 💻 Implementation Example

### Step 1: Generate and Print
```typescript
import { printerManager } from '@/lib/webUSBPrinter';
import { generateReceiptBinary } from '@/lib/receipt';

const handlePrint = async (transaction, config) => {
    try {
        // 1. Ensure a device is paired/selected
        const paired = await printerManager.getPairedDevices();
        if (paired.length === 0) {
            const newDevice = await printerManager.request();
            if (!newDevice) return; // User cancelled
        }

        // 2. Connect to the device
        await printerManager.connect();

        // 3. Encode your data to ESC/POS binary
        const binaryData = generateReceiptBinary(transaction, config);

        // 4. Send directly to hardware (Bypasses Print Dialog)
        await printerManager.print(binaryData);

        // 5. Cleanup
        await printerManager.disconnect();
    } catch (err) {
        console.error("Direct print failed:", err);
    }
};
```

---

## ⚠️ Platform Setup (CRITICAL)

### Windows (The Zadig Process)
By default, Windows "claims" the printer for its own spooler. For WebUSB to work, you must release it:
1.  Download [Zadig](https://zadig.akeo.ie/).
2.  Connect your printer and open Zadig.
3.  Click **Options > List All Devices**.
4.  Select your printer (e.g., `POS-58` or `USB Printing Support`).
5.  In the target driver box (right side), select **WinUSB**.
6.  Click **Replace Driver**.
7.  *Note:* The printer will no longer appear in "Printers & Scanners," but it will now work perfectly in your PWA.

### Android
1.  Connect the printer via an OTG cable.
2.  The first time you click "Connect," Android will ask: *"Allow TokoCepat to access POS-58?"*
3.  Check **"Always allow"** and click OK.
4.  Printing will now be silent and direct for all future transactions.

---

## 🔒 Security & PWA Best Practices

### HTTPS Requirement
WebUSB is a "Powerful Feature." It **will not work** on plain `http`. You must use `https://` or `localhost` for development.

### User Interaction
Browsers block WebUSB access if it's not triggered by a **User Gesture**. You cannot print automatically on page load. It must happen inside a `onClick` handler.

### PWA Standalone Mode
To provide the best user experience, users should "Install" the PWA. This removes the browser address bar and prevents accidental navigation during printing.
```typescript
// Use a media query to check if the app is installed
const isPWA = window.matchMedia('(display-mode: standalone)').matches;
```

---

## ❓ Troubleshooting

| Issue | Solution |
| :--- | :--- |
| `NetworkError: Unable to claim interface` | Another tab or the Windows Spooler is using the printer. Close other tabs or apply the Zadig fix. |
| `SecurityError: Access denied` | WebUSB was not called from a button click or the site is not HTTPS. |
| Printer prints "Gibberish" | Ensure you are using `ReceiptPrinterEncoder`. Raw HTML cannot be sent to this `print` method. |
| Device not found in picker | Ensure the USB cable is secure and the printer is powered on. On Windows, check Zadig. |

---

## 🛠️ Maintenance

When updating the printer logic, use the `@point-of-sale/receipt-printer-encoder` documentation for adding features like:
*   `encoder.barcode()`: For adding QR codes or barcodes to receipts.
*   `encoder.image()`: For adding store logos (requires black/white bitmap).
*   `encoder.table()`: For more complex multi-column layouts.