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

use hmac::{Hmac, Mac};
use sha2::{Digest, Sha256};

type HmacSha256 = Hmac<Sha256>;

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
    /// Device is eligible for a trial but the user has not yet accepted the
    /// terms of use. The trial is NOT applied until `start_trial` is called.
    TrialPending,
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
    /// True once the server has confirmed this exact install owns the trial
    /// (we hold the matching `verification_token`). Bound to the server record.
    #[serde(default)]
    pub server_verified: bool,
    /// One-time token issued by `POST /api/license/trial-verify`. Proves a
    /// recheck/reboot belongs to the same install that originally registered.
    #[serde(default)]
    pub verification_token: Option<String>,
}

/// Result of a server contact during trial start / heartbeat reconciliation.
enum TrialServerOutcome {
    /// Fresh one-shot registration. `expires_at` is authoritative (server clock).
    Granted {
        activated_at: DateTime<Utc>,
        expires_at: DateTime<Utc>,
        token: String,
    },
    /// The record exists and we proved ownership with our verifier: re-sync times.
    Verified {
        activated_at: DateTime<Utc>,
        expires_at: DateTime<Utc>,
    },
    /// The device already used its trial (legacy record or foreign install).
    AlreadyUsed,
    /// Network/server failure -> caller falls back to the offline path.
    Unreachable,
}

/// Contacts `POST /api/license/trial-verify` and interprets the reply.
async fn trial_server_verify(device_id: &str, verifier: Option<&str>) -> TrialServerOutcome {
    let client = reqwest::Client::new();
    let mut body = serde_json::json!({ "deviceId": device_id });
    if let Some(v) = verifier {
        body["verifier"] = serde_json::json!(v);
    }
    let url = get_api_url("/api/license/trial-verify");

    let Ok(res) = client
        .post(url)
        .json(&body)
        .timeout(Duration::from_secs(6))
        .send()
        .await
    else {
        return TrialServerOutcome::Unreachable;
    };
    if !res.status().is_success() {
        return TrialServerOutcome::Unreachable;
    }
    let Ok(parsed) = res.json::<serde_json::Value>().await else {
        return TrialServerOutcome::Unreachable;
    };

    match parsed["status"].as_str() {
        Some("granted") => {
            match (
                parsed["activatedAt"].as_str().and_then(parse_rfc3339),
                parsed["expiresAt"].as_str().and_then(parse_rfc3339),
                parsed["verificationToken"].as_str().map(|s| s.to_string()),
            ) {
                (Some(a), Some(e), Some(t)) => TrialServerOutcome::Granted {
                    activated_at: a,
                    expires_at: e,
                    token: t,
                },
                _ => TrialServerOutcome::Unreachable,
            }
        }
        Some("verified") => {
            match (
                parsed["activatedAt"].as_str().and_then(parse_rfc3339),
                parsed["expiresAt"].as_str().and_then(parse_rfc3339),
            ) {
                (Some(a), Some(e)) => TrialServerOutcome::Verified {
                    activated_at: a,
                    expires_at: e,
                },
                _ => TrialServerOutcome::Unreachable,
            }
        }
        Some("already_used") => TrialServerOutcome::AlreadyUsed,
        _ => TrialServerOutcome::Unreachable,
    }
}

/// Earliest of several optional timestamps (used to clamp local state against the
/// server's authoritative times so the trial can never be stretched beyond 30 days).
fn earliest<'a>(values: impl IntoIterator<Item = &'a str>) -> Option<DateTime<Utc>> {
    values
        .into_iter()
        .filter_map(parse_rfc3339)
        .min()
}

// --- LOCAL CONVERSION HELPERS ---
fn get_api_url(path: &str) -> String {
    const PRODUCTION_DEFAULT: &str = "https://tokocepat-three.vercel.app";
    let base_url = env::var("VITE_API_BASE_URL").unwrap_or_else(|_| PRODUCTION_DEFAULT.to_string());

    // Never send license tokens / device IDs over plaintext HTTP in release.
    // A `.env`/env-var override must not be able to downgrade the channel.
    #[cfg(not(debug_assertions))]
    if base_url.starts_with("http://") {
        eprintln!("[security] Refusing insecure HTTP API base URL in release build; using HTTPS production default.");
        return format!("{}{}", PRODUCTION_DEFAULT, path);
    }

    format!("{}{}", base_url, path)
}

