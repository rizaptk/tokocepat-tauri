# 📊 SPRINT 6 – Reports & Analytics

🎯 **Goal:** Deliver professional, insightful reporting and data export capabilities.

---

### Execution Plan

#### 1️⃣ Dashboard Enhancements
- [ ] Integrate `Recharts` to add a dynamic "Hourly Sales" bar chart to the dashboard, visualizing peak hours.
- [ ] Add a "Top Selling Products" list to the dashboard, showing the day's most popular items by quantity sold.
- [ ] Display key shift metrics, such as current shift revenue.

#### 2️⃣ Reporting Module
- [ ] Create a new, centralized reporting page at `/dashboard/reports`.
- [ ] **Sales Summary Report:** Develop a report that allows users to view total sales, tax, and profit, filterable by date ranges (today, this week, this month).
- [ ] **Profit Report:** Implement profit calculation (`price - cost`) and display it in the sales report. This requires `cost_price` to be populated for products.
- [ ] **Inventory Report:** Create a report showing a list of all products with their current stock levels, value at cost, and value at retail.
- [ ] **Shift Report:** Develop a detailed view for each closed shift, showing opening/closing times, balances, variance, and a summary of transactions.
- [ ] **Void Report:** Create a specific report that lists all voided transactions for auditing purposes.

#### 3️⃣ Data Export
- [ ] For each report, add an "Export to Excel" button that uses `SheetJS` to generate a valid `.xlsx` file of the report data.
- [ ] For critical financial reports (Shift Report, Sales Summary), add an "Export to PDF" button using `pdf-lib` to create a non-editable, printable document.

---

### Definition of Done
- [ ] All reports accurately reflect the data stored in the database.
- [ ] Date filtering works correctly across all relevant reports.
- [ ] Both Excel and PDF export functions produce valid, well-formatted, and shareable files.
- [ ] The dashboard provides an accurate, at-a-glance summary of the current business day.