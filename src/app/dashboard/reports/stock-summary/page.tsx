
'use client';

import Link from 'next/link';
import { useStore } from '@/lib/store';
import { useState, useMemo, useEffect } from 'react';
import { ArrowLeft, Warehouse, Loader2, Package, Beaker, Layers2 } from 'lucide-react';
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { exportStockSummaryToExcel, exportStockSummaryToPdf } from '@/lib/export';
import { useToast } from '@/hooks/use-toast';
import { getStockMovementsByDateRange } from '@/services/stockService';
import { StockMovement } from '@/lib/types';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DateRangeFilter, DateRangePreset } from '@/components/DateRangeFilter';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

export default function StockSummaryReportPage() {
    const { rawIngredients, products, productVariants, storeConfig } = useStore();
    const { toast } = useToast();
    const [range, setRange] = useState<DateRangePreset>('today');
    const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filterType, setFilterType] = useState<'all' | 'product' | 'ingredient' | 'variant'>('all');

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

    useEffect(() => {
        const fetchMovements = async () => {
            setIsLoading(true);
            const data = await getStockMovementsByDateRange(dateRange.from, dateRange.to);
            setStockMovements(data);
            setIsLoading(false);
        };
        fetchMovements();
    }, [dateRange]);

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
        if (storeConfig) {
            exportStockSummaryToExcel(reportData, dateRange, storeConfig.store_name);
        } else {
            toast({ variant: 'destructive', title: 'Error', description: 'Store configuration not found.' });
        }
    };

    const handlePdfExport = () => {
        if (storeConfig) {
            exportStockSummaryToPdf(reportData, dateRange, storeConfig.store_name);
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
                        <Warehouse className="h-5 w-5" /> Stock Summary Report
                    </h1>
                </div>
                <div className="flex items-center gap-2">
                    <Select value={filterType} onValueChange={(v) => setFilterType(v as any)}>
                        <SelectTrigger className="w-full md:w-[150px]">
                            <SelectValue placeholder="Filter type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Items</SelectItem>
                            <SelectItem value="product">Products</SelectItem>
                            <SelectItem value="variant">Variants</SelectItem>
                            <SelectItem value="ingredient">Ingredients</SelectItem>
                        </SelectContent>
                    </Select>
                    <DateRangeFilter
                        range={range}
                        onRangeChange={setRange}
                        onExportExcel={handleExcelExport}
                        onExportPdf={handlePdfExport}
                        hasData={reportData.length > 0}
                    />
                </div>
           </header>
          <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
            <Card>
                <CardHeader>
                    <CardTitle>Stock Summary</CardTitle>
                    <CardDescription>
                        Showing a summary of stock movements from {format(dateRange.from, 'PPP')} to {format(dateRange.to, 'PPP')}.
                    </CardDescription>
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
