use serde::{Deserialize, Serialize};
use crate::hwid;
use firelite::tauri_gateway::FireLiteGateway; 
use firelite::document::firelite_doc::FireLiteDoc;
use firelite::document::value::Value;
// Fixed: Use standard decode components
use jsonwebtoken::{decode, DecodingKey, Validation, Algorithm}; 
use chrono::{Utc, DateTime};
use std::time::Duration;
use std::sync::Arc;
use tauri::{AppHandle, Manager, Runtime, Emitter};

use std::env;

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
struct Claims {
    sub: String,            
    plan: String,           
    #[serde(rename = "deviceId")]
    device_id: Option<String>,
    #[serde(rename = "isTrial")]
    is_trial: bool,
    exp: usize,  
}

const EXPIRY_WARNING_DAYS: i64 = 7;

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

fn local_json_value_to_value(v: &serde_json::Value) -> Result<Value, String> {
    match v {
        serde_json::Value::Null => Ok(Value::Null),
        serde_json::Value::Bool(b) => Ok(Value::Bool(*b)),
        serde_json::Value::Number(n) => {
            if let Some(i) = n.as_i64() { Ok(Value::Int(i)) }
            else { Ok(Value::Float(n.as_f64().unwrap_or(0.0))) }
        }
        serde_json::Value::String(s) => Ok(Value::String(s.clone())),
        serde_json::Value::Array(arr) => {
            let mut values = Vec::new();
            for val in arr { values.push(local_json_value_to_value(val)?); }
            Ok(Value::Array(values))
        }
        serde_json::Value::Object(obj) => {
            // --- ADDED: Reference Detection ---
            if let Some(serde_json::Value::String(path)) = obj.get("__ref__") {
                if let Some((col, id)) = path.split_once('/') {
                    return Ok(Value::Reference {
                        collection: col.to_string(),
                        doc_id: id.to_string(),
                    });
                }
            }

            // --- ADDED: BlobLink Detection ---
            if let Some(serde_json::Value::Object(meta)) = obj.get("__blob__") {
                let offset = meta.get("offset").and_then(|o| o.as_u64()).unwrap_or(0);
                let len = meta.get("len").and_then(|l| l.as_u64()).unwrap_or(0) as u32;
                return Ok(Value::BlobLink { offset, len });
            }

            let mut map = Vec::new();
            for (k, v) in obj {
                map.push((Arc::from(k.as_str()), local_json_value_to_value(v)?));
            }
            Ok(Value::Map(map))
        }
    }
}

fn local_value_to_json(v: &Value) -> serde_json::Value {
    match v {
        Value::Null | Value::ServerTimestamp => serde_json::Value::Null,
        Value::Bool(b) => serde_json::Value::Bool(*b),
        Value::Int(i) => serde_json::Value::Number((*i).into()),
        Value::Float(f) => serde_json::Number::from_f64(*f).map(serde_json::Value::Number).unwrap_or(serde_json::Value::Null),
        Value::String(s) => serde_json::Value::String(s.clone()),
        Value::Binary(bytes) => serde_json::Value::Array(bytes.iter().map(|b| serde_json::Value::Number((*b as u64).into())).collect()),
        Value::Timestamp(micros) => serde_json::Value::Number((*micros).into()),
        
        // NEW: BlobLink arm
        Value::BlobLink { offset, len } => {
            let mut map = serde_json::Map::new();
            let mut meta = serde_json::Map::new();
            meta.insert("offset".to_string(), (*offset).into());
            meta.insert("len".to_string(), (*len).into());
            map.insert("__blob__".to_string(), serde_json::Value::Object(meta));
            serde_json::Value::Object(map)
        }

        Value::Reference { collection, doc_id } => {
            let mut map = serde_json::Map::new();
            map.insert("__ref__".to_string(), serde_json::Value::String(format!("{collection}/{doc_id}")));
            serde_json::Value::Object(map)
        }
        Value::Map(fields) => {
            let mut map = serde_json::Map::new();
            for (k, v) in fields {
                map.insert(k.to_string(), local_value_to_json(v));
            }
            serde_json::Value::Object(map)
        }
        Value::Array(values) => serde_json::Value::Array(values.iter().map(local_value_to_json).collect()),
    }
}

// --- CORE LOGIC ---

