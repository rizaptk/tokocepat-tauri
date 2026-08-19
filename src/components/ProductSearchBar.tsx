import React, { useCallback, useDeferredValue, useEffect, useImperativeHandle, useState } from 'react';
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useProductSearch } from '@/lib/useProductSearch';
import { useActiveProduct } from '@/lib/product-active-store';

interface ProductSearchBarProps {
    onBarcodeScan?: (barcode: string) => void;
    /** Called when ArrowDown/ArrowUp is pressed so the parent can jump focus into its list/table. */
    onArrowNav?: (direction: 'down' | 'up') => void;
    /** When true, scans/Enter append terms separated by commas instead of clearing; used by worksheet multi-search. */
    multiSearch?: boolean;
    placeholder?: string;
}

export interface ProductSearchBarHandle {
    /** Appends a term (e.g. a barcode from the global scanner) to the multi-search list. */
    appendTerm: (term: string) => void;
    /** Clears the search bar and the stored query. */
    clear: () => void;
}

export const ProductSearchBar = React.memo(React.forwardRef<ProductSearchBarHandle, ProductSearchBarProps>(
    ({ onBarcodeScan, onArrowNav, multiSearch = false, placeholder }, ref) => {
        const [localValue, setLocalValue] = useState('');
        const [lastInputTime, setLastInputTime] = useState(0);
        const { clearActive } = useActiveProduct();
        const execQuery = useProductSearch(q => q.setQuery);
        const deferredValue = useDeferredValue(localValue.trim(), '');

        useEffect(() => {
            execQuery(deferredValue);
        }, [deferredValue, execQuery]);

        const appendTerm = useCallback((term: string) => {
            const clean = term.trim();
            if (!clean) return;
            setLocalValue(prev => {
                const base = prev.trim();
                const next = base ? `${base},${clean}` : clean;
                execQuery(next);
                return next;
            });
        }, [execQuery]);

        const clear = useCallback(() => {
            setLocalValue('');
            execQuery('');
        }, [execQuery]);

        useImperativeHandle(ref, () => ({ appendTerm, clear }), [appendTerm, clear]);

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
            if (e.key === 'Enter') {
                const term = localValue.trim();
                if (!term) return;
                if (multiSearch) {
                    // In multi mode the term is already typed/scanned into the field;
                    // just append a trailing comma so the next term starts fresh.
                    e.preventDefault();
                    const next = term.endsWith(',') ? term : `${term},`;
                    setLocalValue(next);
                    execQuery(next);
                    return;
                }
                const now = Date.now();
                const timeDiff = now - lastInputTime;

                // Barcode scanners typically input characters very rapidly (usually < 50ms between keys)
                // and terminate with Enter. If the last key was very recent, it's likely a scanner.
                if (timeDiff < 100 || localValue.length > 5) {
                    e.preventDefault();
                    handleScanSuccess(term);
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
                        placeholder={placeholder || "Cari produk, scan barcode, lalu Enter..."}
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
    }
));