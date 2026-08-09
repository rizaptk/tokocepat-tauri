use crate::hwid;
use firelite::document::firelite_doc::FireLiteDoc;
use firelite::document::value::Value;
use firelite::tauri_gateway::FireLiteGateway;
use serde::{Deserialize, Serialize};
// Fixed: Use standard decode components
use chrono::{DateTime, Utc};
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, Runtime};

use std::env;
use std::path::PathBuf;
use std::sync::OnceLock;

use hmac::{Hmac, Mac};
use sha2::Sha256;

type HmacSha256 = Hmac<Sha256>;

static APP_DATA_DIR: OnceLock<PathBuf> = OnceLock::new();

/// Stores the app-data directory (called from lib.rs setup) so the trial anchor
/// survives outside the resettable DB.
pub fn set_app_data_dir(dir: PathBuf) {
    let _ = APP_DATA_DIR.set(dir);
}

fn app_data_dir() -> Option<&'static PathBuf> {
    APP_DATA_DIR.get()
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum LicenseStatus {
    Valid,
    ExpiresSoon,
    Invalid,
    Expired,
    NotFound,
    Tampered,
    Cloned,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LicenseDbData {
    pub jwt: String,
    pub last_known_time: String,
    pub device_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    sub: String,
    plan: String,
    #[serde(rename = "deviceId")]
    device_id: Option<String>,
    #[serde(rename = "isTrial")]
    is_trial: bool,
    #[serde(rename = "maxSeats")]
    pub max_seats: Option<u32>,
    // Lifetime plans ("Unlimited ...") have no `exp` claim, so this must be optional.
    exp: Option<usize>,
}

const EXPIRY_WARNING_DAYS: i64 = 7;
const TRIAL_DAYS: i64 = 30;
const CLOCK_GRACE_MINUTES: i64 = 5;
const PRICING_URL: &str = "https://tokocepat-pos.web.app/harga.html";

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TrialDbData {
    pub started_at: String,
    pub expires_at: String,
    pub last_known_time: String,
    pub synced_at: Option<String>,
    pub device_id: String,
}

// --- LOCAL CONVERSION HELPERS ---

/// Helper to get the API URL from environment variables or default
fn get_api_url(path: &str) -> String {
    // 1. Try to get from system environment (set during build or in .env)
    // 2. Fallback to a hardcoded production URL if nothing is found
    let base_url = env::var("VITE_API_BASE_URL")
        .unwrap_or_else(|_| "https://tokocepat-three.vercel.app".to_string());

    format!("{}{}", base_url, path)
}

/// Helper to initialize environment variables (call this in setup)
pub fn init_env() {
    // This looks for a .env file in the current directory or parents
    let _ = dotenvy::dotenv();
}

// --- CORE LOGIC ---

pub fn get_license_db(gateway: &FireLiteGateway) -> Option<LicenseDbData> {
    match gateway.db.get("app_state", "license") {
        Ok(Some(doc)) => {
            let mut map = serde_json::Map::new();
            for (k, v) in &doc.fields {
                map.insert(k.to_string(), v.to_json());
            }
            serde_json::from_value(serde_json::Value::Object(map)).ok()
        }
        _ => None,
    }
}

pub fn save_license_db(gateway: &FireLiteGateway, data: LicenseDbData) -> Result<(), String> {
    let json = serde_json::to_value(data).map_err(|e| e.to_string())?;
    let obj = json.as_object().ok_or("Invalid license data structure")?;

    let mut doc = FireLiteDoc::default();
    for (k, v) in obj {
        doc.insert(k.clone(), Value::from_json(v.clone())?);
    }

    gateway
        .db
        .put("app_state", "license", &doc)
        .map_err(|e| e.to_string())?;
    persist_licensed_ever();
    Ok(())
}

// --- LOCAL TRIAL ---

pub fn get_trial_db(gateway: &FireLiteGateway) -> Option<TrialDbData> {
    match gateway.db.get("app_state", "trial") {
        Ok(Some(doc)) => {
            let mut map = serde_json::Map::new();
            for (k, v) in &doc.fields {
                map.insert(k.to_string(), v.to_json());
            }
            serde_json::from_value(serde_json::Value::Object(map)).ok()
        }
        _ => None,
    }
}

pub fn save_trial_db(gateway: &FireLiteGateway, data: &TrialDbData) -> Result<(), String> {
    let json = serde_json::to_value(data).map_err(|e| e.to_string())?;
    let obj = json.as_object().ok_or("Invalid trial data structure")?;

    let mut doc = FireLiteDoc::default();
    for (k, v) in obj {
        doc.insert(k.clone(), Value::from_json(v.clone())?);
    }

    gateway
        .db
        .put("app_state", "trial", &doc)
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn parse_rfc3339(s: &str) -> Option<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|dt| dt.with_timezone(&Utc))
}

