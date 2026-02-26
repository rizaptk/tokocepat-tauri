# 🔑 SPRINT 10 – Admin Platform MVP: Core Management

🎯 **Goal:** To build a secure, Minimum Viable Product (MVP) of the Admin Platform that allows administrators to manually manage customers and licenses. This provides the essential tools needed to run the business before full automation is implemented.

---

### ✅ Execution Plan – Backend & Infrastructure

1.  **Project Setup:**
    -   [ ] Initialize a new, separate Next.js project for the Admin Dashboard. This project will have its own repository and deployment pipeline.
    -   [ ] Implement a secure authentication system for administrators (e.g., using username/password with a library like NextAuth.js). This includes creating a login page.

2.  **Database Connection:**
    -   [ ] Configure the Admin Platform backend to securely connect to the *same* database used by the POS license API, ensuring data consistency.

### ✅ Execution Plan – Frontend (Admin UI)

1.  **Customer Management Module:**
    -   [ ] Create a page to display a searchable list of all customers (Name, Email, Number of Licenses).
    -   [ ] Develop a "Customer Detail" view that shows all licenses associated with a specific customer.

2.  **License Management Module:**
    -   [ ] Create a page to display a searchable and filterable table of all generated licenses.
        -   **Columns:** License Key, Customer, Plan Type, Status (Active, Expired, Deactivated), Expiry Date, Seats Used (e.g., `1/1`).
    -   [ ] Implement a **"Create New License"** form where an admin can manually generate a new license key for a customer (for use after a manual payment like a bank transfer).
    -   [ ] Develop a "License Detail" view that shows:
        -   All license properties.
        -   A list of all activated devices, including their unique `deviceId` and activation date.
        -   A **"Deactivate Device"** button next to each activation. This is the crucial feature for remotely freeing up a license seat for a customer who has lost their device.

---

### Definition of Done

-   [ ] An administrator can securely log in to the Admin Platform.
-   [ ] The platform can read and display all customer and license data from the central database.
-   [ ] An admin can manually create a new license and assign it to a customer.
-   [ ] An admin can look up any license and remotely deactivate a specific device, freeing up a license seat.
-   [ ] The system provides the core, manual tools needed to manage the SaaS business.