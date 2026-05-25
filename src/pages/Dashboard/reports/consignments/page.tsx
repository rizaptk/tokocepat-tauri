import { Link, useNavigate } from 'react-router-dom';
import { useState, useMemo, useEffect } from 'react';
import { DateRange } from 'react-day-picker';
import { startOfDay, endOfDay } from 'date-fns';
import { 
    ArrowLeft, Landmark, Loader2, FileDown, FileText, 
    Search, Users, Package, DollarSign, Wallet 
} from 'lucide-react';
import { useStore } from '@/lib/store';
import { getStockMovementsByDateRange } from '@/services/stockService';
import { StockMovement } from '@/lib/types';
import { exportConsignorReportToExcel, exportConsignorReportToPdf } from '@/lib/export';

// UI Components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DateRangeFilter } from '@/components/DateRangeFilter';
import { NotificationBell } from '@/components/NotificationBell';
import { ThemeToggle } from '@/components/ThemeButtons';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(amount);
};

export default function ConsignmentReportPage() {
    const { products, storeConfig } = useStore();
    const nav = useNavigate();

    // Default to today's date range (convenient for daily-basis consignment)
    const [date, setDate] = useState<DateRange | undefined>({
        from: startOfDay(new Date()),
        to: endOfDay(new Date()),
    });

    const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filterConsignor, setFilterConsignor] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');

    // Fetch movements for the active date range
    useEffect(() => {
        if (!date?.from || !date?.to) return;
        const fetchMovements = async () => {
            setIsLoading(true);
            try {
                const data = await getStockMovementsByDateRange(date.from!, date.to!);
                setStockMovements(data);
            } catch (err) {
                console.error("Gagal memuat mutasi stok:", err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchMovements();
    }, [date]);

    // Unique Consignor/Penitip list for the filter select dropdown
    const consignorsList = useMemo(() => {
        const names = products
            .filter(p => p.is_consignment && p.consignor_name)
            .map(p => p.consignor_name!);
        return Array.from(new Set(names)).sort();
    }, [products]);

    // Crunch Consignment Payout Stats
    const calculatedReportData = useMemo(() => {
        const consignmentProducts = products.filter(p => p.is_consignment);

        const mapped = consignmentProducts.map(p => {
            const movementsInPeriod = stockMovements.filter(m => m.product_id === p.id);

            // 1. Morning Supplied (restock / initial balance)
            const supplied = movementsInPeriod
                .filter(m => m.type === 'restock' || m.type === 'initial_balance')
                .reduce((sum, m) => sum + m.qty_change, 0);

            // 2. Units Sold during period
            const sold = Math.abs(movementsInPeriod
                .filter(m => m.type === 'sale')
                .reduce((sum, m) => sum + m.qty_change, 0));

            // 3. Leftovers returned/pulled in afternoon (negative adjustments)
            const returned = Math.abs(movementsInPeriod
                .filter(m => ['correction', 'lost', 'damaged'].includes(m.type) && m.qty_change < 0)
                .reduce((sum, m) => sum + m.qty_change, 0));

            // 4. Commission Splits
            const commType = p.consignment_commission_type;
            const commVal = p.consignment_commission_value || 0;

            let storeCommission = 0;
            if (commType === 'percentage') {
                storeCommission = (p.price * sold) * (commVal / 100);
            } else { // 'flat'
                storeCommission = commVal * sold;
            }

            const consignorShare = (p.price * sold) - storeCommission;

            return {
                id: p.id,
                consignorName: p.consignor_name || 'Tanpa Nama',
                productName: p.name,
                price: p.price,
                supplied,
                sold,
                returned,
                commissionType: commType || 'percentage',
                commissionValue: commVal,
                storeCommission,
                consignorShare
            };
        });

        // Apply filters (Consignor name & Search query)
        return mapped.filter(item => {
            const matchesConsignor = filterConsignor === 'all' || item.consignorName === filterConsignor;
            const matchesSearch = item.productName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                  item.consignorName.toLowerCase().includes(searchTerm.toLowerCase());
            
            // Only list items that had some activity or were supplied in the period
            const hasActivity = item.supplied > 0 || item.sold > 0 || item.returned > 0;

            return matchesConsignor && matchesSearch && hasActivity;
        });
    }, [products, stockMovements, filterConsignor, searchTerm]);

    // KPI Summary Calculations
    const kpis = useMemo(() => {
        const totalIn = calculatedReportData.reduce((sum, item) => sum + item.supplied, 0);
        const totalOut = calculatedReportData.reduce((sum, item) => sum + item.sold, 0);
        const totalComm = calculatedReportData.reduce((sum, item) => sum + item.storeCommission, 0);
        const totalPayout = calculatedReportData.reduce((sum, item) => sum + item.consignorShare, 0);

        return {
            totalIn,
            totalOut,
            totalComm,
            totalPayout
        };
    }, [calculatedReportData]);

    const handleExcelExport = async () => {
        if (storeConfig && date?.from && date?.to) {
            await exportConsignorReportToExcel(calculatedReportData, { from: date.from, to: date.to }, storeConfig.store_name);
        }
    };

    const handlePdfExport = async () => {
        if (storeConfig && date?.from && date?.to) {
            await exportConsignorReportToPdf(calculatedReportData, { from: date.from, to: date.to }, storeConfig.store_name);
        }
    };

    return (
        <div className="flex min-h-screen w-full flex-col bg-muted/40">
            {/* Header */}
            <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6 z-10">
                <Button variant="outline" size="icon" className="shrink-0" asChild>
                    <Link to="#" onClick={() => nav(-1)}>
                        <ArrowLeft className="h-4 w-4" />
                        <span className="sr-only">Kembali</span>
                    </Link>
                </Button>
                <div className="flex-1">
                    <h1 className="text-lg font-semibold flex items-center gap-2">
                        <Landmark className="h-5 w-5" /> Bagi Hasil & Payout Konsinyasi
                    </h1>
                </div>
                <div className="flex items-center gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" disabled={calculatedReportData.length === 0}>
                                <FileDown className="mr-2 h-4 w-4" /> Ekspor
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={handleExcelExport}>
                                <FileDown className="mr-2 h-4 w-4 text-green-500" /> Excel (.xlsx)
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={handlePdfExport}>
                                <FileText className="mr-2 h-4 w-4 text-red-400" /> PDF (.pdf)
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <NotificationBell />
                    <ThemeToggle />
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
                {/* KPI Summary Row */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Barang Masuk</CardTitle>
                            <Package className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{kpis.totalIn.toLocaleString()} <span className="text-xs text-muted-foreground font-normal">unit</span></div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Barang Terjual</CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{kpis.totalOut.toLocaleString()} <span className="text-xs text-muted-foreground font-normal">unit</span></div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Margin / Komisi Toko</CardTitle>
                            <DollarSign className="h-4 w-4 text-primary" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-primary">{formatCurrency(kpis.totalComm)}</div>
                        </CardContent>
                    </Card>

                    <Card className="border-green-500/30 bg-green-500/5">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-green-700 dark:text-green-400">Siap Bayar ke Penitip</CardTitle>
                            <Wallet className="h-4 w-4 text-green-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(kpis.totalPayout)}</div>
                        </CardContent>
                    </Card>
                </div>

                {/* Audit Table Card */}
                <Card className="flex-1 overflow-hidden">
                    <CardHeader>
                        <div className="flex flex-col gap-4">
                            <div>
                                <CardTitle>Buku Pembagian Hasil Konsinyasi</CardTitle>
                                <CardDescription>Daftar bagi hasil titipan barang berdasarkan mutasi stok dan penjualan real-time.</CardDescription>
                            </div>

                            {/* Filters Bar */}
                            <div className="flex flex-col sm:flex-row items-center gap-2">
                                <DateRangeFilter date={date} setDate={setDate} />
                                
                                <Select value={filterConsignor} onValueChange={setFilterConsignor}>
                                    <SelectTrigger className="w-full sm:w-48">
                                        <SelectValue placeholder="Pilih Penitip" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Semua Penitip</SelectItem>
                                        {consignorsList.map(name => (
                                            <SelectItem key={name} value={name}>{name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <div className="relative w-full sm:w-60">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        type="search"
                                        placeholder="Cari produk..."
                                        className="pl-8 h-9"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nama Penitip</TableHead>
                                    <TableHead>Nama Produk</TableHead>
                                    <TableHead className="text-right">Harga Jual</TableHead>
                                    <TableHead className="text-center">Masuk</TableHead>
                                    <TableHead className="text-center">Terjual</TableHead>
                                    <TableHead className="text-center">Ditarik</TableHead>
                                    <TableHead className="text-center">Tipe Komisi</TableHead>
                                    <TableHead className="text-right">Komisi Toko</TableHead>
                                    <TableHead className="text-right font-bold text-green-600 dark:text-green-400">Hak Penitip</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={9} className="text-center py-10">
                                            <Loader2 className="animate-spin mx-auto text-muted-foreground h-6 w-6" />
                                        </TableCell>
                                    </TableRow>
                                ) : calculatedReportData.length > 0 ? (
                                    calculatedReportData.map((row) => (
                                        <TableRow key={row.id}>
                                            <TableCell className="font-semibold">{row.consignorName}</TableCell>
                                            <TableCell>{row.productName}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(row.price)}</TableCell>
                                            <TableCell className="text-center">{row.supplied}</TableCell>
                                            <TableCell className="text-center font-bold text-primary">{row.sold}</TableCell>
                                            <TableCell className="text-center text-muted-foreground">{row.returned}</TableCell>
                                            <TableCell className="text-center text-xs">
                                                {row.commissionType === 'flat' ? (
                                                    <span className="bg-muted px-2 py-1 rounded">Rp {row.commissionValue.toLocaleString()} (Flat)</span>
                                                ) : (
                                                    <span className="bg-muted px-2 py-1 rounded">{row.commissionValue}% (Pct)</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right text-muted-foreground">{formatCurrency(row.storeCommission)}</TableCell>
                                            <TableCell className="text-right font-bold text-green-600 dark:text-green-400 bg-green-500/5">
                                                {formatCurrency(row.consignorShare)}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                                            Tidak ada aktivitas produk konsinyasi pada periode ini.
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