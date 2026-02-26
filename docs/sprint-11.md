# 💳 SPRINT 11 – Admin Platform: Payment & License Automation

🎯 **Goal:** To fully automate the sales and license delivery process by integrating with a third-party payment gateway. This removes the need for manual license creation and provides a seamless experience for customers.

---

### ✅ Execution Plan – Backend (Server & API)

1.  **Payment Gateway Integration:**
    -   [ ] Choose and sign up for a payment gateway service (e.g., Stripe for international, Midtrans or Xendit for Indonesia).
    -   [ ] Securely configure the server with the necessary API keys from the payment gateway.

2.  **Webhook Listener Implementation:**
    -   [ ] Create a new, secure API endpoint on the server (e.g., `/api/payments/webhook`) designed to receive notifications from the payment gateway.
    -   [ ] Implement signature verification logic within the webhook to ensure all incoming requests are genuinely from the payment gateway and have not been tampered with. This is critical for security.

3.  **Automated License Logic:**
    -   [ ] Develop the core logic inside the webhook handler that, upon receiving a `payment_successful` event, automatically:
        1.  Creates a new customer record in the database if one doesn't exist.
        2.  Generates a new, unique license key in the `Licenses` table.
        3.  Links the new license to the customer record.

### ✅ Execution Plan – Frontend (Customer-Facing & Admin)

1.  **Customer-Facing Payment Page:**
    -   [ ] Create a simple, public-facing "Purchase" page on the main marketing website (this is separate from the POS app itself).
    -   [ ] Integrate the payment gateway's checkout UI (e.g., Stripe Checkout, Midtrans Snap) into this page.

2.  **Email Delivery Integration:**
    -   [ ] Integrate an email sending service (e.g., SendGrid, Resend).
    -   [ ] After the webhook successfully creates a license, trigger an automated email to the customer containing their new license key and instructions for activating it in the POS app.

3.  **Admin Platform UI:**
    -   [ ] Create a new "Payments" section in the Admin Platform.
    -   [ ] This section will display a log of all incoming payment transactions from the gateway, showing the status of each payment and whether a license was successfully issued.

---

### Definition of Done

-   [ ] A new customer can visit the website, complete a payment, and automatically receive their license key via email without any manual admin intervention.
-   [ ] The server correctly validates incoming webhooks and creates corresponding customer and license records in the database.
-   [ ] The Admin Platform provides a clear audit trail of all payment transactions received from the gateway.
-   [ ] The entire sales and fulfillment process is automated.