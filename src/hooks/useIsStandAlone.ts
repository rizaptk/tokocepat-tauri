import { useState, useEffect } from 'react';

export const useIsStandalone = () => {
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const checkStandalone = () => {
      // 1. Check media query (Standard for Chrome/Android/Windows)
      const isDisplayStandalone = window.matchMedia('(display-mode: standalone)').matches;
      
      // 2. Check navigator (iOS Safari specific)
      const isIOSStandalone = (window.navigator as any).standalone === true;

      setIsStandalone(isDisplayStandalone || isIOSStandalone);
    };

    checkStandalone();

    // Listen for changes (e.g., if the user launches it while already open)
    const matcher = window.matchMedia('(display-mode: standalone)');
    const listener = (e: MediaQueryListEvent) => setIsStandalone(e.matches);
    
    matcher.addEventListener('change', listener);
    return () => matcher.removeEventListener('change', listener);
  }, []);

  return isStandalone;
};