fn trial_ui_details(expires_at: &DateTime<Utc>, now: &DateTime<Utc>) -> serde_json::Value {
    let days_remaining = (*expires_at - *now).num_days();
    serde_json::json!({
        "isTrial": true,
        "plan": "Trial",
        "expiresAt": expires_at.to_rfc3339(),
        "daysRemaining": days_remaining,
        "deviceId": hwid::get_license_hwid(),
        "isSyncAvailable": false,
        "maxSeats": 1,
    })
}

/// Trusted wall-clock from the backend (HTTP Date header). Used to make the trial
/// immune to local clock manipulation when the device is online.
async fn server_utc_now() -> Result<DateTime<Utc>, String> {
    let client = reqwest::Client::new();
    let res = client
        .get(get_api_url("/api/"))
        .timeout(Duration::from_secs(4))
        .send()
        .await
        .map_err(|e| format!("server clock unreachable: {e}"))?;
    let date = res
        .headers()
        .get(reqwest::header::DATE)
        .ok_or("no date header")?
        .to_str()
        .map_err(|e| e.to_string())?;
    chrono::DateTime::parse_from_rfc2822(date)
        .map(|dt| dt.with_timezone(&Utc))
        .map_err(|e| format!("bad date header: {e}"))
}

/// Preferred trusted clock: server time when reachable, local clock otherwise.
async fn server_trust_now() -> DateTime<Utc> {
    server_utc_now().await.unwrap_or_else(|_| Utc::now())
}

/// Signed, DB-independent anchor so a wiped/replaced DB file cannot grant a fresh
/// trial. Resides in the app-data dir and is keyed by the device id.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TrialAnchor {
    pub started_at: String,
    pub device_id: String,
    pub sig: String,
}

/// Signed marker proving a license was ever activated on this device. It survives
/// DB wipes so that after someone buys + deactivates, they don't get a fresh trial.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LicensedEverMarker {
    pub device_id: String,
    pub sig: String,
}

const ANCHOR_SALT: &str = "tokcepat.trial-anchor.v1";

fn sign_anchor(anchor: &TrialAnchor) -> String {
    let payload = format!("{}|{}|{}", ANCHOR_SALT, anchor.device_id, anchor.started_at);
    let mut mac = HmacSha256::new_from_slice(b"tokoc1".repeat(8).as_ref()).expect("hmac key");
    mac.update(payload.as_bytes());
    hex_encode(&mac.finalize().into_bytes())
}

fn hex_encode(bytes: &[u8]) -> String {
    use std::fmt::Write;
    let mut s = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        let _ = write!(s, "{b:02x}");
    }
    s
}

fn anchor_path() -> Option<PathBuf> {
    app_data_dir().map(|dir| dir.join("trial_anchor.json"))
}

fn read_anchor() -> Option<TrialAnchor> {
    let path = anchor_path()?;
    let contents = std::fs::read_to_string(path).ok()?;
    let anchor: TrialAnchor = serde_json::from_str(&contents).ok()?;
    if sign_anchor(&anchor) != anchor.sig {
        return None;
    }
    Some(anchor)
}

fn write_anchor(anchor: &TrialAnchor) {
    if let Some(path) = anchor_path() {
        if let Ok(json) = serde_json::to_string(anchor) {
            let _ = std::fs::write(path, json);
        }
    }
}

fn sign_licensed_ever(marker: &LicensedEverMarker) -> String {
    let payload = format!("{}|{}", ANCHOR_SALT, marker.device_id);
    let mut mac = HmacSha256::new_from_slice(b"tokcever".repeat(8).as_ref()).expect("hmac key");
    mac.update(payload.as_bytes());
    hex_encode(&mac.finalize().into_bytes())
}

