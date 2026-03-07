'use client';

import Link from 'next/link';
import { useStore } from '@/lib/store';
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { DateRange } from 'react-day-picker';
import { ArrowLeft, History, PackageSearch, Filter, X, Package, Beaker, Loader2, Layers2, FileDown, FileText } from 'lucide-react';
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { exportStockMovementToExcel, exportStockMovementToPdf } from '@/lib/export';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StockMovement } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { DateRangeFilter } from '@/components/DateRangeFilter';
import { getStockMovementsByDateRange } from '@/services/stockService';
import { NotificationBell } from '@/components/NotificationBell';


type ReportRow = StockMovement & {
    referenceDisplay: string;
    openingStock: number;
    resultingStock: number;
    productType: 'Product' | 'Ingredient' | 'Variant';
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
    const { products, rawIngredients, transactions, storeConfig, productVariants } = useStore();
    const { toast } = useToast();
     const [date, setDate] = React.useState<DateRange | undefined>({
      from: startOfDay(new Date()),
      to: endOfDay(new Date()),
    });
    const [filterProductId, setFilterProductId] = useState<string | null>(null);
    const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!date?.from || !date?.to) return;
        const fetchMovements = async () => {
            setIsLoading(true);
            const data = await getStockMovementsByDateRange(date.from!, date.to!);
            setStockMovements(data);
            setIsLoading(false);
        };
        fetchMovements();
    }, [date]);
    
    const allStockableItems = useMemo(() => {
        const simpleProducts = products
            .filter(p => !p.has_variant)
            .map(p => ({ id: p.id, name: p.name, itemType: 'Product' as const }));

        const allVariants = productVariants
            .map(v => {
                const parent = products.find(p => p.id === v.product_id);
                return {
                    id: v.id,
                    name: `${parent?.name || 'Product'} (${v.name})`,
                    itemType: 'Variant' as const,
                };
            });
        
        const allIngredients = rawIngredients.map(i => ({ id: i.id, name: i.name, itemType: 'Ingredient' as const }));
        
        return [...simpleProducts, ...allVariants, ...allIngredients];
    }, [products, productVariants, rawIngredients]);

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
        if (isLoading) return [];
        const allMovementsSorted = [...stockMovements].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        
        const movementsInPeriod = allMovementsSorted.filter(m => {
            const productMatch = !filterProductId || m.product_id === filterProductId;
            return productMatch;
        });

        const finalReportRows = movementsInPeriod.map(movement => {
            const item = allStockableItems.find(p => p.id === movement.product_id);
            const productType = item?.itemType || 'Product';

            return {
                ...movement,
                openingStock: 0, // Placeholder
                resultingStock: 0, // Placeholder
                referenceDisplay: getReferenceDisplay(movement),
                productType: productType
            } as ReportRow;
        });

        return finalReportRows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    }, [stockMovements, filterProductId, allStockableItems, getReferenceDisplay, isLoading]);
    
    const selectedProductName = useMemo(() => {
        if (!filterProductId) return "All Products & Ingredients";
        return allStockableItems.find(p => p.id === filterProductId)?.name || "Unknown";
    }, [filterProductId, allStockableItems]);
    
    const handleExcelExport = () => {
        if (storeConfig && date?.from && date?.to) {
            exportStockMovementToExcel(reportData, { from: date.from, to: date.to }, storeConfig.store_name);
        } else {
            toast({ variant: 'destructive', title: 'Error', description: 'Store configuration or date range not found.' });
        }
    };

    const handlePdfExport = () => {
        if (storeConfig && date?.from && date?.to) {
            exportStockMovementToPdf(reportData, { from: date.from, to: date.to }, storeConfig.store_name);
        } else {
            toast({ variant: 'destructive', title: 'Error', description: 'Store configuration or date range not found.' });
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
                <div className="flex items-center gap-2">
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
                    <NotificationBell />
                </div>
           </header>
          <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <CardTitle>Movement Ledger</CardTitle>
                            {date?.from && date?.to && (
                                <CardDescription>
                                    Showing movements from {format(date.from, 'PPP')} to {format(date.to, 'PPP')}.
                                </CardDescription>
                            )}
                        </div>
                        <div className="flex flex-col sm:flex-row items-center gap-2">
                            <DateRangeFilter date={date} setDate={setDate} />
                            <div className="flex w-full sm:w-auto items-center gap-2">
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="w-full sm:w-[250px] justify-start text-left font-normal">
                                            <Filter className="mr-2 h-4 w-4"/>
                                            <span className="truncate">{selectedProductName}</span>
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[300px] p-0" align="end">
                                        <Command>
                                            <CommandInput placeholder="Filter item..." />
                                            <CommandList>
                                                <CommandEmpty>No items found.</CommandEmpty>
                                                <CommandGroup>
                                                    <CommandItem onSelect={() => setFilterProductId(null)}>
                                                        All Products & Ingredients
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
                                <TableHead className="text-right">Quantity Change</TableHead>
                                <TableHead>Reason / Ref.</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={6} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground"/></TableCell></TableRow>
                            ) : reportData.length > 0 ? (
                                reportData.map(m => (
                                    <TableRow key={m.id}>
                                        <TableCell className="text-xs">{format(new Date(m.created_at), 'Pp')}</TableCell>
                                        <TableCell className="font-medium">{m.product_name_snapshot}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="text-xs">
                                                {m.productType === 'Ingredient' ? <Beaker className="h-3 w-3 mr-1.5"/> : m.productType === 'Variant' ? <Layers2 className="h-3 w-3 mr-1.5" /> : <Package className="h-3 w-3 mr-1.5"/>}
                                                {m.productType}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={movementTypeLabels[m.type]?.color || ''}>
                                                {movementTypeLabels[m.type]?.label || m.type}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className={`text-right font-bold ${m.qty_change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {m.qty_change > 0 ? `+${m.qty_change}` : m.qty_change}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground truncate max-w-[150px]">{m.referenceDisplay}</TableCell>
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
