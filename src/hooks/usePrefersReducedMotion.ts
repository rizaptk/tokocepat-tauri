import { useSyncExternalStore } from 'react';

const subscribe = (onStoreChange: () => void) => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    mql.addEventListener('change', onStoreChange);
    return () => mql.removeEventListener('change', onStoreChange);
};

const getSnapshot = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * True when the user prefers reduced motion. Components use it to collapse
 * springs and layout animation to instant state changes instead of killing
 * all feedback (the tape still settles, rows still appear).
 */
export const usePrefersReducedMotion = () => useSyncExternalStore(subscribe, getSnapshot, getSnapshot);