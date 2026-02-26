# 📈 SPRINT 12 – Admin Platform: Analytics & Dashboard

🎯 **Goal:** To develop a comprehensive admin dashboard that provides at-a-glance, actionable insights into the health and growth of the SaaS business.

---

### ✅ Execution Plan – Backend

1.  **Data Aggregation Queries:**
    -   [ ] Develop efficient database queries to aggregate data for key business metrics. This may involve creating specific views or optimized queries to calculate:
        -   Monthly Recurring Revenue (MRR) / Annual Recurring Revenue (ARR).
        -   Total number of active licenses and active devices.
        -   New activations within a given period (day, week, month).
        -   License churn/deactivation rates.

### ✅ Execution Plan – Frontend (Admin UI)

1.  **Dashboard UI Design:**
    -   [ ] Design the layout for the main admin dashboard page, focusing on clarity and ease of use.
    -   [ ] Structure the dashboard with multiple cards or sections, each dedicated to a key metric.

2.  **Key Metric Cards:**
    -   [ ] Implement individual UI components to display core metrics, such as:
        -   A large "MRR" display with a percentage change from the previous month.
        -   A card for "New Activations (30 Days)".
        -   A card for "Total Active Devices".
        -   A card for "License Expiries (Next 30 Days)".

3.  **Data Visualization:**
    -   [ ] Integrate a charting library (e.g., Recharts, Chart.js) into the Admin Platform.
    -   [ ] Create a line or bar chart to visualize "Revenue Growth Over Time" (e.g., last 12 months).
    -   [ ] Develop a chart showing "New Activations vs. Deactivations" to monitor customer churn.

4.  **Activity Feed:**
    -   [ ] Implement a "Recent Activity" feed on the dashboard that shows a live-updating list of important events, such as:
        -   "New license activated for customer@email.com."
        -   "Payment of $XX received."
        -   "License XYZ is expiring in 7 days."

---

### Definition of Done

-   [ ] When an admin logs in, they are presented with a dashboard summarizing the current state of the business.
-   [ ] All key metrics (MRR, activations, etc.) are calculated and displayed accurately.
-   [ ] Interactive charts provide clear visual insights into revenue trends and customer growth.
-   [ ] The dashboard successfully helps the administrator make informed business decisions.