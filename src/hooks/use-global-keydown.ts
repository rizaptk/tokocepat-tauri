'use client'

import { useEffect, type RefObject } from 'react';

interface Props {
    key: string;
    handler: () => void;
    enabled?: boolean;
    bindTo?: RefObject<HTMLElement | null>;
}

export function useGlobalKeydown({ key, handler, enabled = true, bindTo }: Props) {
    useEffect(() => {
        if (!enabled) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            // Check if the keydown is bound to a specific element and if it's visible on top.
            if (bindTo?.current) {
                const boundEl = bindTo.current;
                const rect = boundEl.getBoundingClientRect();
                
                // If the element is not in the viewport, don't trigger.
                if (rect.width === 0 || rect.height === 0 || rect.bottom < 0 || rect.right < 0 || rect.top > window.innerHeight || rect.left > window.innerWidth) {
                    return;
                }

                // Check if the element is the topmost element at its center.
                // This prevents firing if a modal is on top.
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                const topElement = document.elementFromPoint(centerX, centerY);

                if (!topElement || !boundEl.contains(topElement)) {
                    return;
                }
            }
            
            // Don't trigger if user is typing in an input or textarea, unless it's explicitly allowed.
            // Function keys (F1-F12) never produce characters, so they are always safe to let through.
            const target = event.target as HTMLElement;
            const isFunctionKey = /^F([1-9]|1[0-2])$/.test(event.code);
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                const enableGlobal = target.attributes.getNamedItem('enable-global-keydown')?.value === 'true';
                if (!enableGlobal && !isFunctionKey) return;
            }

            if (event.code.toLowerCase() === key.toLowerCase()) {
                // Prevent default browser actions for keys like Space, Enter, or arrows.
                event.preventDefault();
                handler();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [key, handler, enabled, bindTo]);
}
