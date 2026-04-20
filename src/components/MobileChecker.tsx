import { useIsMobile } from "@/lib/ismobile-store";
import { useEffect } from "react";

const MOBILE_BREAKPOINT = 768;

export const MobileChecker = () => {
  const setIsMobile = useIsMobile((state) => state.setIsMobile);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    
    const onChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(e.matches);
    };

    // Initial check
    onChange(mql);

    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [setIsMobile]);

  return null;
};