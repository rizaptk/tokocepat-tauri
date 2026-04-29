use std::sync::OnceLock;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

// 1. Import Command for all desktop platforms
#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
use std::process::Command;

// 1. Create a global static cache
static HWID_CACHE: OnceLock<String> = OnceLock::new();

#[tauri::command]
pub fn get_license_hwid() -> String {
    // 2. Try to get from cache, or initialize it if empty
    HWID_CACHE
        .get_or_init(|| get_id().unwrap_or_else(|| "unknown_device".to_string()))
        .clone()
}

#[cfg(target_os = "windows")]
fn get_id() -> Option<String> {
    // 2. Define the flag for CREATE_NO_WINDOW (0x08000000)
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    // Gets the unique BIOS/Motherboard UUID
    let output = Command::new("wmic")
        .args(["csproduct", "get", "uuid"])
        // 3. Apply the flag here
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .ok()?;

    let result = String::from_utf8_lossy(&output.stdout);
    let id = result.lines().nth(1)?.trim().to_string();
    Some(id)
}

#[cfg(target_os = "macos")]
fn get_id() -> Option<String> {
    // Gets the IOPlatformUUID
    let output = Command::new("sh")
        .args([
            "-c",
            "ioreg -rd1 -c IOPlatformExpertDevice | grep IOPlatformUUID",
        ])
        .output()
        .ok()?;

    let result = String::from_utf8_lossy(&output.stdout);
    // Extracts the UUID from the string "IOPlatformUUID" = "XXXX-XXXX..."
    result.split('"').nth(3).map(|s| s.to_string())
}

#[cfg(target_os = "linux")]
fn get_id() -> Option<String> {
    // Standard Linux machine-id
    std::fs::read_to_string("/etc/machine-id")
        .map(|s| s.trim().to_string())
        .or_else(|_| std::fs::read_to_string("/var/lib/dbus/machine-id"))
        .ok()
}

// --- ANDROID: Using JNI (Settings.Secure.ANDROID_ID) ---
#[cfg(target_os = "android")]
fn get_id() -> Option<String> {
    use jni::objects::{JObject, JString};

    // 1. Get the Android Context from ndk_context
    let ctx = ndk_context::android_context();
    let vm = unsafe { jni::JavaVM::from_raw(ctx.vm().cast()) }.ok()?;
    let mut env = vm.attach_current_thread().ok()?;

    // 2. Find the Settings.Secure class
    let settings_secure = env.find_class("android/provider/Settings$Secure").ok()?;

    // 3. Get ContentResolver: context.getContentResolver()
    let content_resolver = env
        .call_method(
            unsafe { JObject::from_raw(ctx.context().cast()) },
            "getContentResolver",
            "()Landroid/content/ContentResolver;",
            &[],
        )
        .ok()?
        .l()
        .ok()?;

    let id_param = env.new_string("android_id").ok()?;

    // 4. Call Settings.Secure.getString(resolver, "android_id")
    let id_jstring = env
        .call_static_method(
            settings_secure,
            "getString",
            "(Landroid/content/ContentResolver;Ljava/lang/String;)Ljava/lang/String;",
            &[(&content_resolver).into(), (&id_param).into()],
        )
        .ok()?
        .l()
        .ok()?;

    // 5. Convert Java String to Rust String
    let id: String = env.get_string(&JString::from(id_jstring)).ok()?.into();
    Some(id)
}
