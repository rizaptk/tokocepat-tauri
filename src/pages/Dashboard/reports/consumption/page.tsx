import { Link } from 'react-router-dom';
import { useStore } from '@/lib/store';
import React, { useState, useMemo, useEffect } from 'react';
import { DateRange } from 'react-day-picker';
import { format, startOfDay, endOfDay } from 'date-fns';
import { ArrowLeft, Beaker, Loader2, FileDown, FileText } from 'lucide-react';
import { exportConsumptionToExcel, exportConsumptionToPdf } from '@/lib/export';
import { useToast } from '@/hooks/use-toast';
import { getStockMovementsByDateRange } from '@/services/stockService';
import { StockMovement } from '@/lib/types';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DateRangeFilter } from '@/components/DateRangeFilter';
import { NotificationBell } from '@/components/NotificationBell';
import { ThemeToggle } from '@/components/ThemeButtons';


export default function ConsumptionReportPage() {
    const { rawIngredients, storeConfig } = useStore();
    const { toast } = useToast();
    const [date, setDate] = React.useState<DateRange | undefined>({
      from: startOfDay(new Date()),
      to: endOfDay(new Date()),
    });
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

    const reportData = useMemo(() => {
        return rawIngredients.map(ing => {
            const movementsInPeriod = stockMovements.filter(m => m.product_id === ing.id);
            
            const consumed = Math.abs(movementsInPeriod
                .filter(m => m.type === 'sale')
                .reduce((sum, m) => sum + m.qty_change, 0));
            
            const adjusted = movementsInPeriod
                .filter(m => m.type !== 'sale')
                .reduce((sum, m) => sum + m.qty_change, 0);

            const totalChangeInPeriod = adjusted - consumed;
            const closingStock = ing.stock_qty;
            const openingStock = closingStock - totalChangeInPeriod;
            const costOfConsumed = consumed * ing.cost_per_unit;
            
            return {
                ...ing,
                openingStock,
                consumed,
                adjusted,
                closingStock,
                costOfConsumed,
            };
        });
    }, [rawIngredients, stockMovements]);
    
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
        }).format(amount);
    };

    const handleExcelExport = () => {
        if (storeConfig && date?.from && date?.to) {
            exportConsumptionToExcel(reportData, { from: date.from, to: date.to }, storeConfig.store_name);
        } else {
            toast({ variant: 'destructive', title: 'Error', description: 'Store configuration or date range not found.' });
        }
    };

    const handlePdfExport = () => {
        if (storeConfig && date?.from && date?.to) {
            exportConsumptionToPdf(reportData, { from: date.from, to: date.to }, storeConfig.store_name);
        } else {
            toast({ variant: 'destructive', title: 'Error', description: 'Store configuration or date range not found.' });
        }
    };

    return (
        <div className="flex min-h-screen w-full flex-col bg-muted/40">
           <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6 z-10">
                <Button variant="outline" size="icon" className="shrink-0" asChild>
                    <Link to="/dashboard/reports">
                        <ArrowLeft className="h-4 w-4" />
                        <span className="sr-only">Kembali</span>
                    </Link>
                </Button>
                <div className="flex-1">
                    <h1 className="text-lg font-semibold flex items-center gap-2">
                        <Beaker className="h-5 w-5" /> Pemakaian Bahan Baku
                    </h1>
                </div>
                <div className="flex items-center gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" disabled={reportData.length === 0}>
                            <FileDown className="mr-2 h-4 w-4" />
                            <span>Ekspor</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={handleExcelExport}>
                                <FileDown className="mr-2 h-4 w-4 text-green-500"/> Excel (.xlsx)
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={handlePdfExport}>
                                <FileText className="mr-2 h-4 w-4 text-red-400"/> PDF (.pdf)
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <NotificationBell />
                    <ThemeToggle />
                </div>
           </header>
          <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <CardTitle>Konsumsi Bahan</CardTitle>
                            {date?.from && date?.to && (
                                <CardDescription>
                                    Data pemakaian dari {format(date.from, 'dd MMM yyyy')} s/d {format(date.to, 'dd MMM yyyy')}.
                                </CardDescription>
                            )}
                        </div>
                        <DateRangeFilter date={date} setDate={setDate} />
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nama Bahan</TableHead>
                                <TableHead className="text-right">Awal</TableHead>
                                <TableHead className="text-right">Terpakai</TableHead>
                                <TableHead className="text-right">Nilai Pakai</TableHead>
                                <TableHead className="text-right">Koreksi</TableHead>
                                <TableHead className="text-right">Akhir</TableHead>
                                <TableHead className="text-right">Nilai Stok</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={7} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                            ) : reportData.length > 0 ? (
                                reportData.map(ing => (
                                    <TableRow key={ing.id}>
                                        <TableCell className="font-medium">{ing.name}</TableCell>
                                        <TableCell className="text-right">{ing.openingStock.toLocaleString()} {ing.unit_type}</TableCell>
                                        <TableCell className="text-right text-red-500">{ing.consumed > 0 ? `-${ing.consumed.toLocaleString()}` : 0} {ing.unit_type}</TableCell>
                                        <TableCell className="text-right text-red-500">{formatCurrency(ing.costOfConsumed)}</TableCell>
                                        <TableCell className="text-right text-blue-500">{ing.adjusted > 0 ? `+${ing.adjusted.toLocaleString()}` : ing.adjusted.toLocaleString()} {ing.unit_type}</TableCell>
                                        <TableCell className="text-right font-bold">{ing.closingStock.toLocaleString()} {ing.unit_type}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(ing.closingStock * ing.cost_per_unit)}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-24 text-center">
                                        Tidak ada data pemakaian bahan.
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
