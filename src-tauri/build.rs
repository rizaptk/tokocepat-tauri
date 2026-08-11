fn main() {
    tauri_build::build();

    // Bake the license JWT secret into the binary at compile time so packaged
    // (release) builds can verify server-issued tokens without relying on a
    // runtime .env file. Uses the same value the server signs with (server env
    // `JWT_SECRET_KEY` == client `VITE_JWT_SECRET`). Prefers the process
    // environment, then falls back to the project root .env.
    let secret = std::env::var("VITE_JWT_SECRET")
        .ok()
        .filter(|s| !s.is_empty())
        .or_else(|| {
            let root_env = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
                .parent()
                .unwrap_or_else(|| std::path::Path::new("."))
                .join(".env");
            std::fs::read_to_string(root_env).ok().and_then(|content| {
                content.lines().find_map(|line| {
                    let line = line.trim();
                    line.strip_prefix("VITE_JWT_SECRET=")
                        .map(|v| v.trim().trim_matches('"').to_string())
                })
            })
        })
        .filter(|s| !s.is_empty());

    if let Some(s) = secret {
        println!("cargo:rustc-env=VITE_JWT_SECRET={s}");
        println!("cargo:rerun-if-env-changed=VITE_JWT_SECRET");
    }
    println!("cargo:rerun-if-changed=.env");
}