/// Shared HS256 secret used to verify license JWTs.
///
/// Mirrors the server's `getJwtSecret()` in `tokocepat/src/lib/jwt.ts`:
/// prefers `JWT_SECRET_KEY`, then `VITE_JWT_SECRET` (runtime or baked in at
/// build time), and finally falls back to the same well-known development
/// value the server uses when unset. This keeps verification consistent in
/// dev, and in production both sides should set the same real secret so
/// forged tokens are rejected.
fn jwt_secret() -> Vec<u8> {
    const DEV_FALLBACK_SECRET: &str = "a_very_insecure_default_secret_key_for_development_only";
    let secret = env::var("JWT_SECRET_KEY")
        .or_else(|_| env::var("VITE_JWT_SECRET"))
        .ok()
        .filter(|s| !s.is_empty())
        .or_else(|| option_env!("VITE_JWT_SECRET").map(|s| s.to_string()))
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| {
            #[cfg(not(debug_assertions))]
            eprintln!("[security] No JWT secret configured in release build; using development fallback. Set JWT_SECRET_KEY/VITE_JWT_SECRET to match the server.");
            DEV_FALLBACK_SECRET.to_string()
        });
    secret.into_bytes()
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
    persist_licensed_ever(gateway);
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

/// Trusted wall-clock from the backend (`GET /api/health`). Used to make the
/// trial immune to local clock manipulation when the device is online.
/// Optional by design: callers fall back to the local clock when unreachable,
/// so the app keeps working fully offline.
async fn server_utc_now() -> Result<DateTime<Utc>, String> {
    let client = reqwest::Client::new();
    let res = client
        .get(get_api_url("/api/health"))
        .timeout(Duration::from_secs(4))
        .send()
        .await
        .map_err(|e| format!("server clock unreachable: {e}"))?;
    if !res.status().is_success() {
        return Err(format!("server clock unreachable: HTTP {}", res.status()));
    }
    let body: serde_json::Value = res
        .json()
        .await
        .map_err(|e| format!("server clock bad response: {e}"))?;
    let now = body
        .get("now")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "server clock missing 'now' field".to_string())?;
    parse_rfc3339(now).ok_or_else(|| "server clock invalid 'now' timestamp".to_string())
}

/// Preferred trusted clock: server time when reachable, local clock otherwise.
async fn server_trust_now() -> DateTime<Utc> {
    server_utc_now().await.unwrap_or_else(|_| Utc::now())
}

/// Signed, DB-independent anchor so a wiped/replaced DB file cannot grant a fresh
/// trial. Stored inside the encrypted `app_state` collection and keyed by device id.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TrialAnchor {
    pub started_at: String,
    pub device_id: String,
    pub sig: String,
}

/// Signed marker proving a license was ever activated on this device. It survives
/// DB wipes so that after someone buys + deactivates, they don't get a fresh trial.
/// Stored in the encrypted `app_state` collection.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LicensedEverMarker {
    pub device_id: String,
    pub sig: String,
}

const ANCHOR_SALT: &str = "tokcepat.trial-anchor.v1";

/// Derives a per-device HMAC key from the hardware id so forged/erased markers
/// can't be minted with a single value read out of the binary. The server-side
/// `trial-verify` remains the real backstop; this only binds local markers to
/// this specific device.
fn device_key(domain: &str) -> Vec<u8> {
    let mut hasher = Sha256::new();
    hasher.update(b"tokcepat.marker.v1|");
    hasher.update(domain.as_bytes());
    hasher.update(b"|");
    hasher.update(hwid::get_license_hwid().as_bytes());
    hasher.finalize().to_vec()
}

fn sign_anchor(anchor: &TrialAnchor) -> String {
    let payload = format!("{}|{}|{}", ANCHOR_SALT, anchor.device_id, anchor.started_at);
    let key = device_key("trial-anchor");
    let mut mac = HmacSha256::new_from_slice(&key).expect("hmac key");
    mac.update(payload.as_bytes());
    hex_encode(&mac.finalize().into_bytes())
}

