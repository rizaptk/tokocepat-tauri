# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Mix of two behaviors, often on the same single machine:

- **Solo store owner-operator** (mini-market, cafe, kiosk): does everything — rings sales during the day, then manages products, stock, promos, and reconciles the shift on the same device.
- **Hired cashier** at a small shop or F&B counter: is at the till during service hours, focused only on fast ring-up, payment, receipt, and correct end-of-shift reconciliation. The owner/manager reviews reports on that same device, typically between customers or after hours.

## Product Purpose

TokoCepat POS is an offline-first, single-device point of sale for small Indonesian retail and F&B businesses. It exists to make ring-up fast (tap product → cart → cash payment → thermal receipt) while protecting financial truth through an immutable transaction ledger and shift-based cash reconciliation — all fully functional with no internet connection.

Success for the operator: a shift closes with exact, auditable cash — every transaction accounted for, variance explained. Success for the business: fast throughput at the counter without sacrificing financial control.

## Positioning

A POS that keeps a whole small store trustworthy and fast entirely on one machine, with zero internet dependency. Where typical POS reliance on the cloud or on staff reporting discipline, TokoCepat enforces integrity structurally: an immutable ledger, snapshots at sale time, void-only-with-reason, and shift cash reconciliation built into the workflow. The tap-oriented cashier screen is the everyday surface; the accounting-grade layer underneath is what the owner can trust.

## Operating Context

- One Windows desktop PC/laptop at the counter, operated with mouse/keyboard, in a busy and often noisy environment.
- Sales happen continuously during service; the owner usually does admin and reporting on the same device.
- The store may be offline for long stretches; the app must never block a sale on connectivity.
- Hardware in daily use: ESC/POS thermal receipt printer (USB, serial, or Bluetooth) and barcode scanning (camera-based and/or hardware scanner).
- Cash is a primary payment method; exact change and tap-keypad flow are everyday, high-frequency interactions.
- Indonesian is the working language; Rupiah is the currency; PPN tax handling is configured per store.

## Capabilities and Constraints

- **Offline-first**: all POS data lives in FireLite, an embedded, encrypted, single-file SQLite database; nothing about the core loop needs a network.
- **Single device, no authentication**: no login ceremony between fulfilling a sale and closing a shift. Optional sync (LAN peer-to-peer net-sync, or cloud sync) is additive and not required for operation.
- **Financial integrity is structural**: transactions are immutable; voiding requires a reason; orders and returns keep price/cost snapshots; invoice numbering is automatic.
- **Shift control**: open/close shift reconciles declared cash against system expectations and flags variance.
- **Products & catalog**: retail and F&B product types, variants with price deltas, recipe-based modifiers, SKU/barcode, stock tracking with low-stock alerts, and an optional bundled read-only reference catalog for fast product creation.
- **Stock & audit**: automatic deduction on sale plus logged manual adjustments (lost, damaged, correction, initial balance) — every movement recorded and reportable.
- **Consignment (titipan)**: products sold for consignors with percentage or flat commission; separate payout and ownership tracking.
- **Promos**: automatic BOGO (self free) rules and cashier-entered voucher codes with usage caps and validity windows; discounts preserved as snapshots on each transaction.
- **Tax (PPN)**: configurable rate with optional per-category overrides; receipts and reports break out tax on the discounted (net) base.
- **Reporting**: sales, profit, tax, stock summary/movement, shifts, consignments, and void reports with Excel and PDF export.
- **POS hardware**: thermal receipt printing and barcode scanning, plus printer configuration.

## Brand Commitments

- Product name: **TokoCepat POS**.
- Voice and UI copy: Indonesian (id-ID).
- Currency: Rupiah (IDR).
- Thermal receipt and barcode hardware are committed product surfaces, not extras.
- No multi-brand identity system — one name, one consistent Indonesian voice.

## Evidence on Hand

- Shipping application v0.3.4 with an incumbent visual system (React 19 + Vite + Tailwind + shadcn components, Tauri 2 shell).
- `docs/` hold the design history: `blueprint.md`, `app-design.md`, sprint plans (`sprint-1` … `sprint-12`), `modifiers.md`, `cloud-sync.md`, `firesqlite-doc.md`, `stocks-management.md`, and more — a factual record of what has been built and decided.
- `README.md` documents architecture, offline-first positioning, licensing, and sync.
- Indonesian copy and product terminology throughout the UI and reports.
- No customer testimonials, usage benchmarks, revenue, or deployment claims exist in the repo — future work must not fabricate them.

## Product Principles

1. **Speed at the counter is the product.** The ring path — product to cart to total to receipt — must stay one glance away; the transaction screen wins or loses on latency and minimal taps.
2. **Financial truth is structural, not procedural.** Immutable ledger, sale-time snapshots, void-with-reason, and shift cash reconciliation are enforced by the software, not by staff discipline.
3. **The machine must never depend on the network.** Everything a store needs to sell and reconcile works offline; sync and cloud features are optional layers, never prerequisites.
4. **One device, zero ceremony.** The app must not make fulfilling a sale or closing a shift require accounts, sign-in ritual, or multi-step setup past the first run.
5. **Serve the whole small-store owner.** Cashier-grade speed for staff and trustworthy reconciliation plus clear reports for the owner, from the same single machine.