pub fn get_license_db(gateway: &FireLiteGateway) -> Option<LicenseDbData> {
    match gateway.db.get("app_state", "license") {
        Ok(Some(doc)) => {
            let mut map = serde_json::Map::new();
            for (k, v) in &doc.fields {
                map.insert(k.to_string(), local_value_to_json(v));
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
        doc.insert(k.clone(), local_json_value_to_value(v)?);
    }
    
    gateway.db.put("app_state", "license", &doc).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn check_license(
    state: tauri::State<'_, FireLiteGateway>
) -> Result<(LicenseStatus, Option<serde_json::Value>), String> {
    let gateway = state.inner();
    
    let license_data = match get_license_db(gateway) {
        Some(data) => data,
        None => return Ok((LicenseStatus::NotFound, None)),
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

    // This now captures 'plan', 'isTrial', etc.
    let token_data = decode::<Claims>(
        &license_data.jwt,
        &DecodingKey::from_secret(&[]),
        &validation
    ).map_err(|e| format!("INVALID_TOKEN: {}", e))?;

    let expiry_date = DateTime::from_timestamp(token_data.claims.exp as i64, 0)
        .ok_or("INVALID_EXPIRY")?;

    let now = Utc::now();
    
    // Use .num_days() for full days, but if it's less than 24h, 
    // it returns 0. For the UI, we might want to show at least 1 
    // if it's not expired yet, or 0 if it expires today.
    let days_remaining = (expiry_date - now).num_days();

    // Prepare response
    let mut ui_details = serde_json::to_value(&token_data.claims).unwrap();
    if let Some(obj) = ui_details.as_object_mut() {
        obj.insert("expiresAt".to_string(), serde_json::json!(expiry_date.to_rfc3339()));
        obj.insert("daysRemaining".to_string(), serde_json::json!(days_remaining));
        obj.insert("deviceId".to_string(), serde_json::json!(license_data.device_id));
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

    Ok((status, Some(ui_details)))
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

                let res = client.post(url)
                    .json(&body)
                    .send()
                    .await;

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
pub async fn activate_trial(
    state: tauri::State<'_, FireLiteGateway>,
    plan_id: String,
) -> Result<String, String> {
    let gateway = state.inner();
    let device_id = hwid::get_license_hwid();
    let client = reqwest::Client::new();

    let url = get_api_url("/api/license/activate-trial");
    // 1. Call your API from Rust
    let res = client
        .post(url)
        .json(&serde_json::json!({ "planId": plan_id, "deviceId": device_id }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        let err_body: serde_json::Value = res.json().await.map_err(|_| "API Error")?;
        return Err(err_body["error"].as_str().unwrap_or("Activation failed").to_string());
    }

    let result: serde_json::Value = res.json().await.map_err(|_| "Invalid JSON response")?;
    let token = result["token"].as_str().ok_or("Token missing in response")?;

    // 2. Save directly to DB using the Rust helper we wrote earlier
    save_license_db(gateway, LicenseDbData {
        jwt: token.to_string(),
        last_known_time: Utc::now().to_rfc3339(),
        device_id: device_id.clone(),
    })?;

    Ok("Trial activated".to_string())
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
        return Err(err_body["error"].as_str().unwrap_or("Claim failed").to_string());
    }

    let result: serde_json::Value = res.json().await.map_err(|_| "Invalid JSON response")?;
    let token = result["token"].as_str().ok_or("Token missing in response")?;

    // 2. Save to DB
    save_license_db(gateway, LicenseDbData {
        jwt: token.to_string(),
        last_known_time: Utc::now().to_rfc3339(),
        device_id: device_id.clone(),
    })?;

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
        return Err(err_body["error"].as_str().unwrap_or("Activation failed").to_string());
    }

    let result: serde_json::Value = res.json().await.map_err(|_| "Invalid response")?;
    let token = result["token"].as_str().ok_or("Token missing")?;

    save_license_db(gateway, LicenseDbData {
        jwt: token.to_string(),
        last_known_time: Utc::now().to_rfc3339(),
        device_id,
    })?;

    Ok("Activated".to_string())
}

#[tauri::command]
pub async fn deactivate_license(
    state: tauri::State<'_, FireLiteGateway>
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
        return Err(err_body["error"].as_str().unwrap_or("Deactivation failed").to_string());
    }

    // 3. Delete from FireLite
    gateway.db.delete("app_state", "license").map_err(|e| e.to_string())?;

    Ok("Deactivated".to_string())
}