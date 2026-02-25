# 📈 SPRINT 6-B – Detailed Stock Movement Report (Pending)

🎯 **Goal:** Provide a comprehensive, auditable report detailing all historical inventory movements for any given period, including sales, manual adjustments, and returns.

---

### Execution Plan

#### 1️⃣ Report Foundation
- [ ] Create a new page at `/dashboard/reports/stock-movement` for the detailed inventory ledger report.
- [ ] Add a link to this new report on the main `/dashboard/reports` page, titled "Stock Movement Report".
- [ ] Implement a date range filter component on the new report page with presets: "Today", "Last 7 Days", "Last 30 Days", and "Last Month".

#### 2️⃣ Data & Display Logic
- [ ] Create a new service function in `stockService.ts` to fetch records from the `StockMovements` table based on the selected date range.
- [ ] The report will display a detailed table with the following columns for each movement:
    - **Date/Time**: The exact timestamp of the movement.
    - **Product**: The name of the product that was affected.
    - **Movement Type**: The type of change (e.g., `sale`, `restock`, `correction`, `lost`, `damaged`).
    - **Quantity Change**: The amount the stock changed by (e.g., -1 for a sale, +50 for a restock).
    - **Reason/Reference**: The reason for manual adjustments or the invoice number for sales.
    - **Resulting Stock**: The stock quantity of the product *after* the movement occurred.
- [ ] Add the ability to filter the report by a specific product to see its complete history.

#### 3️⃣ Data Export Functionality
- [ ] Integrate the `export` utility (`src/lib/export.ts`) with this new report.
- [ ] Add an "Export to Excel" button that generates an `.xlsx` file of the filtered stock movement data. The Excel file will include all columns from the on-screen table.
- [ ] Add an "Export to PDF" button that generates a clean, printable PDF document of the report, suitable for archiving or formal review.

---

### Definition of Done
- [ ] Users can navigate to and view the Stock Movement Report.
- [ ] The report accurately displays all stock changes from the `StockMovements` table for the selected date range.
- [ ] Filtering by date and by product works correctly.
- [ ] Both Excel and PDF exports generate accurate and well-formatted files containing the detailed ledger data.
