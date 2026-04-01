'use client';

import { Link } from 'react-router-dom';
import { useStore } from '@/lib/store';
import React, { useState, useMemo, useCallback, useEffect, memo } from 'react';
import { DateRange } from 'react-day-picker';
import { ArrowLeft, History, PackageSearch, Filter, X, Package, Loader2, FileDown, FileText } from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';
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
import { ThemeToggle } from '@/components/ThemeButtons';

import { Bar, ComposedChart, CartesianGrid, XAxis, YAxis, Area } from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { LineChart as LineChartIcon } from "lucide-react" // Rename to avoid conflict with Recharts
import { isSameDay, differenceInDays, addDays } from 'date-fns';
import { cn, itemMapping, typeConfig } from '@/lib/utils';

type ReportRow = StockMovement & {
    referenceDisplay: string;
    openingStock: number;
    resultingStock: number;
    productType: 'Product' | 'Ingredient' | 'Variant';
};

const movementTypeLabels: Record<string, { label: string, color: string }> = {
    sale: { label: 'Jual', color: 'bg-red-500/10 text-red-700' },
    restock: { label: 'Restok', color: 'bg-green-500/10 text-green-700' },
    initial_balance: { label: 'Saldo Awal', color: 'bg-blue-500/10 text-blue-700' },
    correction: { label: 'Koreksi', color: 'bg-yellow-500/10 text-yellow-700' },
    lost: { label: 'Hilang', color: 'bg-gray-500/10 text-gray-700' },
    damaged: { label: 'Rusak', color: 'bg-purple-500/10 text-purple-700' },
};


