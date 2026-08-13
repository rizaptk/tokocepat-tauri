import { Button } from "@/components/ui/button"
import { Moon, Sun } from "lucide-react"
import { useThemeStore } from "@/lib/theme-store"
import { motion, AnimatePresence } from "framer-motion"
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion"

export function ThemeToggle() {
  const { theme, toggleTheme } = useThemeStore()
  const reducedMotion = usePrefersReducedMotion()

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Ganti tema menjadi terang" : "Ganti tema menjadi gelap"}
      className="size-9 overflow-hidden relative"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={theme}
          initial={{ y: reducedMotion ? 0 : -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: reducedMotion ? 0 : 20, opacity: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.2 }}
          className="flex items-center justify-center"
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </motion.div>
      </AnimatePresence>
    </Button>
  )
}