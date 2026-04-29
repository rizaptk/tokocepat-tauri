#[tauri::command]
pub fn set_theme(window: tauri::Window, theme: String) -> Result<(), String> {
    let theme = match theme.to_lowercase().as_str() {
        "dark" => tauri::Theme::Dark,
        "light" => tauri::Theme::Light,
        _ => return Err("Invalid theme".into()),
    };

    window.set_theme(Some(theme)).map_err(|e| e.to_string())
}
