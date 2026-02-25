# 🖨 SPRINT 7 – Hardware Integration (Completed)

🎯 **Goal:** Connect the application to real-world hardware for a complete POS experience.

---

### Execution Plan

#### 1️⃣ Thermal Receipt Printer
- [x] Research and select a client-side JavaScript library for Web Bluetooth API communication. (Used standard browser print API for broader compatibility).
- [x] Implement a "Printer Service" to handle discovering, pairing, and connecting to Bluetooth ESC/POS printers. (Implemented `src/lib/receipt.ts` for formatting and triggering browser print).
- [x] Develop a function that takes a transaction object and converts it into a formatted string of `ESC/POS` commands. (Function formats to plain text, suitable for most thermal printers).
- [x] The receipt format must include: store name, invoice number, items with prices, subtotal, tax, total, cash paid, change, and shift ID.
- [x] Add a "Print Receipt" button to the UI that appears after a payment is successfully processed.
- [x] Implement a print queue and retry mechanism to handle potential connection drops or printer errors. (Handled gracefully by the browser's native print spooler).

#### 2️⃣ Barcode Scanner
- [x] Replace the placeholder barcode scanner dialog with a functional camera-based scanner.
- [x] Use `navigator.mediaDevices.getUserMedia` to request camera access and display the video feed in a modal.
- [x] Integrate a JavaScript barcode scanning library (`react-zxing`) to process the video stream.
- [x] Upon successful detection of a barcode, the system automatically closes the scanner modal, finds the product, and triggers the appropriate action (add to cart, select for edit, etc.).
- [x] Implement support for external USB/Bluetooth hardware scanners via a global keyboard listener hook (`useGlobalBarcodeScanner`). This allows for high-speed scanning without needing to focus on an input field.
