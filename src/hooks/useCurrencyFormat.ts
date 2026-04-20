import { useState, useMemo } from "react";

export const useCurrencyFormat = () => {
  const [raw, setRaw] = useState<string>("0");

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    let val = e.target.value.replace(/[^\d]/g, "");

    // prevent leading zero explosion
    val = val.replace(/^0+/, "");

    setRaw(val);
  }

  const display = useMemo(() => {
    if (!raw) return "0";

    // safer than Number() for large values
    const num = parseInt(raw, 10);

    if (isNaN(num)) return "";

    return new Intl.NumberFormat("id-ID").format(num);
  }, [raw]);

  return {
    value: display,
    raw,
    setRaw,
    onChange: handleChange,
  };
};