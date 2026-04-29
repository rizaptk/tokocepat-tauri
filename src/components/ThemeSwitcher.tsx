import { useEffect } from "react"
import { useThemeStore } from "@/lib/theme-store"
import { invoke } from "@tauri-apps/api/core"
// Force dark mode

export async function setTheme(theme: "dark" | "light") {
  await invoke("set_theme", { theme });
}

export function ThemeSwitcher() {
  const theme = useThemeStore((state) => state.theme)

  useEffect(() => {
    const root = document.documentElement
    if (theme === "dark") {
      root.classList.add("dark");
      setTheme("dark");
    } else {
      root.classList.remove("dark");
      setTheme("light");
    }
  }, [theme])

  return null;

}