// 1. Memoize Table Row to prevent re-renders when chart or other parts change
const MovementRow = memo(({ m, movementTypeLabels }: { m: ReportRow, movementTypeLabels: any }) => {
    const type = m.productType.toLowerCase() as keyof typeof typeConfig;
    const { icon: ItemIcon, class: className } = typeConfig[type] || typeConfig.product;
    return (
    <TableRow>
        <TableCell className="text-xs">{format(new Date(m.created_at), 'Pp')}</TableCell>
        <TableCell className="font-medium">{m.product_name_snapshot}</TableCell>
        <TableCell>
            <Badge variant='outline' className={cn('text-xs capitalize', className)}>
                <ItemIcon className="h-3 w-3 mr-1.5"/>
                {itemMapping.get(m.productType)}
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
        <TableCell className="text-xs text-muted-foreground truncate max-w-37.5">{m.referenceDisplay}</TableCell>
    </TableRow>
)});
MovementRow.displayName = "MovementRow";

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
    

     const itemsLookup = useMemo(() => {
        const map = new Map<string, 'Product' | 'Variant' | 'Ingredient'>();
        
        products.forEach(p => { if(!p.has_variant) map.set(p.id, 'Product') });
        productVariants.forEach(v => map.set(v.id, 'Variant'));
        rawIngredients.forEach(i => map.set(i.id, 'Ingredient'));
        
        return map;
    }, [products, productVariants, rawIngredients]);

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

    
    // 3. OPTIMIZATION: Single-pass report processing
    const reportData = useMemo((): ReportRow[] => {
        if (isLoading || stockMovements.length === 0) return [];

        return stockMovements
            .filter(m => !filterProductId || m.product_id === filterProductId)
            .map(movement => ({
                ...movement,
                openingStock: 0,
                resultingStock: 0,
                referenceDisplay: getReferenceDisplay(movement),
                productType: itemsLookup.get(movement.product_id) || 'Product'
            }))
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }, [stockMovements, filterProductId, itemsLookup, getReferenceDisplay, isLoading]);

    // 4. OPTIMIZATION: Process Chart Data from the already-filtered reportData
    const chartData = useMemo(() => {
        if (!date?.from || reportData.length === 0) return [];

        const isSingleDay = date.from && date.to ? isSameDay(date.from, date.to) : true;
        
        if (isSingleDay) {
            const data = Array.from({ length: 24 }, (_, i) => ({
                name: `${String(i).padStart(2, '0')}:00`,
                inflow: 0, outflow: 0, net: 0,
            }));
            reportData.forEach(m => {
                const hour = new Date(m.created_at).getHours();
                if (m.qty_change > 0) data[hour].inflow += m.qty_change;
                else data[hour].outflow += Math.abs(m.qty_change);
                data[hour].net += m.qty_change;
            });
            return data;
        } else {
            const dataMap: Record<string, any> = {};
            const dayCount = differenceInDays(date.to!, date.from!) + 1;

            for (let i = 0; i < dayCount; i++) {
                const d = addDays(date.from!, i);
                const key = format(d, 'yyyy-MM-dd');
                dataMap[key] = { name: format(d, 'MMM d'), inflow: 0, outflow: 0, net: 0 };
            }

            reportData.forEach(m => {
                const key = format(new Date(m.created_at), 'yyyy-MM-dd');
                if (dataMap[key]) {
                    if (m.qty_change > 0) dataMap[key].inflow += m.qty_change;
                    else dataMap[key].outflow += Math.abs(m.qty_change);
                    dataMap[key].net += m.qty_change;
                }
            });
            return Object.values(dataMap);
        }
    }, [date, reportData]);

    const selectedProductName = useMemo(() => {
        if (!filterProductId) return "Semua Produk & Bahan";
        return allStockableItems.find(p => p.id === filterProductId)?.name || "Tidak Diketahui";
    }, [filterProductId, allStockableItems]);
    
    const handleExcelExport = async() => {
        if (storeConfig && date?.from && date?.to) {
            await exportStockMovementToExcel(reportData, { from: date.from, to: date.to }, storeConfig.store_name);
        } else {
            toast({ variant: 'destructive', title: 'Error', description: 'Konfigurasi toko atau periode tidak ditemukan.' });
        }
    };

    const handlePdfExport = async () => {
        if (storeConfig && date?.from && date?.to) {
            await exportStockMovementToPdf(reportData, { from: date.from, to: date.to }, storeConfig.store_name);
        } else {
            toast({ variant: 'destructive', title: 'Error', description: 'Konfigurasi toko atau periode tidak ditemukan.' });
        }
    };

    const chartConfig = {
        inflow: { label: "Stok Masuk", color: "hsl(var(--success))" },
        outflow: { label: "Stok Keluar", color: "hsl(var(--destructive))" },
        net: { label: "Net Change", color: "hsl(var(--primary))" }
    } satisfies ChartConfig;

    return (
        <div className="flex min-h-screen w-full flex-col bg-muted/40">
           <header className="sticky top-0 flex h-16 items-center gap-2 border-b bg-background px-4 md:px-6 z-10">
                <Button variant="outline" size="icon" className="shrink-0" asChild>
                    <Link to="/dashboard/reports">
                        <ArrowLeft className="h-4 w-4" />
                        <span className="sr-only">Kembali</span>
                    </Link>
                </Button>
                <div className="flex-1">
                    <h1 className="text-lg font-semibold flex items-center gap-2">
                        <History className="h-5 w-5" /> Laporan Mutasi Stok
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
                    <ThemeToggle />
                </div>
           </header>
          <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
            <Card className="mb-2">
                <CardHeader>
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <CardTitle>Periode</CardTitle>
                        </div>
                        <div className="flex flex-col sm:flex-row items-center gap-2">
                            <DateRangeFilter date={date} setDate={setDate} />
                            <div className="flex w-full sm:w-auto items-center gap-2">
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="w-full sm:w-62.5 justify-start text-left font-normal">
                                            <Filter className="mr-2 h-4 w-4"/>
                                            <span className="truncate">{selectedProductName}</span>
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-75 p-0" align="end">
                                        <Command>
                                            <CommandInput placeholder="Cari item..." />
                                            <CommandList>
                                                <CommandEmpty>Item tidak ditemukan.</CommandEmpty>
                                                <CommandGroup>
                                                    <CommandItem onSelect={() => setFilterProductId(null)}>
                                                        Semua Produk & Bahan
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
            </Card>
            <Card className="mb-6">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <LineChartIcon className="h-5 w-5 text-primary" />
                        <div>
                            <CardTitle>Kecepatan Stok</CardTitle>
                            <CardDescription>
                                Perbandingan stok masuk vs keluar (unit)
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ?
                        <div className='w-full min-h-24 grid place-items-center'>
                            <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground"/>
                        </div> :
                        reportData.length > 0 ? 
                            (
                            <ChartContainer config={chartConfig} className="h-75 w-full">
                                <ComposedChart data={chartData}>
                                    <defs>
                                        <linearGradient id="fillNet" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="var(--color-net)" stopOpacity={0.2} />
                                            <stop offset="95%" stopColor="var(--color-net)" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                                    <XAxis 
                                        dataKey="name" 
                                        tickLine={false} 
                                        axisLine={false} 
                                        tickMargin={8} 
                                    />
                                    <YAxis 
                                        tickLine={false} 
                                        axisLine={false} 
                                        tickMargin={8} 
                                        allowDecimals={false}
                                    />
                                    <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
                                    
                                    {/* Stock Out (Negative visual) */}
                                    <Bar 
                                        dataKey="outflow" 
                                        fill="var(--color-outflow)" 
                                        radius={[4, 4, 0, 0]} 
                                        barSize={20} 
                                        opacity={0.6}
                                    />
                                    
                                    {/* Stock In */}
                                    <Bar 
                                        dataKey="inflow" 
                                        fill="var(--color-inflow)" 
                                        radius={[4, 4, 0, 0]} 
                                        barSize={20} 
                                    />
                                    
                                    {/* Net Trend */}
                                    <Area 
                                        type="monotone" 
                                        dataKey="net" 
                                        stroke="var(--color-net)" 
                                        fill="url(#fillNet)" 
                                        strokeWidth={2} 
                                    />
                                </ComposedChart>
                            </ChartContainer>
                        ) : (
                            <div className="h-75 flex flex-col items-center justify-center text-muted-foreground border border-dashed rounded-lg">
                                <Package className="h-10 w-10 mb-2 opacity-20" />
                                <p>Tidak ada data untuk periode ini.</p>
                            </div>
                        )
                    }
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <CardTitle>Buku Mutasi</CardTitle>
                            {date?.from && date?.to && (
                                <CardDescription>
                                    Menampilkan mutasi dari {format(date.from, 'dd MMM yyyy')} s/d {format(date.to, 'dd MMM yyyy')}.
                                </CardDescription>
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Waktu</TableHead>
                                <TableHead>Item</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Jenis Mutasi</TableHead>
                                <TableHead className="text-right">Perubahan</TableHead>
                                <TableHead>Alasan / Ref.</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={6} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground"/></TableCell></TableRow>
                            ) : reportData.length > 0 ? (
                                reportData.map(m => (
                                    <MovementRow key={m.id} m={m} movementTypeLabels={movementTypeLabels} />
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">
                                       <PackageSearch className="mx-auto h-12 w-12 text-muted-foreground" />
                                       <p className="mt-2">Tidak ada mutasi stok pada periode ini.</p>
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
