import React, { useDeferredValue, useEffect, useState } from 'react';
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useProductSearch } from '@/lib/useProductSearch';
import { useActiveProduct } from '@/lib/product-active-store';

interface ProductSearchBarProps {
    onBarcodeScan?: (barcode: string) => void;
    /** Called when ArrowDown/ArrowUp is pressed so the parent can jump focus into its list/table. */
    onArrowNav?: (direction: 'down' | 'up') => void;
}

export const ProductSearchBar = React.memo(({ onBarcodeScan, onArrowNav }: ProductSearchBarProps) => {
    const [localValue, setLocalValue] = useState('');
    const [lastInputTime, setLastInputTime] = useState(0);
    const { clearActive } = useActiveProduct();
    const execQuery = useProductSearch(q => q.setQuery);
    const deferredValue = useDeferredValue(localValue.trim(), '');

    useEffect(() => {
        execQuery(deferredValue);
    }, [deferredValue, execQuery]);

    const handleScanSuccess = (barcode: string) => {
        if (onBarcodeScan) {
            onBarcodeScan(barcode);
            setLocalValue('');
            execQuery('');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            if (onArrowNav) {
                e.preventDefault();
                onArrowNav(e.key === 'ArrowDown' ? 'down' : 'up');
            }
            return;
        }
        if (e.key === 'Enter' && localValue.trim() && onBarcodeScan) {
            const now = Date.now();
            const timeDiff = now - lastInputTime;

            // Barcode scanners typically input characters very rapidly (usually < 50ms between keys)
            // and terminate with Enter. If the last key was very recent, it's likely a scanner.
            if (timeDiff < 100 || localValue.length > 5) {
                e.preventDefault();
                handleScanSuccess(localValue.trim());
            }
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setLastInputTime(Date.now());
        setLocalValue(e.target.value);
        // User is typing, so clear any keyboard-based navigation selection
        clearActive();
    };

    return (
        <div className="flex items-center gap-2 w-full">
            <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground/50" />
                <Input
                    type="search"
                    placeholder="Cari produk, scan barcode, lalu Enter..."
                    className="w-full pl-9 bg-card h-8 text-sm"
                    value={localValue}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    size="sm"
                    enable-global-keydown="true"
                    onBlur={() => clearActive()}
                />
            </div>
        </div>
    )
})