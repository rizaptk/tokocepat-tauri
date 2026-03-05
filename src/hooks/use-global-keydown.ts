'use client'

import { useEffect } from 'react';

interface Props {
    key: string;
    handler: () => void;
    enabled?: boolean;
}

export function useGlobalKeydown({ key, handler, enabled = true }: Props) {
    useEffect(() => {
        if (!enabled) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            // Don't trigger if user is typing in an input or textarea
            const target = event.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                const enableglobal = target.attributes.getNamedItem('enable-global-keydown')?.value === 'true';
                if (!enableglobal) return;
            }

            if (event.code.toLowerCase() === key.toLowerCase()) {
                handler();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [key, handler, enabled]);
}