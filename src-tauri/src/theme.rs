#[tauri::command]
pub fn set_theme(window: tauri::Window, _theme: String) -> Result<(), String> {
    #[cfg(desktop)] 
    {
        let theme = match _theme.to_lowercase().as_str() {
            "dark" => tauri::Theme::Dark,
            "light" => tauri::Theme::Light,
            _ => return Err("Invalid theme".into()),
        };
    
        return window.set_theme(Some(theme)).map_err(|e| e.to_string())
    }
    
    #[cfg(mobile)] 
    Ok(())
}
