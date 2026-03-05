
"use client";

import React, { useDeferredValue, useEffect, useState } from 'react';
import { Search, Barcode, SlidersHorizontal, Image, StretchHorizontal, Equal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { ViewMode } from "@/app/cashier/page";
import { BarcodeScanner } from './BarcodeScanner';
import { useProductSearch } from '@/lib/useProductSearch';

interface ProductSearchBarProps {
    viewMode?: ViewMode;
    onViewModeChange?: (mode: ViewMode) => void;
    onBarcodeScan?: (barcode: string) => void;
}

export const ProductSearchBar = React.memo(({ viewMode, onViewModeChange, onBarcodeScan }: ProductSearchBarProps) => {
    const [isScannerOpen, setIsScannerOpen] = useState(false);

    const [localValue, setLocalValue] = useState('');

    const execQuery = useProductSearch(q => q.setQuery);

    const deferredValue = useDeferredValue(localValue.trim(), '');

    // Only notify parent if value truly changed
    useEffect(() => {
        execQuery(deferredValue);
    }, [deferredValue]);

    const handleScanSuccess = (barcode: string) => {
        if (onBarcodeScan) {
            onBarcodeScan(barcode);
            setLocalValue('');
            execQuery('');
        }
        setIsScannerOpen(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && localValue.trim() && onBarcodeScan) {
            e.preventDefault();
            handleScanSuccess(localValue.trim());
        }
    };

    return (
        <div className="flex items-center gap-2 w-full">
            <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-5 w-5 text-muted-foreground/50" />
                <Input
                    type="search"
                    placeholder="Search products or scan barcode..."
                    className="w-full px-10 bg-card"
                    value={localValue}
                    onChange={(e) => setLocalValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    size="base"
                    shape="full"
                    enable-global-keydown="true"
                />
                {onBarcodeScan && (
                    <Dialog open={isScannerOpen} onOpenChange={setIsScannerOpen}>
                        <DialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="shrink-0 absolute right-0.5 h-9 w-12 top-0.5 bottom-0.5 rounded-full [&_svg]:text-muted-foreground [&_svg]:size-5">
                                <Barcode className="size-6" />
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Barcode Scanner</DialogTitle>
                            </DialogHeader>
                            <BarcodeScanner onScanSuccess={handleScanSuccess} />
                        </DialogContent>
                    </Dialog>
                )}
            </div>
            
            {viewMode && onViewModeChange && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="secondary" size="icon" className="shrink-0 rounded-full">
                           <SlidersHorizontal className="h-5 w-5" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <DropdownMenuRadioGroup value={viewMode} onValueChange={(value) => onViewModeChange(value as ViewMode)}>
                            <DropdownMenuRadioItem value="card" className='py-2'>
                                <Image className="mr-2 size-4 text-emerald-500" /> Card View
                            </DropdownMenuRadioItem>
                             <DropdownMenuRadioItem value="thumbnail" className='py-2'>
                                <StretchHorizontal className="mr-2 size-4 text-rose-500" /> Thumbnail View
                            </DropdownMenuRadioItem>
                             <DropdownMenuRadioItem value="list" className='py-2'>
                                <Equal className="mr-2 size-4 text-purple-500" /> List View
                            </DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                </DropdownMenu>
            )}
        </div>
    )
})