/// Legacy signature using the old hard-coded key. Accepted on read only, so
/// installs that wrote markers before the device-bound keys landed don't lose
/// their trial/ever-used history on upgrade.
fn legacy_sign_anchor(anchor: &TrialAnchor) -> String {
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

fn read_anchor(gateway: &FireLiteGateway) -> Option<TrialAnchor> {
    let doc = gateway.db.get("app_state", "trial_anchor").ok().flatten()?;
    let mut map = serde_json::Map::new();
    for (k, v) in &doc.fields {
        map.insert(k.to_string(), v.to_json());
    }
    let anchor: TrialAnchor = serde_json::from_value(serde_json::Value::Object(map)).ok()?;
    if sign_anchor(&anchor) != anchor.sig && legacy_sign_anchor(&anchor) != anchor.sig {
        return None;
    }
    Some(anchor)
}

fn write_anchor(gateway: &FireLiteGateway, anchor: &TrialAnchor) {
    let Ok(json) = serde_json::to_value(anchor) else {
        return;
    };
    let Some(obj) = json.as_object() else {
        return;
    };
    let mut doc = FireLiteDoc::default();
    for (k, v) in obj {
        let Ok(val) = Value::from_json(v.clone()) else {
            continue;
        };
        doc.insert(k.clone(), val);
    }
    let _ = gateway.db.put("app_state", "trial_anchor", &doc);
}

fn sign_licensed_ever(marker: &LicensedEverMarker) -> String {
    let payload = format!("{}|{}", ANCHOR_SALT, marker.device_id);
    let key = device_key("licensed-ever");
    let mut mac = HmacSha256::new_from_slice(&key).expect("hmac key");
    mac.update(payload.as_bytes());
    hex_encode(&mac.finalize().into_bytes())
}

/// Legacy signature using the old hard-coded key; accepted on read only.
fn legacy_sign_licensed_ever(marker: &LicensedEverMarker) -> String {
    let payload = format!("{}|{}", ANCHOR_SALT, marker.device_id);
    let mut mac = HmacSha256::new_from_slice(b"tokcever".repeat(8).as_ref()).expect("hmac key");
    mac.update(payload.as_bytes());
    hex_encode(&mac.finalize().into_bytes())
}

fn persist_licensed_ever(gateway: &FireLiteGateway) {
    let device_id = hwid::get_license_hwid();
    let mut marker = LicensedEverMarker {
        device_id: device_id.clone(),
        sig: String::new(),
    };
    marker.sig = sign_licensed_ever(&marker);
    let Ok(json) = serde_json::to_value(&marker) else {
        return;
    };
    let Some(obj) = json.as_object() else {
        return;
    };
    let mut doc = FireLiteDoc::default();
    for (k, v) in obj {
        let Ok(val) = Value::from_json(v.clone()) else {
            continue;
        };
        doc.insert(k.clone(), val);
    }
    let _ = gateway.db.put("app_state", "licensed_ever", &doc);
}

fn read_licensed_ever(gateway: &FireLiteGateway) -> bool {
    let Ok(Some(doc)) = gateway.db.get("app_state", "licensed_ever") else {
        return false;
    };
    let mut map = serde_json::Map::new();
    for (k, v) in &doc.fields {
        map.insert(k.to_string(), v.to_json());
    }
    let Ok(marker) = serde_json::from_value::<LicensedEverMarker>(serde_json::Value::Object(map))
    else {
        return false;
    };
    if sign_licensed_ever(&marker) != marker.sig && legacy_sign_licensed_ever(&marker) != marker.sig {
        return false;
    }
    marker.device_id == hwid::get_license_hwid()
}

/// Signed marker recording that the server refused a trial on this device
/// (`already_used`). Kept locally so an offline boot does not re-offer the trial
/// consent after the server has permanently denied this device.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TrialUsedMarker {
    pub device_id: String,
    pub sig: String,
}

const TRIAL_USED_SALT: &str = "tokcepat.trial-used.v1";

fn sign_trial_used(marker: &TrialUsedMarker) -> String {
    let payload = format!("{}|{}", TRIAL_USED_SALT, marker.device_id);
    let key = device_key("trial-used");
    let mut mac = HmacSha256::new_from_slice(&key).expect("hmac key");
    mac.update(payload.as_bytes());
    hex_encode(&mac.finalize().into_bytes())
}

/// Legacy signature using the old hard-coded key; accepted on read only.
fn legacy_sign_trial_used(marker: &TrialUsedMarker) -> String {
    let payload = format!("{}|{}", TRIAL_USED_SALT, marker.device_id);
    let mut mac = HmacSha256::new_from_slice(b"tokcused".repeat(8).as_ref()).expect("hmac key");
    mac.update(payload.as_bytes());
    hex_encode(&mac.finalize().into_bytes())
}

