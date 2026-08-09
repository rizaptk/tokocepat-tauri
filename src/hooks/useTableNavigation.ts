import { useEffect, useRef, useState } from "react";

type Options = {
  rowCount: number;
  enabled?: boolean;
  bindTo?: React.RefObject<HTMLElement | null>;
  onActivate?: (index: number) => void;
};

/**
 * Arrow/Enter navigation over a row-oriented table/cart.
 * Exposes the currently "focused" row index. Up/Down move the focus;
 * Enter invokes `onActivate` for the focused row.
 * When `bindTo` is given, key events are scoped to that element, otherwise global.
 */
export function useTableNavigation({ rowCount, enabled = true, bindTo, onActivate }: Options) {
  const [activeIndex, setActiveIndex] = useState(-1);
  const indexRef = useRef(activeIndex);
  indexRef.current = activeIndex;
  const cbRef = useRef(onActivate);
  cbRef.current = onActivate;

  useEffect(() => {
    if (!enabled || rowCount === 0) return;

    const handleKey = (e: Event) => {
      const ke = e as KeyboardEvent;
      if (ke.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex(prev => (prev >= rowCount - 1 ? 0 : prev + 1));
      } else if (ke.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex(prev => (prev <= 0 ? rowCount - 1 : prev - 1));
      } else if (ke.key === 'Enter' && indexRef.current >= 0) {
        cbRef.current?.(indexRef.current);
      }
    };

    const target = bindTo?.current ?? window;
    target.addEventListener('keydown', handleKey);
    return () => target.removeEventListener('keydown', handleKey);
  }, [enabled, rowCount, bindTo]);

  return { activeIndex, setActiveIndex };
}