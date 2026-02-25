# ⚡ SPRINT 9 – Secure Licensing & Subscription Engine

🎯 **Goal:** Implement a robust, offline-first licensing and subscription system that is resistant to tampering and unauthorized duplication, while allowing for legitimate device migration.

---

### Architecture Overview

This system uses a hybrid approach. An initial online activation is required, where the client app communicates with a license server via a REST API. After activation, the app can run fully offline, performing all license validation locally using cryptographic keys and anti-tampering checks.

-   **Server-Side:** Manages license seats and issues cryptographically signed license tokens.
-   **Client-Side:** Stores the signed token and performs all daily validation offline, including checks against device fingerprinting and clock manipulation.

---

### ✅ Execution Plan – Server-Side (API)

*This outlines the required API endpoints. The server can be a separate application (e.g., Node.js/Express, Cloud Functions).*

#### 1️⃣ License Database Schema
- [ ] **Licenses Table:**
    - `license_key` (string, unique): The master key given to the customer.
    - `customer_id` (string): Link to the customer record.
    - `plan_type` (string): e.g., "PRO_YEARLY", "LIFETIME".
    - `max_seats` (integer): Number of devices allowed simultaneously (e.g., 1).
- [ ] **Activations Table:**
    - `activation_id` (PK): Unique ID for the activation.
    - `license_id` (FK): Links to the Licenses table.
    - `device_id` (string, unique): The client's unique device fingerprint.
    - `is_active` (boolean): `true` if this is an active seat.
    - `activated_at` (timestamp).
    - `deactivated_at` (timestamp, nullable).

#### 2️⃣ Cryptography Setup
- [ ] Generate a public/private key pair (RS256 is recommended).
- [ ] The **Private Key** must be stored securely on the server and used for signing license tokens.
- [ ] The **Public Key** will be distributed with the client application to verify tokens offline.

#### 3️⃣ API Endpoint: `/api/license/activate`
- [ ] **Method:** `POST`
- [ ] **Body:** `{ licenseKey: string, deviceId: string }`
- [ ] **Logic:**
    1.  Find the license by `licenseKey` in the database.
    2.  Count the number of `is_active: true` activations for that license.
    3.  If `active_seats < max_seats`, proceed. Otherwise, return an error.
    4.  Create or update an activation record with the `deviceId` and set `is_active: true`.
    5.  Generate a new **JSON Web Token (JWT)** with the private key.
    6.  **JWT Payload:**
        -   `sub`: The `licenseKey`.
        -   `deviceId`: The client-provided `deviceId`.
        -   `plan`: The `plan_type`.
        -   `iat`: Issued At timestamp.
        -   `exp`: Expiration timestamp (e.g., 1 year from now).
    7.  Return the signed JWT to the client.

#### 4️⃣ API Endpoint: `/api/license/deactivate`
- [ ] **Method:** `POST`
- [ ] **Body:** `{ signedToken: string }` (The JWT stored on the client).
- [ ] **Logic:**
    1.  Verify the JWT signature using the public key.
    2.  Extract the `deviceId` from the token payload.
    3.  Find the corresponding record in the `Activations` table.
    4.  Set `is_active: false` and `deactivated_at` to the current time.
    5.  Return a success message.

---

### ✅ Execution Plan – Client-Side (Next.js App)

#### 1️⃣ Device & Security Utilities
- [ ] Create a `lib/security.ts` module.
- [ ] **Device Fingerprinting:** Implement a `generateDeviceFingerprint()` function. This will use a library like `fingerprintjs` or combine stable browser APIs (`navigator.userAgent`, `screen.width`, etc.) and hash the result to create a unique `deviceId`.
- [ ] **Secure Enclave:**
    -   Implement functions to `readSecureEnclave()` and `writeSecureEnclave()`.
    -   This enclave (stored in `localStorage`) will be a JSON object containing the signed JWT and the `last_known_time`.
    -   Embed a secret "pepper" string in the app code. This will be used as the key for an HMAC-SHA256 signature.
    -   The `writeSecureEnclave()` function must calculate an HMAC signature of the data and store it alongside the data. The `readSecureEnclave()` function must verify this signature upon reading.

#### 2️⃣ License Management UI
- [ ] Create a new "License" or "Activation" section within the existing `/dashboard/settings` page.
- [ ] Add an input field for the user to enter their master `licenseKey`.
- [ ] Add an "Activate" button that triggers the API call.
- [ ] Add a "Deactivate This Device" button that appears after successful activation.

#### 3️⃣ Core Validation Logic (Offline)
- [ ] Create a new `LicenseProvider` or a hook (`useLicense.ts`) that runs on application startup.
- [ ] **Startup Check Flow:**
    1.  Read the data from the `secureEnclave`. Fail if the HMAC signature is invalid (tampering detected).
    2.  If no enclave exists, lock the app and prompt for activation.
    3.  Verify the JWT's signature using the embedded public key. Fail if invalid.
    4.  Re-generate the current device's fingerprint. Fail if it does not match the `deviceId` inside the JWT payload (cloning detected).
    5.  Get the current system time. Fail if `currentTime < last_known_time` from the enclave (clock tampering detected).
    6.  Check if `currentTime > JWT.exp`. Fail if the license has expired.
    7.  If all checks pass, update `last_known_time` in the enclave to the `currentTime` and save it (with a new HMAC signature).
    8.  Allow the application to run.
- [ ] **App Locking:** If any check fails, wrap the entire application in a component that shows a "License Invalid" screen and blocks all other UI.

---

### Definition of Done
- [ ] The server can issue and deactivate licenses via the API.
- [ ] The client can generate a stable device ID.
- [ ] The client can activate itself by calling the API and storing the returned token in a tamper-resistant "secure enclave".
- [ ] On every startup, the client performs all required offline checks (HMAC, JWT signature, device ID, clock tamper, expiry).
- [ ] The application successfully locks itself if any validation check fails.
- [ ] A user can successfully deactivate an old device and activate a new one.