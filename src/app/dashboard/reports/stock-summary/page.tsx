'use client';

import Link from 'next/link';
import { useStore } from '@/lib/store';
import React, { useState, useMemo, useEffect } from 'react';
import { DateRange } from 'react-day-picker';
import { ArrowLeft, Warehouse, Loader2, Package, Beaker, Layers2, FileDown, FileText } from 'lucide-react';
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { exportStockSummaryToExcel, exportStockSummaryToPdf } from '@/lib/export';
import { useToast } from '@/hooks/use-toast';
import { getStockMovementsByDateRange } from '@/services/stockService';
import { StockMovement } from '@/lib/types';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DateRangeFilter } from '@/components/DateRangeFilter';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { NotificationBell } from '@/components/NotificationBell';

export default function StockSummaryReportPage() {
    const { rawIngredients, products, productVariants, storeConfig } = useStore();
    const { toast } = useToast();
    const [date, setDate] = React.useState<DateRange | undefined>({
      from: startOfDay(new Date()),
      to: endOfDay(new Date()),
    });
    const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filterType, setFilterType] = useState<'all' | 'product' | 'ingredient' | 'variant'>('all');

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
        const stockableProducts = products
            .filter(p => p.track_stock && !p.has_variant)
            .map(p => ({ ...p, name: p.name, stock: p.stock, itemType: 'product' as const }));

        const stockableVariants = productVariants
            .filter(v => v.track_stock)
            .map(v => {
                const parent = products.find(p => p.id === v.product_id);
                return {
                    ...v,
                    id: v.id,
                    name: `${parent?.name || 'Product'} (${v.name})`,
                    stock: v.stock,
                    itemType: 'variant' as const,
                };
            });
        
        const stockableIngredients = rawIngredients.map(i => ({ ...i, name: i.name, stock: i.stock_qty, itemType: 'ingredient' as const }));

        return [...stockableProducts, ...stockableVariants, ...stockableIngredients];
    }, [products, productVariants, rawIngredients]);

    const reportData = useMemo(() => {
        const filteredItems = allStockableItems.filter(item => {
            if (filterType === 'all') return true;
            return item.itemType === filterType;
        });

        return filteredItems.map(item => {
            const movementsInPeriod = stockMovements.filter(m => m.product_id === item.id);
            const totalChangeInPeriod = movementsInPeriod.reduce((sum, m) => sum + m.qty_change, 0);
            
            const currentStock = item.stock;
            const openingStock = currentStock - totalChangeInPeriod;
            
            const added = movementsInPeriod
                .filter(m => m.type === 'restock' || m.type === 'initial_balance')
                .reduce((sum, m) => sum + m.qty_change, 0);
                
            const sold = Math.abs(movementsInPeriod
                .filter(m => m.type === 'sale')
                .reduce((sum, m) => sum + m.qty_change, 0));

            const adjusted = movementsInPeriod
                .filter(m => ['correction', 'lost', 'damaged'].includes(m.type))
                .reduce((sum, m) => sum + m.qty_change, 0);

            return {
                id: item.id,
                name: item.name,
                type: item.itemType,
                openingStock,
                added,
                sold,
                adjusted,
                closingStock: currentStock,
            };
        });
    }, [allStockableItems, stockMovements, filterType]);
    
    const handleExcelExport = () => {
        if (storeConfig && date?.from && date?.to) {
            exportStockSummaryToExcel(reportData, { from: date.from, to: date.to }, storeConfig.store_name);
        } else {
            toast({ variant: 'destructive', title: 'Error', description: 'Store configuration or date range not found.' });
        }
    };

    const handlePdfExport = () => {
        if (storeConfig && date?.from && date?.to) {
            exportStockSummaryToPdf(reportData, { from: date.from, to: date.to }, storeConfig.store_name);
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
                        <Warehouse className="h-5 w-5" /> Stock Summary Report
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
                            <CardTitle>Stock Summary</CardTitle>
                             {date?.from && date?.to && (
                                <CardDescription>
                                    Showing a summary of stock movements from {format(date.from, 'PPP')} to {format(date.to, 'PPP')}.
                                </CardDescription>
                            )}
                        </div>
                        <div className="flex flex-col sm:flex-row items-center gap-2">
                            <DateRangeFilter date={date} setDate={setDate} />
                            <Select value={filterType} onValueChange={(v) => setFilterType(v as any)}>
                                <SelectTrigger className="w-full sm:w-[150px]">
                                    <SelectValue placeholder="Filter type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Items</SelectItem>
                                    <SelectItem value="product">Products</SelectItem>
                                    <SelectItem value="variant">Variants</SelectItem>
                                    <SelectItem value="ingredient">Ingredients</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Product / Ingredient</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead className="text-right">Opening</TableHead>
                                <TableHead className="text-right">Added</TableHead>
                                <TableHead className="text-right">Sold</TableHead>
                                <TableHead className="text-right">Adjusted</TableHead>
                                <TableHead className="text-right">Closing</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={7} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                            ) : reportData.length > 0 ? (
                                reportData.map(item => (
                                    <TableRow key={item.id}>
                                        <TableCell className="font-medium">{item.name}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={
                                                item.type === 'product' ? 'border-blue-300 bg-blue-50 text-blue-800' : 
                                                item.type === 'variant' ? 'border-purple-300 bg-purple-50 text-purple-800' :
                                                'border-green-300 bg-green-50 text-green-800'
                                            }>
                                                {item.type === 'product' ? <Package className="h-3 w-3 mr-1.5" /> : item.type === 'variant' ? <Layers2 className="h-3 w-3 mr-1.5" /> : <Beaker className="h-3 w-3 mr-1.5" />}
                                                {item.type}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">{item.openingStock.toLocaleString()}</TableCell>
                                        <TableCell className="text-right text-green-600">{item.added > 0 ? `+${item.added.toLocaleString()}` : 0}</TableCell>
                                        <TableCell className="text-right text-red-500">{item.sold > 0 ? `-${item.sold.toLocaleString()}` : 0}</TableCell>
                                        <TableCell className="text-right text-blue-500">{item.adjusted !== 0 ? item.adjusted.toLocaleString() : 0}</TableCell>
                                        <TableCell className="text-right font-bold">{item.closingStock.toLocaleString()}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-24 text-center">
                                        No stock-tracked items found.
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
