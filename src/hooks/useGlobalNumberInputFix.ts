import { useEffect } from "react";

export function useGlobalNumberInputFix() {
  useEffect(() => {
    const handleInput = (e: Event) => {
      const el = e.target as HTMLInputElement;

      if (!(el instanceof HTMLInputElement)) return;
      if (el.type !== "number") return;

      let value = el.value;

      // If user deletes everything
      if (value === "") {
        el.value = "0";
        el.select();
        return;
      }

      // Remove leading zeros (but keep single zero)
      const normalized = value.replace(/^0+(?=\d)/, "");

      if (normalized !== value) {
        const pos = el.selectionStart ?? normalized.length;
        el.value = normalized;
        el.setSelectionRange(pos, pos);
      }
    };

    const handleFocus = (e: Event) => {
      const el = e.target as HTMLInputElement;

      if (!(el instanceof HTMLInputElement)) return;
      if (el.type !== "number") return;

      // Select value for easy replacement
      setTimeout(() => el.select(), 0);
    };

    document.addEventListener("input", handleInput);
    document.addEventListener("focusin", handleFocus);

    return () => {
      document.removeEventListener("input", handleInput);
      document.removeEventListener("focusin", handleFocus);
    };
  }, []);
}