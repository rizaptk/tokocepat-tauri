
'use client';

import Link from 'next/link';
import { useStore } from '@/lib/store';
import { useState, useMemo } from 'react';
import { ArrowLeft, History, FileDown, MoreVertical, PackageSearch, Filter, X } from 'lucide-react';
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { StockMovement } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';


type DateRangePreset = 'today' | 'last7' | 'last30' | 'lastMonth';

const movementTypeLabels: Record<string, { label: string, color: string }> = {
    sale: { label: 'Sale', color: 'bg-red-500/10 text-red-700' },
    restock: { label: 'Restock', color: 'bg-green-500/10 text-green-700' },
    initial_balance: { label: 'Initial', color: 'bg-blue-500/10 text-blue-700' },
    correction: { label: 'Correction', color: 'bg-yellow-500/10 text-yellow-700' },
    lost: { label: 'Lost', color: 'bg-gray-500/10 text-gray-700' },
    damaged: { label: 'Damaged', color: 'bg-purple-500/10 text-purple-700' },
};

export default function StockMovementReportPage() {
    const { stockMovements, products, rawIngredients, transactions } = useStore();
    const [range, setRange] = useState<DateRangePreset>('today');
    const [filterProductId, setFilterProductId] = useState<string | null>(null);

    const dateRange = useMemo(() => {
        const now = new Date();
        switch (range) {
            case 'today':
                return { from: startOfDay(now), to: endOfDay(now) };
            case 'last7':
                return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
            case 'last30':
                return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
            case 'lastMonth':
                const lastMonthDate = subMonths(now, 1);
                return { from: startOfMonth(lastMonthDate), to: endOfMonth(lastMonthDate) };
            default:
                return { from: startOfDay(now), to: endOfDay(now) };
        }
    }, [range]);

    const reportData: (StockMovement & { resultingStock: number })[] = useMemo(() => {
        // This is a simplified calculation. A real-world scenario would need to calculate resulting stock
        // by re-playing events, which is more complex. For this view, we'll show a placeholder.
        const filtered = stockMovements.filter(m => {
            const movementDate = new Date(m.created_at);
            const inDateRange = movementDate >= dateRange.from && movementDate <= dateRange.to;
            const productMatch = !filterProductId || m.product_id === filterProductId;
            return inDateRange && productMatch;
        });

        return filtered.map(m => ({...m, resultingStock: 0 })); // Placeholder
    }, [stockMovements, dateRange, filterProductId]);

    const allStockableItems = useMemo(() => [
        ...products.filter(p => p.track_stock), 
        ...rawIngredients
    ], [products, rawIngredients]);
    
    const selectedProductName = useMemo(() => {
        if (!filterProductId) return "All Products";
        return allStockableItems.find(p => p.id === filterProductId)?.name || "Unknown";
    }, [filterProductId, allStockableItems]);
    
    const txIdToInvoiceMap = useMemo(() =>
        new Map(transactions.map(tx => [tx.id, tx.invoice_number])),
    [transactions]);

    const getReferenceDisplay = (movement: StockMovement): string => {
        if (movement.reason) {
            return movement.reason;
        }
        if (movement.type === 'sale' && movement.reference_id) {
            const invoiceNumber = txIdToInvoiceMap.get(movement.reference_id);
            if (invoiceNumber) {
                return invoiceNumber;
            }
        }
        // For sales without a found invoice or other types without a reason.
        return 'N/A';
    };


    return (
        <div className="flex min-h-screen w-full flex-col bg-muted/40">
           <header className="sticky top-0 flex h-16 items-center gap-2 border-b bg-background px-4 md:px-6 z-10">
                <Button variant="outline" size="icon" className="shrink-0" asChild>
                    <Link href="/dashboard/reports">
                        <ArrowLeft className="h-4 w-4" />
                        <span className="sr-only">Back to Reports</span>
                    </Link>
                </Button>
                <div className="flex-1">
                    <h1 className="text-lg font-semibold flex items-center gap-2">
                        <History className="h-5 w-5" /> Stock Movement Report
                    </h1>
                </div>
                 {/* Desktop Buttons */}
                <div className="hidden md:flex items-center gap-2">
                    <Button variant={range === 'today' ? 'default' : 'outline'} size="sm" onClick={() => setRange('today')}>Today</Button>
                    <Button variant={range === 'last7' ? 'default' : 'outline'} size="sm" onClick={() => setRange('last7')}>Last 7 Days</Button>
                    <Button variant={range === 'last30' ? 'default' : 'outline'} size="sm" onClick={() => setRange('last30')}>Last 30 Days</Button>
                    <Button variant={range === 'lastMonth' ? 'default' : 'outline'} size="sm" onClick={() => setRange('lastMonth')}>Last Month</Button>
                    <Button variant="outline" size="sm" disabled>
                        <FileDown className="mr-2 h-4 w-4" />
                        <span>Export</span>
                    </Button>
                </div>
                 {/* Mobile Dropdown */}
                <div className="md:hidden">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Date Range</DropdownMenuLabel>
                            <DropdownMenuRadioGroup value={range} onValueChange={(value) => setRange(value as DateRangePreset)}>
                                <DropdownMenuRadioItem value="today">Today</DropdownMenuRadioItem>
                                <DropdownMenuRadioItem value="last7">Last 7 Days</DropdownMenuRadioItem>
                                <DropdownMenuRadioItem value="last30">Last 30 Days</DropdownMenuRadioItem>
                                <DropdownMenuRadioItem value="lastMonth">Last Month</DropdownMenuRadioItem>
                            </DropdownMenuRadioGroup>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem disabled>
                                <FileDown className="mr-2 h-4 w-4" />
                                Export
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
           </header>
          <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
            <Card>
                <CardHeader>
                    <CardTitle>Movement Ledger</CardTitle>
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                        <CardDescription>
                            Showing movements from {format(dateRange.from, 'PPP')} to {format(dateRange.to, 'PPP')}.
                        </CardDescription>
                        <div className="flex items-center gap-2">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full md:w-[250px] justify-start text-left font-normal">
                                        <Filter className="mr-2 h-4 w-4"/>
                                        <span className="truncate">{selectedProductName}</span>
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[300px] p-0" align="end">
                                    <Command>
                                        <CommandInput placeholder="Filter product..." />
                                        <CommandList>
                                            <CommandEmpty>No products found.</CommandEmpty>
                                            <CommandGroup>
                                                <CommandItem onSelect={() => setFilterProductId(null)}>
                                                    All Products
                                                </CommandItem>
                                                {allStockableItems.map(p => (
                                                    <CommandItem key={p.id} onSelect={() => setFilterProductId(p.id)}>
                                                        {p.name}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                            {filterProductId && (
                                <Button variant="ghost" size="icon" onClick={() => setFilterProductId(null)}>
                                    <X className="h-4 w-4"/>
                                </Button>
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date/Time</TableHead>
                                <TableHead>Product</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Qty Change</TableHead>
                                <TableHead>Reason / Ref.</TableHead>
                                <TableHead className="text-right">Resulting Stock</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {reportData.length > 0 ? (
                                reportData.map(m => (
                                    <TableRow key={m.id}>
                                        <TableCell className="text-xs">{format(new Date(m.created_at), 'Pp')}</TableCell>
                                        <TableCell className="font-medium">{m.product_name_snapshot}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={movementTypeLabels[m.type]?.color || ''}>
                                                {movementTypeLabels[m.type]?.label || m.type}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className={`font-bold ${m.qty_change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {m.qty_change > 0 ? `+${m.qty_change}` : m.qty_change}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]">{getReferenceDisplay(m)}</TableCell>
                                        <TableCell className="text-right font-mono">---</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">
                                       <PackageSearch className="mx-auto h-12 w-12 text-muted-foreground" />
                                       <p className="mt-2">No stock movements found for this period.</p>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
          </main>
        </div>
    );
}
