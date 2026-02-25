
'use client';

import Link from 'next/link';
import { useStore } from '@/lib/store';
import { useState, useMemo, useCallback } from 'react';
import { ArrowLeft, History, FileDown, MoreVertical, PackageSearch, Filter, X, FileText, Package, Beaker } from 'lucide-react';
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { exportStockMovementToExcel, exportStockMovementToPdf } from '@/lib/export';
import { useToast } from '@/hooks/use-toast';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { StockMovement } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';


type DateRangePreset = 'today' | 'last7' | 'last30' | 'lastMonth';

type ReportRow = StockMovement & {
    referenceDisplay: string;
    openingStock: number;
    resultingStock: number;
    productType: 'Product' | 'Ingredient';
};

const movementTypeLabels: Record<string, { label: string, color: string }> = {
    sale: { label: 'Sale', color: 'bg-red-500/10 text-red-700' },
    restock: { label: 'Restock', color: 'bg-green-500/10 text-green-700' },
    initial_balance: { label: 'Initial', color: 'bg-blue-500/10 text-blue-700' },
    correction: { label: 'Correction', color: 'bg-yellow-500/10 text-yellow-700' },
    lost: { label: 'Lost', color: 'bg-gray-500/10 text-gray-700' },
    damaged: { label: 'Damaged', color: 'bg-purple-500/10 text-purple-700' },
};

export default function StockMovementReportPage() {
    const { stockMovements, products, rawIngredients, transactions, storeConfig } = useStore();
    const { toast } = useToast();
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
    
    const allStockableItems = useMemo(() => [
        ...products.filter(p => p.track_stock).map(p => ({ ...p, id: p.id, name: p.name, stock: p.stock, itemType: 'Product' as const })),
        ...rawIngredients.map(i => ({ ...i, id: i.id, name: i.name, stock: i.stock_qty, itemType: 'Ingredient' as const }))
    ], [products, rawIngredients]);

    const txIdToInvoiceMap = useMemo(() =>
        new Map(transactions.map(tx => [tx.id, tx.invoice_number])),
    [transactions]);

    const getReferenceDisplay = useCallback((movement: StockMovement): string => {
        if (movement.reason) {
            return movement.reason;
        }
        if (movement.type === 'sale' && movement.reference_id) {
            return txIdToInvoiceMap.get(movement.reference_id) || 'N/A';
        }
        return 'N/A';
    }, [txIdToInvoiceMap]);

    const reportData = useMemo((): ReportRow[] => {
        const allMovementsSorted = [...stockMovements].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

        const relevantProductIds = filterProductId ? [filterProductId] : allStockableItems.map(item => item.id);
        
        const productStates = new Map<string, { runningStock: number, itemType: 'Product' | 'Ingredient' }>();

        for (const productId of relevantProductIds) {
            const item = allStockableItems.find(p => p.id === productId);
            if (!item) continue;
            
            const currentStock = item.stock;

            const changeAfterPeriod = allMovementsSorted
                .filter(m => m.product_id === productId && new Date(m.created_at) > dateRange.to)
                .reduce((sum, m) => sum + m.qty_change, 0);
            
            const stockAtPeriodEnd = currentStock - changeAfterPeriod;

            const changeDuringPeriod = allMovementsSorted
                .filter(m => m.product_id === productId && new Date(m.created_at) >= dateRange.from && new Date(m.created_at) <= dateRange.to)
                .reduce((sum, m) => sum + m.qty_change, 0);
            
            const openingStock = stockAtPeriodEnd - changeDuringPeriod;
            
            productStates.set(productId, { runningStock: openingStock, itemType: item.itemType });
        }
        
        const movementsInPeriod = allMovementsSorted.filter(m => {
            const movementDate = new Date(m.created_at);
            const inDateRange = movementDate >= dateRange.from && movementDate <= dateRange.to;
            const productMatch = !filterProductId || m.product_id === filterProductId;
            return inDateRange && productMatch;
        });

        const finalReportRows = movementsInPeriod.map(movement => {
            const state = productStates.get(movement.product_id);
            if (!state) {
                return {
                    ...movement,
                    openingStock: 0,
                    resultingStock: 0,
                    referenceDisplay: getReferenceDisplay(movement),
                    productType: 'Product'
                } as ReportRow;
            }

            const openingStockForRow = state.runningStock;
            const resultingStock = openingStockForRow + movement.qty_change;
            
            state.runningStock = resultingStock;
            
            return {
                ...movement,
                openingStock: openingStockForRow,
                resultingStock: resultingStock,
                referenceDisplay: getReferenceDisplay(movement),
                productType: state.itemType
            } as ReportRow;
        });

        return finalReportRows.reverse();

    }, [stockMovements, dateRange, filterProductId, allStockableItems, getReferenceDisplay]);
    
    const selectedProductName = useMemo(() => {
        if (!filterProductId) return "All Products";
        return allStockableItems.find(p => p.id === filterProductId)?.name || "Unknown";
    }, [filterProductId, allStockableItems]);
    
    const handleExcelExport = () => {
        if (storeConfig) {
            exportStockMovementToExcel(reportData, dateRange, storeConfig.store_name);
        } else {
            toast({ variant: 'destructive', title: 'Error', description: 'Store configuration not found.' });
        }
    };

    const handlePdfExport = () => {
        if (storeConfig) {
            exportStockMovementToPdf(reportData, dateRange, storeConfig.store_name);
        } else {
            toast({ variant: 'destructive', title: 'Error', description: 'Store configuration not found.' });
        }
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
                     <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" disabled={reportData.length === 0}>
                                <FileDown className="mr-2 h-4 w-4" />
                                <span>Export</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={handleExcelExport}>
                                <FileDown className="mr-2 h-4 w-4"/> Excel (.xlsx)
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={handlePdfExport}>
                                <FileText className="mr-2 h-4 w-4"/> PDF (.pdf)
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
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
                             <DropdownMenuItem onSelect={handleExcelExport} disabled={reportData.length === 0}>
                                <FileDown className="mr-2 h-4 w-4" />
                                Export to Excel
                            </DropdownMenuItem>
                             <DropdownMenuItem onSelect={handlePdfExport} disabled={reportData.length === 0}>
                                <FileText className="mr-2 h-4 w-4" />
                                Export to PDF
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
                                <TableHead>Movement Type</TableHead>
                                <TableHead className="text-right">Opening</TableHead>
                                <TableHead className="text-right">Change</TableHead>
                                <TableHead className="text-right">Resulting</TableHead>
                                <TableHead>Reason / Ref.</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {reportData.length > 0 ? (
                                reportData.map(m => (
                                    <TableRow key={m.id}>
                                        <TableCell className="text-xs">{format(new Date(m.created_at), 'Pp')}</TableCell>
                                        <TableCell className="font-medium">{m.product_name_snapshot}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="text-xs">
                                                {m.productType === 'Ingredient' ? <Beaker className="h-3 w-3 mr-1.5"/> : <Package className="h-3 w-3 mr-1.5"/>}
                                                {m.productType}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={movementTypeLabels[m.type]?.color || ''}>
                                                {movementTypeLabels[m.type]?.label || m.type}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-muted-foreground">{m.openingStock}</TableCell>
                                        <TableCell className={`text-right font-bold ${m.qty_change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {m.qty_change > 0 ? `+${m.qty_change}` : m.qty_change}
                                        </TableCell>
                                        <TableCell className="text-right font-mono font-bold">{m.resultingStock}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground truncate max-w-[150px]">{m.referenceDisplay}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={8} className="h-24 text-center">
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