fn licensed_ever_path() -> Option<PathBuf> {
    app_data_dir().map(|dir| dir.join("licensed_ever.json"))
}

fn persist_licensed_ever() {
    let device_id = hwid::get_license_hwid();
    let mut marker = LicensedEverMarker {
        device_id: device_id.clone(),
        sig: String::new(),
    };
    marker.sig = sign_licensed_ever(&marker);
    if let Some(path) = licensed_ever_path() {
        if let Ok(json) = serde_json::to_string(&marker) {
            let _ = std::fs::write(path, json);
        }
    }
}

fn read_licensed_ever() -> bool {
    let Some(path) = licensed_ever_path() else {
        return false;
    };
    let Ok(contents) = std::fs::read_to_string(path) else {
        return false;
    };
    let Ok(marker) = serde_json::from_str::<LicensedEverMarker>(&contents) else {
        return false;
    };
    if sign_licensed_ever(&marker) != marker.sig {
        return false;
    }
    marker.device_id == hwid::get_license_hwid()
}

/// Resolves the effective trial start (earliest of DB, sidecar anchor, or now),
/// so deleting/reinstalling the DB cannot re-seed a longer trial.
fn resolve_trial_start(device_id: &str, db_start: Option<DateTime<Utc>>) -> DateTime<Utc> {
    let anchor_start = read_anchor()
        .filter(|a| &a.device_id == device_id)
        .and_then(|a| parse_rfc3339(&a.started_at));
    let candidates = db_start.into_iter().chain(anchor_start);
    candidates.min().unwrap_or_else(Utc::now)
}

fn persist_trial_anchor(trial: &TrialDbData) {
    let mut signed = TrialAnchor {
        started_at: trial.started_at.clone(),
        device_id: trial.device_id.clone(),
        sig: String::new(),
    };
    signed.sig = sign_anchor(&signed);
    write_anchor(&signed);
}

/// Resolves the local trial:
/// - Grants a fixed 7-day trial on first launch (so trial is the default for a new user).
/// - Enforces a monotonic trusted clock (local or server) so the trial cannot be
///   extended by rewinding the PC clock or editing the stored expiry.
/// - Pins the trial start to a signed sidecar anchor so wiping the DB can't re-grant.
async fn check_trial(
    gateway: &FireLiteGateway,
) -> Result<(LicenseStatus, Option<serde_json::Value>), String> {
    let device_id = hwid::get_license_hwid();

    let trial = match get_trial_db(gateway) {
        Some(data) => data,
        None => {
            // Users who have ever held a real license must not be re-granted a fresh
            // trial by deactivating (or by wiping the DB after buying).
            if read_licensed_ever() {
                return Ok((LicenseStatus::NotFound, None));
            }
            // Server time is the most trustworthy anchor for first-run so a pre-tampered
            // clock (rewound before first launch) cannot backdate the trial start.
            let server_now = server_trust_now().await;
            // Any earlier start pinned on disk wins -> wiping the DB can't re-seed.
            let start = resolve_trial_start(&device_id, None).min(server_now);
            let expires = start + chrono::Duration::days(TRIAL_DAYS);
            let created = TrialDbData {
                started_at: start.to_rfc3339(),
                expires_at: expires.to_rfc3339(),
                last_known_time: server_now.to_rfc3339(),
                synced_at: Some(server_now.to_rfc3339()),
                device_id: device_id.clone(),
            };
            save_trial_db(gateway, &created)?;
            persist_trial_anchor(&created);
            created
        }
    };

    let stored_expires = parse_rfc3339(&trial.expires_at).ok_or("INVALID_TRIAL_EXPIRY")?;
    let last_known = parse_rfc3339(&trial.last_known_time).unwrap_or(Utc::now());

    if trial.device_id != device_id {
        return Ok((LicenseStatus::Cloned, None));
    }

    // Trusted "now": server time when reachable, else the local clock.
    let trusted_now = server_trust_now().await;

    // Monotonic guard: reject time jumps backwards beyond a small grace. Handles both
    // local-clock rewinding and tampering with the stored watermark.
    if trusted_now < last_known - chrono::Duration::minutes(CLOCK_GRACE_MINUTES) {
        return Ok((LicenseStatus::Tampered, None));
    }

    // Advance the stored monotonic watermark forward.
    if trusted_now > last_known {
        let mut updated = trial.clone();
        updated.last_known_time = trusted_now.to_rfc3339();
        let _ = save_trial_db(gateway, &updated);
    }

    let ui_details = trial_ui_details(&stored_expires, &trusted_now);

    if trusted_now >= stored_expires {
        return Ok((LicenseStatus::Expired, Some(ui_details)));
    }

    let days_remaining = (stored_expires - trusted_now).num_days();
    let status = if days_remaining <= EXPIRY_WARNING_DAYS {
        LicenseStatus::ExpiresSoon
    } else {
        LicenseStatus::Valid
    };

    Ok((status, Some(ui_details)))
}

