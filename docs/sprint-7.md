# 🖨 SPRINT 7 – Hardware Integration

🎯 **Goal:** Connect the application to real-world hardware for a complete POS experience.

---

### Execution Plan

#### 1️⃣ Thermal Receipt Printer
- [ ] Research and select a client-side JavaScript library for Web Bluetooth API communication.
- [ ] Implement a "Printer Service" to handle discovering, pairing, and connecting to Bluetooth ESC/POS printers.
- [ ] Develop a function that takes a transaction object and converts it into a formatted string of `ESC/POS` commands.
- [ ] The receipt format must include: store name, invoice number, items with prices, subtotal, tax, total, cash paid, change, and shift ID.
- [ ] Add a "Print Receipt" button to the UI that appears after a payment is successfully processed.
- [ ] Implement a print queue and retry mechanism to handle potential connection drops or printer errors.

#### 2️⃣ Barcode Scanner
- [ ] Replace the placeholder barcode scanner dialog with a functional camera-based scanner.
- [ ] Use `navigator.mediaDevices.getUserMedia` to request camera access and display the video feed in a modal.
- [ ] Integrate a JavaScript barcode scanning library (e.g., `scandit-sdk` community edition, or another suitable library) to process the video stream.
- [ ] Upon successful detection of a barcode, the system should:
    - [ ] Automatically close the scanner modal.
    - [ ] Search for the product corresponding to the scanned barcode.
    - [ ] Add the identified product directly to the cart.

---

### Definition of Done
- [ ] The application can successfully connect to a Bluetooth thermal printer and print a well-formatted receipt in under 3 seconds.
- [ ] The barcode scanner can open, recognize a standard barcode from the camera feed, and add the correct item to the cart in under 1 second.
- [ ] Hardware permissions (camera, Bluetooth) are requested gracefully.
- [ ] The application handles cases where hardware is not available or permissions are denied.