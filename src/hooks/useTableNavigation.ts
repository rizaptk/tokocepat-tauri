import { useEffect, useRef, useState } from "react";

type Options = {
  rowCount: number;
  columnCount?: number;
  enabled?: boolean;
  bindTo?: React.RefObject<HTMLElement | null>;
  onActivate?: (index: number, column: number) => void;
};

/**
 * Arrow/Enter navigation over a cell-oriented table/cart.
 * Exposes the currently "focused" row/column index. Up/Down move the row,
 * Left/Right move the column, and Enter invokes `onActivate` for the focused cell.
 * When `bindTo` is given, key events are scoped to that element, otherwise global.
 */
export function useTableNavigation({ rowCount, columnCount = 1, enabled = true, bindTo, onActivate }: Options) {
  const [activeIndex, setActiveIndex] = useState(-1);
  const [activeColumn, setActiveColumn] = useState(-1);
  const indexRef = useRef(activeIndex);
  indexRef.current = activeIndex;
  const columnRef = useRef(activeColumn);
  columnRef.current = activeColumn;
  const cbRef = useRef(onActivate);
  cbRef.current = onActivate;

  useEffect(() => {
    if (!enabled || rowCount === 0) return;

    const handleKey = (e: Event) => {
      const ke = e as KeyboardEvent;
      const target = e.target as HTMLElement | null;
      const isTyping = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if (ke.key === 'ArrowDown' && !isTyping) {
        e.preventDefault();
        setActiveIndex(prev => {
          const next = prev >= rowCount - 1 ? 0 : prev + 1;
          if (columnRef.current < 0) setActiveColumn(0);
          return next;
        });
      } else if (ke.key === 'ArrowUp' && !isTyping) {
        e.preventDefault();
        setActiveIndex(prev => {
          const next = prev <= 0 ? rowCount - 1 : prev - 1;
          if (columnRef.current < 0) setActiveColumn(0);
          return next;
        });
      } else if (columnCount > 1 && ke.key === 'ArrowRight' && !isTyping) {
        e.preventDefault();
        if (indexRef.current < 0) setActiveIndex(0);
        setActiveColumn(prev => (prev >= columnCount - 1 ? 0 : prev + 1));
      } else if (columnCount > 1 && ke.key === 'ArrowLeft' && !isTyping) {
        e.preventDefault();
        if (indexRef.current < 0) setActiveIndex(0);
        setActiveColumn(prev => (prev <= 0 ? columnCount - 1 : prev - 1));
      } else if (ke.key === 'Enter' && indexRef.current >= 0 && !isTyping) {
        e.preventDefault();
        cbRef.current?.(indexRef.current, columnRef.current);
      }
    };

    const target = bindTo?.current ?? window;
    target.addEventListener('keydown', handleKey);
    return () => target.removeEventListener('keydown', handleKey);
  }, [enabled, rowCount, columnCount, bindTo]);

  return { activeIndex, setActiveIndex, activeColumn, setActiveColumn };
}