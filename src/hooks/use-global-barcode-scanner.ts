import { useEffect, useRef, useCallback } from 'react';

const SCAN_TIMEOUT_MS = 100; // Time between keystrokes to be considered part of the same scan
const MIN_BARCODE_LENGTH = 3; // Minimum length to be considered a valid barcode scan

interface UseGlobalBarcodeScannerProps {
    onScan: (barcode: string) => void;
    enabled?: boolean;
}

export function useGlobalBarcodeScanner({ onScan, enabled = true }: UseGlobalBarcodeScannerProps) {
    const bufferRef = useRef<string>('');
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (!enabled) return;

        // Don't interfere with form inputs, textareas, etc.
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
            return;
        }
        
        // Let user type normally in dropdown menus etc.
        if (e.key.length > 1 && e.key !== 'Enter') {
            return;
        }

        // If it's the end of a scan
        if (e.key === 'Enter') {
            if (bufferRef.current.length >= MIN_BARCODE_LENGTH) {
                // Prevent default form submission if any
                e.preventDefault();
                onScan(bufferRef.current);
            }
            bufferRef.current = ''; // Reset buffer
            return;
        }

        // Append character to buffer
        bufferRef.current += e.key;
        
        // Reset timeout
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        // Set a timeout to clear the buffer if no new keystroke comes in time
        timeoutRef.current = setTimeout(() => {
            bufferRef.current = '';
        }, SCAN_TIMEOUT_MS);

    }, [onScan, enabled]);

    useEffect(() => {
        if (enabled) {
            window.addEventListener('keydown', handleKeyDown);
        }

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [handleKeyDown, enabled]);
}