fn persist_trial_used(gateway: &FireLiteGateway) {
    let device_id = hwid::get_license_hwid();
    let mut marker = TrialUsedMarker {
        device_id: device_id.clone(),
        sig: String::new(),
    };
    marker.sig = sign_trial_used(&marker);
    let Ok(json) = serde_json::to_value(&marker) else {
        return;
    };
    let Some(obj) = json.as_object() else {
        return;
    };
    let mut doc = FireLiteDoc::default();
    for (k, v) in obj {
        let Ok(val) = Value::from_json(v.clone()) else {
            continue;
        };
        doc.insert(k.clone(), val);
    }
    let _ = gateway.db.put("app_state", "trial_used", &doc);
}

fn read_trial_used(gateway: &FireLiteGateway) -> bool {
    let Ok(Some(doc)) = gateway.db.get("app_state", "trial_used") else {
        return false;
    };
    let mut map = serde_json::Map::new();
    for (k, v) in &doc.fields {
        map.insert(k.to_string(), v.to_json());
    }
    let Ok(marker) = serde_json::from_value::<TrialUsedMarker>(serde_json::Value::Object(map))
    else {
        return false;
    };
    if sign_trial_used(&marker) != marker.sig && legacy_sign_trial_used(&marker) != marker.sig {
        return false;
    }
    marker.device_id == hwid::get_license_hwid()
}

/// Resolves the effective trial start (earliest of DB, stored anchor, or now),
/// so deleting/reinstalling the DB cannot re-seed a longer trial.
fn resolve_trial_start(
    gateway: &FireLiteGateway,
    device_id: &str,
    db_start: Option<DateTime<Utc>>,
) -> DateTime<Utc> {
    let anchor_start = read_anchor(gateway)
        .filter(|a| &a.device_id == device_id)
        .and_then(|a| parse_rfc3339(&a.started_at));
    let candidates = db_start.into_iter().chain(anchor_start);
    candidates.min().unwrap_or_else(Utc::now)
}

fn persist_trial_anchor(gateway: &FireLiteGateway, trial: &TrialDbData) {
    let mut signed = TrialAnchor {
        started_at: trial.started_at.clone(),
        device_id: trial.device_id.clone(),
        sig: String::new(),
    };
    signed.sig = sign_anchor(&signed);
    write_anchor(gateway, &signed);
}

/// Creates a local trial record for an eligible device — used only on the
/// OFFLINE path (server unreachable), or when the server grants fresh. Persists
/// both the DB record and the signed anchor; the trial stays *unverified* until a
/// heartbeat can confirm it against the server.
async fn create_trial(
    gateway: &FireLiteGateway,
    device_id: &str,
) -> Result<TrialDbData, String> {
    // Users who have ever held a real license must not be re-granted a fresh
    // trial by deactivating (or by wiping the DB after buying).
    if read_licensed_ever(gateway) {
        return Err("Trial is not available on this device".into());
    }
    if read_trial_used(gateway) {
        return Err("Trial has already been used on this device".into());
    }
    if get_trial_db(gateway).is_some() {
        return Err("A trial already exists on this device".into());
    }

    // Server time is the most trustworthy anchor for first-run so a pre-tampered
    // clock (rewound before first launch) cannot backdate the trial start.
    let server_now = server_trust_now().await;
    // Any earlier start pinned on disk wins -> wiping the DB can't re-seed.
    let start = resolve_trial_start(gateway, device_id, None).min(server_now);
    let expires = start + chrono::Duration::days(TRIAL_DAYS);
    let created = TrialDbData {
        started_at: start.to_rfc3339(),
        expires_at: expires.to_rfc3339(),
        last_known_time: server_now.to_rfc3339(),
        synced_at: Some(server_now.to_rfc3339()),
        device_id: device_id.to_string(),
        server_verified: false,
        verification_token: None,
    };
    save_trial_db(gateway, &created)?;
    persist_trial_anchor(gateway, &created);
    Ok(created)
}