#[tauri::command]
pub fn open_pricing() -> Result<(), String> {
    open::that(PRICING_URL).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn check_license(
    state: tauri::State<'_, FireLiteGateway>,
) -> Result<(LicenseStatus, Option<serde_json::Value>), String> {
    let gateway = state.inner();

    let license_data = match get_license_db(gateway) {
        Some(data) => data,
        None => return check_trial(gateway).await,
    };

    let current_hwid = hwid::get_license_hwid();
    if current_hwid != license_data.device_id {
        return Ok((LicenseStatus::Cloned, None));
    }

    let now = Utc::now();
    let last_known = DateTime::parse_from_rfc3339(&license_data.last_known_time)
        .map(|dt| dt.with_timezone(&Utc))
        .unwrap_or(now);

    if now < last_known {
        return Ok((LicenseStatus::Tampered, None));
    }

    let mut validation = Validation::default();
    validation.insecure_disable_signature_validation();
    validation.validate_exp = false;
    validation.algorithms = vec![Algorithm::HS256, Algorithm::RS256, Algorithm::ES256];
    // Lifetime plans have no `exp` claim; don't require it as a spec claim.
    validation.required_spec_claims.clear();

    // This now captures 'plan', 'isTrial', etc.
    let token_data = decode::<Claims>(
        &license_data.jwt,
        &DecodingKey::from_secret(&[]),
        &validation,
    )
    .map_err(|e| format!("INVALID_TOKEN: {}", e))?;

    let now = Utc::now();

    // is Multi device support subscriptions?
    let is_sync_available = token_data.claims.max_seats.unwrap_or(0) > 1;

    // Prepare response
    let mut ui_details = serde_json::to_value(&token_data.claims).unwrap();

    // Lifetime license: backend omits the `exp` claim entirely.
    if let Some(expiry_timestamp) = token_data.claims.exp {
        let expiry_date =
            DateTime::from_timestamp(expiry_timestamp as i64, 0).ok_or("INVALID_EXPIRY")?;

        // Use .num_days() for full days, but if it's less than 24h,
        // it returns 0. For the UI, we might want to show at least 1
        // if it's not expired yet, or 0 if it expires today.
        let days_remaining = (expiry_date - now).num_days();

        if let Some(obj) = ui_details.as_object_mut() {
            obj.insert(
                "expiresAt".to_string(),
                serde_json::json!(expiry_date.to_rfc3339()),
            );
            obj.insert(
                "daysRemaining".to_string(),
                serde_json::json!(days_remaining),
            );
            obj.insert(
                "deviceId".to_string(),
                serde_json::json!(license_data.device_id),
            );
            obj.insert(
                "isSyncAvailable".to_string(),
                serde_json::json!(is_sync_available),
            );
            // 'plan' is now included automatically because it's in the struct!
        }

        if now > expiry_date {
            return Ok((LicenseStatus::Expired, Some(ui_details)));
        }

        let status = if days_remaining <= EXPIRY_WARNING_DAYS {
            LicenseStatus::ExpiresSoon
        } else {
            LicenseStatus::Valid
        };

        return Ok((status, Some(ui_details)));
    }

    // No `exp` claim -> never expires. Frontend renders "Selamanya".
    if let Some(obj) = ui_details.as_object_mut() {
        obj.insert("expiresAt".to_string(), serde_json::json!("Never"));
        obj.insert("daysRemaining".to_string(), serde_json::Value::Null);
        obj.insert(
            "deviceId".to_string(),
            serde_json::json!(license_data.device_id),
        );
        obj.insert(
            "isSyncAvailable".to_string(),
            serde_json::json!(is_sync_available),
        );
    }

    Ok((LicenseStatus::Valid, Some(ui_details)))
}

pub async fn run_heartbeat<R: Runtime>(app: AppHandle<R>) {
    let client = reqwest::Client::new();
    loop {
        tokio::time::sleep(Duration::from_secs(180)).await;

        if let Some(gateway) = app.try_state::<FireLiteGateway>() {
            if let Some(license) = get_license_db(&gateway) {
                let hwid = hwid::get_license_hwid();

                let body = serde_json::json!({
                    "token": license.jwt,
                    "deviceId": hwid
                });

                let url = get_api_url("/api/heartbeat");

                let res = client.post(url).json(&body).send().await;

                if let Ok(response) = res {
                    if let Ok(data) = response.json::<serde_json::Value>().await {
                        if data["status"] == "activation_required" {
                            let _ = app.emit("license-reverify", data["ticketId"].as_str());
                        }
                    }
                }
            }
        }
    }
}

#[tauri::command]
pub async fn claim_license(
    state: tauri::State<'_, FireLiteGateway>,
    ticket_id: String,
) -> Result<String, String> {
    let gateway = state.inner();
    let device_id = hwid::get_license_hwid();
    let client = reqwest::Client::new();

    let url = get_api_url("/api/license/claim");
    // 1. Call Claim API
    let res = client
        .post(url)
        .json(&serde_json::json!({ "ticketId": ticket_id, "deviceId": device_id }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        let err_body: serde_json::Value = res.json().await.map_err(|_| "API Error")?;
        return Err(err_body["error"]
            .as_str()
            .unwrap_or("Claim failed")
            .to_string());
    }

    let result: serde_json::Value = res.json().await.map_err(|_| "Invalid JSON response")?;
    let token = result["token"]
        .as_str()
        .ok_or("Token missing in response")?;

    // 2. Save to DB
    save_license_db(
        gateway,
        LicenseDbData {
            jwt: token.to_string(),
            last_known_time: Utc::now().to_rfc3339(),
            device_id: device_id.clone(),
        },
    )?;

    Ok("License claimed successfully".to_string())
}

#[tauri::command]
pub async fn activate_manual_license(
    state: tauri::State<'_, FireLiteGateway>,
    license_key: String,
) -> Result<String, String> {
    let gateway = state.inner();
    let device_id = hwid::get_license_hwid();
    let client = reqwest::Client::new();

    let url = get_api_url("/api/license/activate");

    let res = client
        .post(url)
        .json(&serde_json::json!({
            "licenseKey": license_key,
            "deviceId": device_id
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        let err_body: serde_json::Value = res.json().await.map_err(|_| "API Error")?;
        return Err(err_body["error"]
            .as_str()
            .unwrap_or("Activation failed")
            .to_string());
    }

    let result: serde_json::Value = res.json().await.map_err(|_| "Invalid response")?;
    let token = result["token"].as_str().ok_or("Token missing")?;

    save_license_db(
        gateway,
        LicenseDbData {
            jwt: token.to_string(),
            last_known_time: Utc::now().to_rfc3339(),
            device_id,
        },
    )?;

    Ok("Activated".to_string())
}

#[tauri::command]
pub async fn deactivate_license(
    state: tauri::State<'_, FireLiteGateway>,
) -> Result<String, String> {
    let gateway = state.inner();

    // 1. Get current license to find the JWT
    let license = get_license_db(gateway).ok_or("No active license found to deactivate.")?;
    let client = reqwest::Client::new();

    let url = get_api_url("/api/license/deactivate");
    // 2. Notify the server
    let res = client
        .post(url)
        .json(&serde_json::json!({ "token": license.jwt }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    // Even if server call fails, we proceed to delete local data to "free" the app,
    // but you might want to handle this differently based on your business logic.
    if !res.status().is_success() {
        let err_body: serde_json::Value = res.json().await.map_err(|_| "API Error")?;
        return Err(err_body["error"]
            .as_str()
            .unwrap_or("Deactivation failed")
            .to_string());
    }

    // 3. Delete from FireLite
    gateway
        .db
        .delete("app_state", "license")
        .map_err(|e| e.to_string())?;
    // 4. Remove any leftover trial window too, so a previously-licensed device that
    //    never actually used its trial can't fall back to a fresh trial after leaving.
    let _ = gateway.db.delete("app_state", "trial");

    Ok("Deactivated".to_string())
}
