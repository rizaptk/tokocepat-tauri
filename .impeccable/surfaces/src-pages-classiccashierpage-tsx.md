---
version: 1
slug: "src-pages-classiccashierpage-tsx"
primary_target: "src/pages/ClassicCashierPage.tsx"
related_targets: ["src/pages/CashierPage.tsx","src/components/CartDisplay.tsx","src/components/VariantPanel.tsx","src/components/ReturnDialog.tsx","src/components/PaymentModal.tsx"]
---

# Surface brief — Kasir (cashier/register)

**Scope and mode:** Operate. The register is the everyday surface of the Aurora Till; here the counter is won or lost.

**Audience, job, action:** Solo owner or hired cashier at one Windows desktop during service. Job: see a customer, scan or tap product, set quantity, take cash, print receipt, hand over. Primary action is always the same — get the sale totalled, paid, and proven in the fewest physical gestures (scanner → qty → Enter → cash → print).

**Proof/content:** The live receipt tape in the totals panel is the proof: each ringed line prints in Consolas, right-aligned, tabular, whole-rupiah, and the final Total Green line is the acetate of the transaction. The open/close shift are the tape's hard A and B sides.

**Constraints:**
- Keyboard and barcode scanner must drive everything; mouse optional. Density beats touch size by explicit decision.
- Financial guardrails identical to today: immutable ledger, void-with-reason behind a Ticket Red confirm, snapshots, shift reconciliation, tabular Rupiah, no decimals.
- Dual light/dark survives; dark = "Aero black glass" chrome with the aurora still faintly drifting.
- Keep existing behaviour and wiring (store, shift, cart, print queue, promos) — this brief restyles and retightens, it does not refactor.

**Chosen direction and memorable moment:** The Aurora Till. First viewport: flat chrome bar, sharp corners, product grid left / cart right, the totals panel spooling the receipt tape line by line as items ring. Signature interaction: the tape's print-settle (150ms) and the shift open/close as the tape's two sides. The aurora rail glows at rest; it darkens the moment a shift closes.

**Unresolved decisions:** exact Segoe/aurora palette values and dark-mode chrome recipe [resolved during implementation]; whether the logo adopts the Start-Orb mark (recommended); tape line-height/padding final values; how the tape prints on mobile (bottom tab + compact tape).