/// Persists a trial issued from a fresh server grant, adopting the server's
/// authoritative expiry (never later than the server's own `expires_at`).
fn persist_granted_trial(
    gateway: &FireLiteGateway,
    device_id: &str,
    activated_at: DateTime<Utc>,
    server_expires: DateTime<Utc>,
    token: String,
) -> Result<TrialDbData, String> {
    // Start is the earliest of server activation and any previously pinned anchor
    // (wiping the DB can't re-seed), but never later than server now.
    let start = resolve_trial_start(gateway, device_id, None).min(activated_at);
    // Server expiry is authoritative; clamp so a rewound clock can't extend it.
    let expires = server_expires;
    let created = TrialDbData {
        started_at: start.to_rfc3339(),
        expires_at: expires.to_rfc3339(),
        last_known_time: activated_at.to_rfc3339(),
        synced_at: Some(activated_at.to_rfc3339()),
        device_id: device_id.to_string(),
        server_verified: true,
        verification_token: Some(token),
    };
    save_trial_db(gateway, &created)?;
    persist_trial_anchor(gateway, &created);
    Ok(created)
}

/// Resolves the local trial:
/// - If the device is eligible but no trial has been applied yet, returns
///   `TrialPending` (the UI presents the terms of use and then calls
///   `start_trial` to actually apply the trial).
/// - Enforces a monotonic trusted clock (local or server) so the trial cannot be
///   extended by rewinding the PC clock or editing the stored expiry.
/// - Pins the trial start to a signed anchor so wiping the DB can't re-grant.
async fn check_trial(
    gateway: &FireLiteGateway,
) -> Result<(LicenseStatus, Option<serde_json::Value>), String> {
    let device_id = hwid::get_license_hwid();

    let trial = match get_trial_db(gateway) {
        Some(data) => data,
        None => {
            // Users who have ever held a real license must not be re-granted a fresh
            // trial by deactivating (or by wiping the DB after buying).
            if read_licensed_ever(gateway) || read_trial_used(gateway) {
                return Ok((LicenseStatus::NotFound, None));
            }
            // Eligible but not yet accepted the terms of use -> trial NOT applied.
            return Ok((
                LicenseStatus::TrialPending,
                Some(serde_json::json!({
                    "isTrial": true,
                    "trialAvailable": true,
                    "plan": "Trial",
                    "daysRemaining": TRIAL_DAYS,
                    "deviceId": hwid::get_license_hwid(),
                    "isSyncAvailable": false,
                    "maxSeats": 1,
                })),
            ));
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

/// Applies the trial for an eligible device. Only called after the user has
/// accepted the terms of use in the UI (see `check_license` -> `TrialPending`).
///
/// Online: registers the one-shot trial server-side (`trial-verify`) and adopts
/// the server's authoritative expiry + verifier token. A legacy trial record (or a
/// DB wipe/reinstall) returns `already_used` which permanently blocks this device.
///
/// Offline: falls back to a local trial marked `server_verified=false`; the next
/// successful heartbeat reconciles it with the server (and may revoke it).
#[tauri::command]
pub async fn start_trial(
    state: tauri::State<'_, FireLiteGateway>,
) -> Result<serde_json::Value, String> {
    let gateway = state.inner();
    let device_id = hwid::get_license_hwid();

    if get_license_db(gateway).is_some() {
        return Err("A license is already active on this device".into());
    }
    // A real license was once held here -> no fresh trial.
    if read_licensed_ever(gateway) {
        return Err("Trial is not available on this device".into());
    }
    if read_trial_used(gateway) {
        return Err("Trial has already been used on this device".into());
    }

    // Prefer the server: it is the single source of truth for one-trial-per-device.
    let created = match trial_server_verify(&device_id, None).await {
        TrialServerOutcome::Granted {
            activated_at,
            expires_at,
            token,
        } => persist_granted_trial(gateway, &device_id, activated_at, expires_at, token)?,
        TrialServerOutcome::AlreadyUsed => {
            persist_trial_used(gateway);
            return Err(
                "Trial telah digunakan pada perangkat ini sebelumnya / Trial was already used on this device"
                    .into(),
            );
        }
        TrialServerOutcome::Verified { .. } | TrialServerOutcome::Unreachable => {
            // Offline (or unexpected response): issue a local, unverified trial.
            create_trial(gateway, &device_id).await?
        }
    };

    Ok(trial_ui_details(
        &parse_rfc3339(&created.expires_at).ok_or("INVALID_TRIAL_EXPIRY")?,
        &Utc::now(),
    ))
}

#[tauri::command]
pub fn open_pricing() -> Result<(), String> {
    open::that(PRICING_URL).map_err(|e| e.to_string())
}

/// Human-readable license status label appended to the window title.
fn status_title_label(status: &LicenseStatus, details: &Option<serde_json::Value>) -> &'static str {
    let is_trial = details
        .as_ref()
        .and_then(|d| d.get("isTrial"))
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    match status {
        LicenseStatus::Valid if is_trial => "Masa Trial",
        LicenseStatus::Valid => "Lisensi Aktif",
        LicenseStatus::ExpiresSoon => "Lisensi Segera Berakhir",
        LicenseStatus::NotFound => "Belum Aktivasi",
        LicenseStatus::Invalid => "Lisensi Tidak Valid",
        LicenseStatus::Expired => "Lisensi Kedaluwarsa",
        LicenseStatus::Tampered => "Jam Sistem Salah",
        LicenseStatus::Cloned => "Perangkat Berbeda",
        LicenseStatus::TrialPending => "Persetujuan Uji Coba",
    }
}

/// Updates the main window title to `Kastoko v{version} — {status}`.
fn apply_status_title<R: Runtime>(app: &AppHandle<R>, status: &LicenseStatus, details: &Option<serde_json::Value>) {
    #[cfg(desktop)]
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_title(&format!(
            "Kastoko v{} — {}",
            env!("CARGO_PKG_VERSION"),
            status_title_label(status, details)
        ));
    }
}

#[tauri::command]
pub async fn check_license(
    app: AppHandle,
    state: tauri::State<'_, FireLiteGateway>,
) -> Result<(LicenseStatus, Option<serde_json::Value>), String> {
    let result = check_license_inner(state.inner()).await;
    if let Ok((status, details)) = &result {
        apply_status_title(&app, status, details);
    }
    result
}

async fn check_license_inner(
    gateway: &FireLiteGateway,
) -> Result<(LicenseStatus, Option<serde_json::Value>), String> {
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

    let mut validation = Validation::new(Algorithm::HS256);
    // `exp` is validated manually below so lifetime ("Selamanya") plans with no
    // `exp` claim keep working; don't require it as a spec claim either.
    validation.validate_exp = false;
    validation.required_spec_claims.clear();

    // Verify the signature so a forged/edited token in the local DB fails here
    // instead of being blindly trusted. Uses the same HS256 secret as the server.
    let secret = jwt_secret();
    let token_data = decode::<Claims>(
        &license_data.jwt,
        &DecodingKey::from_secret(&secret),
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

/// Reconciles a local trial with the server. Ran periodically by the heartbeat so
/// an offline-started trial gets confirmed (or revoked) the moment the device is
/// back online. Adopts the server's authoritative times (clamped to earliest) and
/// persists the verifier token so future boots re-verify as the same install.
async fn reconcile_trial(gateway: &FireLiteGateway) {
    let device_id = hwid::get_license_hwid();

    let trial = match get_trial_db(gateway) {
        Some(t) => t,
        None => return,
    };

    let verifier = trial.verification_token.as_deref();
    let outcome = trial_server_verify(&device_id, verifier).await;

    match outcome {
        TrialServerOutcome::Granted {
            activated_at,
            expires_at,
            token,
        } => {
            // Client started offline, server had never seen this device before:
            // persist the fresh grant with its verifier token.
            let act_str = activated_at.to_rfc3339();
            let exp_str = expires_at.to_rfc3339();
            let start =
                earliest([trial.started_at.as_str(), act_str.as_str()]).unwrap_or(activated_at);
            let expires =
                earliest([trial.expires_at.as_str(), exp_str.as_str()]).unwrap_or(expires_at);
            let updated = TrialDbData {
                started_at: start.to_rfc3339(),
                expires_at: expires.to_rfc3339(),
                last_known_time: activated_at.to_rfc3339(),
                synced_at: Some(activated_at.to_rfc3339()),
                device_id: device_id.clone(),
                server_verified: true,
                verification_token: Some(token),
            };
            let _ = save_trial_db(gateway, &updated);
            persist_trial_anchor(gateway, &updated);
        }
        TrialServerOutcome::Verified {
            activated_at,
            expires_at,
        } => {
            // Same install re-syncing: adopt authoritative times (clamp to earliest).
            let act_str = activated_at.to_rfc3339();
            let exp_str = expires_at.to_rfc3339();
            let start =
                earliest([trial.started_at.as_str(), act_str.as_str()]).unwrap_or(activated_at);
            let expires =
                earliest([trial.expires_at.as_str(), exp_str.as_str()]).unwrap_or(expires_at);
            let updated = TrialDbData {
                started_at: start.to_rfc3339(),
                expires_at: expires.to_rfc3339(),
                last_known_time: activated_at.to_rfc3339(),
                synced_at: Some(activated_at.to_rfc3339()),
                device_id: device_id.clone(),
                server_verified: true,
                verification_token: verifier.map(|s| s.to_string()),
            };
            let _ = save_trial_db(gateway, &updated);
        }
        TrialServerOutcome::AlreadyUsed => {
            // The server says this device already used its trial (legacy or wiped
            // DB). Permanently block the trial and clear the local record.
            persist_trial_used(gateway);
            let _ = gateway.db.delete("app_state", "trial");
        }
        TrialServerOutcome::Unreachable => {
            // Stay offline; try again on the next heartbeat.
        }
    }
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
                        } else if data["status"] == "revoked" {
                            // Remote kill switch: the server says this license /
                            // device is no longer active. Clear the local license
                            // so the app falls back to the trial/activation screen.
                            eprintln!("[license] heartbeat reports 'revoked' — clearing local license.");
                            let _ = gateway.db.delete("app_state", "license");
                            let _ = gateway.db.delete("app_state", "trial");
                            let _ = app.emit("license-revoked", ());
                        }
                    }
                }
            } else {
                // No active license: reconcile any trial with the server so an
                // offline-started trial is confirmed (or revoked) when online.
                reconcile_trial(&gateway).await;
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

/// Migrates the legacy on-disk anchors (`trial_anchor.json`, `licensed_ever.json`)
/// into the encrypted `app_state` collection, then removes the files. Called once
/// at startup so pre-existing installs keep their trial/license history intact while
/// moving trial status out of readable plaintext files.
pub fn migrate_legacy_anchors(gateway: &FireLiteGateway, app_data_dir: &std::path::Path) {
    let trial_file = app_data_dir.join("trial_anchor.json");
    if trial_file.exists() {
        // Legacy files may carry either the old hard-coded signature or the new
        // device-bound one; accept both and re-sign below.
        let was_valid = std::fs::read_to_string(&trial_file)
            .ok()
            .and_then(|s| serde_json::from_str::<TrialAnchor>(&s).ok())
            .filter(|a| sign_anchor(a) == a.sig || legacy_sign_anchor(a) == a.sig)
            .is_some();
        if was_valid {
            if gateway.db.get("app_state", "trial_anchor").ok().flatten().is_none() {
                let mut anchor = std::fs::read_to_string(&trial_file)
                    .ok()
                    .and_then(|s| serde_json::from_str::<TrialAnchor>(&s).ok());
                if let Some(mut a) = anchor.take() {
                    if sign_anchor(&a) != a.sig {
                        a.sig = sign_anchor(&a);
                    }
                    write_anchor(gateway, &a);
                }
            }
        }
        let _ = std::fs::remove_file(&trial_file);
    }

    let ever_file = app_data_dir.join("licensed_ever.json");
    if ever_file.exists() {
        let marker = std::fs::read_to_string(&ever_file)
            .ok()
            .and_then(|s| serde_json::from_str::<LicensedEverMarker>(&s).ok());
        if let Some(m) = marker {
            if (sign_licensed_ever(&m) == m.sig || legacy_sign_licensed_ever(&m) == m.sig)
                && m.device_id == hwid::get_license_hwid()
            {
                if gateway.db.get("app_state", "licensed_ever").ok().flatten().is_none() {
                    let mut doc = FireLiteDoc::default();
                    let Ok(v) = Value::from_json(serde_json::json!(m.device_id)) else {
                        return;
                    };
                    doc.insert("device_id".to_string(), v);
                    let Ok(v) = Value::from_json(serde_json::json!(m.sig)) else {
                        return;
                    };
                    doc.insert("sig".to_string(), v);
                    let _ = gateway.db.put("app_state", "licensed_ever", &doc);
                }
            }
        }
        let _ = std::fs::remove_file(&ever_file);
    }
}
