
"use client";

import { Search, Barcode, Grid, List, Rows, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { ViewMode } from "@/app/cashier/page";

interface ProductSearchBarProps {
    searchTerm: string;
    onSearchTermChange: (term: string) => void;
    viewMode?: ViewMode;
    onViewModeChange?: (mode: ViewMode) => void;
}

export function ProductSearchBar({ searchTerm, onSearchTermChange, viewMode, onViewModeChange }: ProductSearchBarProps) {
    return (
        <div className="flex items-center gap-2">
            <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    type="search"
                    placeholder="Search products..."
                    className="w-full pl-8"
                    value={searchTerm}
                    onChange={(e) => onSearchTermChange(e.target.value)}
                />
            </div>
            <Dialog>
                <DialogTrigger asChild>
                    <Button variant="outline" size="icon" className="shrink-0">
                        <Barcode className="h-5 w-5" />
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Barcode Scanner</DialogTitle>
                        <DialogDescription>
                            This feature is for demonstration purposes. In a real app, this would open the device's camera to scan product barcodes.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col items-center justify-center gap-4 py-8">
                        <Barcode className="h-24 w-24 text-muted-foreground" />
                        <p className="text-muted-foreground">Ready to scan</p>
                    </div>
                </DialogContent>
            </Dialog>
            {viewMode && onViewModeChange && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon" className="shrink-0">
                           <SlidersHorizontal className="h-5 w-5" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <DropdownMenuRadioGroup value={viewMode} onValueChange={(value) => onViewModeChange(value as ViewMode)}>
                            <DropdownMenuRadioItem value="card">
                                <Grid className="mr-2" /> Card View
                            </DropdownMenuRadioItem>
                             <DropdownMenuRadioItem value="thumbnail">
                                <Rows className="mr-2" /> Thumbnail View
                            </DropdownMenuRadioItem>
                             <DropdownMenuRadioItem value="list">
                                <List className="mr-2" /> List View
                            </DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                </DropdownMenu>
            )}
        </div>
    )
}
