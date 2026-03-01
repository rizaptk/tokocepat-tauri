
"use client";

import { useState } from 'react';
import { Search, Barcode, Grid, List, Rows, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { ViewMode } from "@/app/cashier/page";
import { BarcodeScanner } from './BarcodeScanner';

interface ProductSearchBarProps {
    searchTerm: string;
    onSearchTermChange: (term: string) => void;
    viewMode?: ViewMode;
    onViewModeChange?: (mode: ViewMode) => void;
    onBarcodeScan?: (barcode: string) => void;
}

export function ProductSearchBar({ searchTerm, onSearchTermChange, viewMode, onViewModeChange, onBarcodeScan }: ProductSearchBarProps) {
    const [isScannerOpen, setIsScannerOpen] = useState(false);

    const handleScanSuccess = (barcode: string) => {
        if (onBarcodeScan) {
            onBarcodeScan(barcode);
            onSearchTermChange('');
        }
        setIsScannerOpen(false);
    }
    
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && searchTerm.trim() && onBarcodeScan) {
            e.preventDefault(); // Prevent any default form submission
            handleScanSuccess(searchTerm.trim());
        }
    };

    return (
        <div className="flex items-center gap-2 w-full">
            <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-5 w-5 text-muted-foreground/50" />
                <Input
                    type="search"
                    placeholder="Search products or scan barcode..."
                    className="w-full px-10"
                    value={searchTerm}
                    onChange={(e) => onSearchTermChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    shape="full"
                />
                {onBarcodeScan && (
                    <Dialog open={isScannerOpen} onOpenChange={setIsScannerOpen}>
                        <DialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="shrink-0 size-9 absolute right-2 top-0.5 rounded-full [&_svg]:text-muted-foreground">
                                <Barcode className="size-5" />
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
                        <Button variant="outline" size="icon" className="shrink-0 rounded-full [&_svg]:text-muted-foreground">
                           <SlidersHorizontal className="h-5 w-5" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <DropdownMenuRadioGroup value={viewMode} onValueChange={(value) => onViewModeChange(value as ViewMode)}>
                            <DropdownMenuRadioItem value="card" className='py-2'>
                                <Grid className="mr-2 size-4" /> Card View
                            </DropdownMenuRadioItem>
                             <DropdownMenuRadioItem value="thumbnail" className='py-2'>
                                <Rows className="mr-2 size-4" /> Thumbnail View
                            </DropdownMenuRadioItem>
                             <DropdownMenuRadioItem value="list" className='py-2'>
                                <List className="mr-2 size-4" /> List View
                            </DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                </DropdownMenu>
            )}
        </div>
    )
}
