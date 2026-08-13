import React, { useDeferredValue, useEffect, useState } from 'react';
import { Search, SlidersHorizontal, Image, StretchHorizontal, Equal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { ViewMode } from "@/pages/DefaultCashierPage";
import { useProductSearch } from '@/lib/useProductSearch';
import { useActiveProduct } from '@/lib/product-active-store';

interface ProductSearchBarProps {
    viewMode?: ViewMode;
    onViewModeChange?: (mode: ViewMode) => void;
    onBarcodeScan?: (barcode: string) => void;
    /** Called when ArrowDown/ArrowUp is pressed so the parent can jump focus into its list/table. */
    onArrowNav?: (direction: 'down' | 'up') => void;
}

export const ProductSearchBar = React.memo(({ viewMode, onViewModeChange, onBarcodeScan, onArrowNav }: ProductSearchBarProps) => {
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

            {viewMode && onViewModeChange && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="secondary" size="icon" className="shrink-0 h-8 w-8" aria-label="Ubah tampilan pencarian">
                           <SlidersHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <DropdownMenuRadioGroup value={viewMode} onValueChange={(value) => onViewModeChange(value as ViewMode)}>
                            <DropdownMenuRadioItem value="card" className='py-2'>
                                <Image className="mr-2 size-4 text-emerald-500" /> Kartu
                            </DropdownMenuRadioItem>
                             <DropdownMenuRadioItem value="thumbnail" className='py-2'>
                                <StretchHorizontal className="mr-2 size-4 text-rose-500" /> List
                            </DropdownMenuRadioItem>
                             <DropdownMenuRadioItem value="list" className='py-2'>
                                <Equal className="mr-2 size-4 text-purple-500" /> Tabel
                            </DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                </DropdownMenu>
            )}
        </div>
    )
})