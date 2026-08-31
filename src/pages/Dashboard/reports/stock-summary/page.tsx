import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '@/lib/store';
import React, { useState, useMemo, useEffect } from 'react';
import { DateRange } from 'react-day-picker';
import { ArrowLeft, Warehouse, Loader2, Package, Layers2, FileDown, FileText, Printer } from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { exportStockSummaryToExcel, buildStockSummaryPdfBytes } from '@/lib/export';
import { useToast } from '@/hooks/use-toast';
import { PdfPreviewSheet } from '@/components/PdfPreviewSheet';
import { getStockMovementsByDateRange } from '@/services/stockService';
import { StockMovement } from '@/lib/types';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DateRangeFilter } from '@/components/DateRangeFilter';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { NotificationBell } from '@/components/NotificationBell';
import { ThemeToggle } from '@/components/ThemeButtons';
import { usePdfGeneration, PdfGeneratingOverlay } from '@/hooks/usePdfGeneration';

export default function StockSummaryReportPage() {
    const { products, productVariants, storeConfig } = useStore();
    const { toast } = useToast();
    const [date, setDate] = React.useState<DateRange | undefined>({
      from: startOfDay(new Date()),
      to: endOfDay(new Date()),
    });
    const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filterType, setFilterType] = useState<'all' | 'product' | 'variant'>('all');
    const pdf = usePdfGeneration();
    const nav = useNavigate();

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

        return [...stockableProducts, ...stockableVariants];
    }, [products, productVariants]);

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
    
    const handleExcelExport = async () => {
        if (storeConfig && date?.from && date?.to) {
            await exportStockSummaryToExcel(reportData, { from: date.from, to: date.to }, storeConfig.store_name);
        } else {
            toast({ variant: 'destructive', title: 'Error', description: 'Store configuration or date range not found.' });
        }
    };

    const handleCetak = async () => {
        if (storeConfig && date?.from && date?.to) {
            pdf.setTitle('Ringkasan Stok');
            pdf.setFilename('stocksummary.pdf');
            pdf.start('Ringkasan Stok');
            await new Promise(r => setTimeout(r, 30));
            const bytes = await buildStockSummaryPdfBytes(reportData, { from: date.from, to: date.to }, storeConfig.store_name);
            pdf.finish(bytes);
        } else {
            toast({ variant: 'destructive', title: 'Error', description: 'Store configuration or date range not found.' });
        }
    };

    return (
        <div className="flex min-h-screen w-full flex-col bg-muted/40">
           <header className="sticky top-0 flex h-10 items-center gap-4 border-b border-border/60 bg-background/80 px-4 backdrop-blur-md z-20">
                <Button variant="outline" size="icon" className="shrink-0" asChild>
                    <Link to="#" onClick={() => nav(-1)}>
                        <ArrowLeft className="h-4 w-4" />
                        <span className="sr-only">Kembali</span>
                    </Link>
                </Button>
                <div className="flex-1">
                    <h1 className="text-lg font-semibold flex items-center gap-2">
                        <Warehouse className="h-5 w-5" /> Ringkasan Stok
                    </h1>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={reportData.length === 0} onClick={handleCetak}><Printer className="mr-2 h-4 w-4" /> Cetak</Button>
                    <Button variant="outline" size="sm" disabled={reportData.length === 0} onClick={handleExcelExport}><FileDown className="mr-2 h-4 w-4" /> Excel</Button>
                    <NotificationBell />
                    <ThemeToggle />
                </div>
           </header>
          <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <CardTitle>Mutasi Stok</CardTitle>
                             {date?.from && date?.to && (
                                <CardDescription>
                                    Ringkasan pergerakan stok dari {format(date.from, 'dd MMM yyyy')} s/d {format(date.to, 'dd MMM yyyy')}.
                                </CardDescription>
                            )}
                        </div>
                        <div className="flex flex-col sm:flex-row items-center gap-2">
                            <DateRangeFilter date={date} setDate={setDate} />
                            <Select value={filterType} onValueChange={(v) => setFilterType(v as any)}>
                                <SelectTrigger className="w-full sm:w-40">
                                    <SelectValue placeholder="Tipe Item" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Semua Item</SelectItem>
                                    <SelectItem value="product">Produk</SelectItem>
                                    <SelectItem value="variant">Varian Produk</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nama Item</TableHead>
                                <TableHead>Tipe</TableHead>
                                <TableHead className="text-right">Awal</TableHead>
                                <TableHead className="text-right">Masuk</TableHead>
                                <TableHead className="text-right">Keluar</TableHead>
                                <TableHead className="text-right">Koreksi</TableHead>
                                <TableHead className="text-right">Akhir</TableHead>
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
                                                item.type === 'product' ? 'border-indigo-500 bg-primary/5 text-primary' : 
                                                'border-warning bg-warning/5 text-warning'
                                            }>
                                                {item.type === 'product' ? <Package className="h-3 w-3 mr-1.5" /> : <Layers2 className="h-3 w-3 mr-1.5" />}
                                                {item.type === 'product' ? 'Produk' : 'Varian'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">{item.openingStock.toLocaleString()}</TableCell>
                                        <TableCell className="text-right text-success dark:text-success-foreground">{item.added > 0 ? `+${item.added.toLocaleString()}` : 0}</TableCell>
                                        <TableCell className="text-right text-destructive">{item.sold > 0 ? `-${item.sold.toLocaleString()}` : 0}</TableCell>
                                        <TableCell className="text-right text-primary">{item.adjusted !== 0 ? item.adjusted.toLocaleString() : 0}</TableCell>
                                        <TableCell className="text-right font-bold">{item.closingStock.toLocaleString()}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-24 text-center">
                                        Tidak ada data stok pada periode ini.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
          </main>
            <PdfPreviewSheet open={pdf.previewOpen} onOpenChange={pdf.setPreviewOpen} pdfBytes={pdf.pdfBytes} filename={`ringkasan-stok-${storeConfig?.store_name || 'Kastoko'}.pdf`} title="Pratinjau Ringkasan Stok" />
            <PdfGeneratingOverlay open={pdf.open} onCancel={pdf.cancel} title={pdf.title} elapsedMs={pdf.elapsedMs} pageCount={pdf.pageCount} />
        </div>
    );
}
