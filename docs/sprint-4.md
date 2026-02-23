# 💵 SPRINT 4 – Payment & Shift Control

🎯 **Goal:** Ensure financial integrity and accountability with robust payment and shift management modules.

---

### Execution Plan

#### 1️⃣ Payment & Transaction Engine
- [ ] On payment confirmation, implement logic to generate a unique, auto-incrementing invoice number.
- [ ] Solidify the checkout process to create an **immutable** record in the `Transactions` table.
- [ ] Enhance the `PaymentModal` to handle the complete cash-only payment flow, including change calculation and transaction finalization.

#### 2️⃣ Transaction Snapshot Integrity
- [ ] When creating a transaction, ensure that a complete snapshot of each product (`name`, `price`, `sku`, etc.) is saved into `TransactionItems`. This is critical for historical accuracy, even if the original product is later modified or deleted.
- [ ] Store a snapshot of the applied tax rate and cost of goods sold at the time of sale.

#### 3️⃣ Shift Management Module
- [ ] Create an "Open Shift" UI view where a user must input the beginning cash balance in the drawer.
- [ ] Implement logic to prevent any sales transactions from occurring if there is no active, open shift.
- [ ] Develop the "Close Shift" UI view, which includes:
    - [ ] Displaying system-calculated totals for sales, taxes, and expected cash.
    - [ ] An input field for the cashier to declare the counted cash amount.
    - [ ] A clear display of the variance between expected and declared cash.
- [ ] Upon closing, the shift record is finalized and locked.

#### 4️⃣ Financial Control Rules
- [ ] Implement a "Void Transaction" feature that requires a reason. This action must not `DELETE` the original record but instead create a new, reversing transaction to maintain a perfect audit trail.
- [ ] Ensure all financial records (transactions, shifts) are treated as immutable once created.

---

### Definition of Done
- [ ] The shift lock mechanism correctly prevents sales outside of an active shift.
- [ ] The close-shift process accurately calculates and displays the cash variance.
- [ ] No transaction can be deleted from the database; voiding creates a correct counter-entry.
- [ ] All historical sales reports remain accurate due to data snapshotting.