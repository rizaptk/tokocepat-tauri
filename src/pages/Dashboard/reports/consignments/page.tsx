// reports/consignments/page.tsx

import { formatIDR as formatCurrency } from "@/lib/format";
import { Link, useNavigate } from 'react-router-dom';
import { useState, useMemo, useEffect, useTransition } from 'react';
import { DateRange } from 'react-day-picker';
import { startOfDay, endOfDay, format } from 'date-fns';
import { 
    ArrowLeft, Landmark, Loader2, FileDown, FileText, 
    Search, Users, Package, DollarSign, Wallet, CheckCircle,
    AlertTriangle // --- IMPORTED WARNING ICON ---
} from 'lucide-react';
import { useStore } from '@/lib/store';
import { getStockMovementsByDateRange } from '@/services/stockService';
import { settleConsignment } from '@/services/consignmentService';
import { StockMovement } from '@/lib/types';
import { exportConsignorReportToExcel, exportConsignorReportToPdf } from '@/lib/export';
import { useToast } from '@/hooks/use-toast';

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
import { useLoadTransactions } from '@/hooks/useLoadTransaction';
import { useDeviceScope } from '@/hooks/useDeviceScope';
import { DeviceScopeFilter } from '@/components/DeviceScopeFilter';
import { cn } from '@/lib/utils';



export default function ConsignmentReportPage() {
    const { products, storeConfig, activeShift } = useStore();
    const { toast } = useToast();
    const nav = useNavigate();
    const [isSettling, startSettleTransition] = useTransition();

    const [date, setDate] = useState<DateRange | undefined>({
        from: startOfDay(new Date()),
        to: endOfDay(new Date()),
    });

    const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
    const [isMovementsLoading, setIsMovementsLoading] = useState(true);
    const [filterConsignor, setFilterConsignor] = useState<string>('all');
    const [filterStatus, setFilterStatus] = useState<string>('unpaid');
    const [searchTerm, setSearchTerm] = useState('');

    // --- LOAD TRANSACTIONS REALTIME DARI DATABASE BERDASARKAN FILTER TANGGAL ---
    const { activeDeviceId } = useDeviceScope();
    const { transactions, isLoading: isTxLoading } = useLoadTransactions(date, activeDeviceId);

    // Fetch movements for the active date range
    const fetchMovements = async () => {
        if (!date?.from || !date?.to) return;
        setIsMovementsLoading(true);
        try {
            const data = await getStockMovementsByDateRange(date.from!, date.to!);
            setStockMovements(data);
        } catch (err) {
            console.error("Gagal memuat mutasi stok:", err);
        } finally {
            setIsMovementsLoading(false);
        }
    };

    useEffect(() => {
        fetchMovements();
    }, [date, transactions]); // Refetch when transactions change to show instant paid updates

    const isLoading = isMovementsLoading || isTxLoading;

    const consignorsList = useMemo(() => {
        const names = products
            .filter(p => p.is_consignment && p.consignor_name)
            .map(p => p.consignor_name!);
        return Array.from(new Set(names)).sort();
    }, [products]);

    // Crunch Consignment Payout Stats
    const calculatedReportData = useMemo(() => {
        const consignmentProducts = products.filter(p => p.is_consignment);

        // --- SCENARIO A: CHRONOLOGICAL PAYOUT HISTORY LEDGER ---
        if (filterStatus === 'paid') {
            const paidItemsMap = new Map<string, any>(); // key: dateStr_consignor_productId

            transactions.forEach(tx => {
                if (tx.status === 'paid') {
                    tx.items.forEach(item => {
                        const isCons = item.product_snapshot.is_consignment;
                        const isSettled = item.is_consignment_settled === true;
                        const settleDate = item.consignment_settled_at;

                        if (isCons && isSettled && settleDate) {
                            const dateObj = new Date(settleDate);
                            
                            // Filter by selected range
                            const isInRange = date?.from && date?.to && dateObj >= date.from && dateObj <= date.to;

                            if (isInRange) {
                                const consignor = item.product_snapshot.consignor_name || 'Tanpa Nama';
                                
                                // Consignor filter check
                                if (filterConsignor !== 'all' && consignor !== filterConsignor) return;

                                // Search term query check
                                const name = item.product_snapshot.name;
                                const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                                      consignor.toLowerCase().includes(searchTerm.toLowerCase());
                                if (!matchesSearch) return;

                                const pId = item.product_snapshot.id;
                                const dateKey = settleDate.split('T')[0]; // Group by day of payment
                                const key = `${dateKey}_${consignor}_${pId}`;

                                // Base the payout on the CHARGED value so promo/free units
                                // (unit_discount) never pay the consignor retail value.
                                const netUnit = Math.max(0, item.price_snapshot - (item.unit_discount || 0));
                                const price = netUnit;
                                const qty = item.qty;
                                const chargedValue = netUnit * qty;

                                const commType = item.product_snapshot.consignment_commission_type;
                                const commVal = item.product_snapshot.consignment_commission_value || 0;

                                let storeCommission = 0;
                                if (commType === 'percentage') {
                                    storeCommission = chargedValue * (commVal / 100);
                                } else {
                                    storeCommission = Math.min(commVal * qty, chargedValue);
                                }
                                const consignorShare = chargedValue - storeCommission;

                                const existing = paidItemsMap.get(key);
                                if (existing) {
                                    existing.qty += qty;
                                    existing.storeCommission += storeCommission;
                                    existing.consignorShare += consignorShare;
                                } else {
                                    paidItemsMap.set(key, {
                                        key,
                                        settledDate: dateKey,
                                        consignorName: consignor,
                                        productName: name,
                                        price,
                                        qty,
                                        commissionType: commType || 'percentage',
                                        commissionValue: commVal,
                                        storeCommission,
                                        consignorShare
                                    });
                                }
                            }
                        }
                    });
                }
            });

            return Array.from(paidItemsMap.values()).sort((a, b) => b.settledDate.localeCompare(a.settledDate));
        }

        // --- SCENARIO B: ACTIVE UNPAID / ALL AGGREGATED PRODUCT VIEW ---
        const mapped = consignmentProducts.map(p => {
            const movementsInPeriod = stockMovements.filter(m => m.product_id === p.id);

            const supplied = movementsInPeriod
                .filter(m => m.type === 'restock' || m.type === 'initial_balance')
                .reduce((sum, m) => sum + m.qty_change, 0);

            const returned = Math.abs(movementsInPeriod
                .filter(m => ['correction', 'lost', 'damaged'].includes(m.type) && m.qty_change < 0)
                .reduce((sum, m) => sum + m.qty_change, 0));

            let unpaidSold = 0;
            let paidSold = 0;
            let unpaidCharged = 0;
            let paidCharged = 0;

            transactions.forEach(tx => {
                if (tx.status === 'paid') {
                    const txDate = new Date(tx.created_at);
                    const isInRange = date?.from && date?.to && txDate >= date.from && txDate <= date.to;

                    if (isInRange) {
                        tx.items.forEach(item => {
                            if (item.product_snapshot.id === p.id) {
                                // Charged value excludes promo/free-unit discounts.
                                const charged = (item.price_snapshot - (item.unit_discount || 0)) * item.qty;
                                if (item.is_consignment_settled === true) {
                                    paidSold += item.qty;
                                    paidCharged += charged;
                                } else {
                                    unpaidSold += item.qty;
                                    unpaidCharged += charged;
                                }
                            }
                        });
                    }
                }
            });

            let activeSold = unpaidSold;
            let activeCharged = unpaidCharged;
            if (filterStatus === 'all') {
                activeSold = unpaidSold + paidSold;
                activeCharged = unpaidCharged + paidCharged;
            }

            const commType = p.consignment_commission_type;
            const commVal = p.consignment_commission_value || 0;

            let storeCommission = 0;
            if (commType === 'percentage') {
                storeCommission = activeCharged * (commVal / 100);
            } else {
                storeCommission = Math.min(commVal * activeSold, activeCharged);
            }

            const consignorShare = activeCharged - storeCommission;

            return {
                id: p.id,
                consignorName: p.consignor_name || 'Tanpa Nama',
                productName: p.name,
                price: activeSold > 0 ? Math.round((activeCharged / activeSold) * 100) / 100 : p.price,
                supplied,
                sold: activeSold,
                unpaidSold,
                paidSold,
                returned,
                commissionType: commType || 'percentage',
                commissionValue: commVal,
                storeCommission,
                consignorShare,
                rawProduct: p
            };
        });

        return mapped.filter(item => {
            const matchesConsignor = filterConsignor === 'all' || item.consignorName === filterConsignor;
            const matchesSearch = item.productName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                  item.consignorName.toLowerCase().includes(searchTerm.toLowerCase());
            
            const hasActivity = item.supplied > 0 || item.unpaidSold > 0 || item.paidSold > 0 || item.returned > 0;

            return matchesConsignor && matchesSearch && hasActivity;
        });
    }, [products, stockMovements, filterConsignor, filterStatus, searchTerm, date, transactions]);

    // KPI Summary Calculations
    const kpis = useMemo(() => {
        const totalIn = filterStatus === 'paid' ? 0 : calculatedReportData.reduce((sum, item) => sum + item.supplied, 0);
        const totalOut = filterStatus === 'paid' 
            ? calculatedReportData.reduce((sum, item) => sum + item.qty, 0)
            : calculatedReportData.reduce((sum, item) => sum + item.sold, 0);
        const totalComm = calculatedReportData.reduce((sum, item) => sum + item.storeCommission, 0);
        const totalPayout = calculatedReportData.reduce((sum, item) => sum + item.consignorShare, 0);

        return {
            totalIn,
            totalOut,
            totalComm,
            totalPayout
        };
    }, [calculatedReportData, filterStatus]);

    const handleSettleConsignment = () => {
        if (!activeShift || filterConsignor === 'all' || !date?.from || !date?.to) return;

        startSettleTransition(async () => {
            try {
                const payoutAmount = await settleConsignment(
                    filterConsignor,
                    { from: date.from!, to: date.to! },
                    calculatedReportData
                );

                toast({
                    title: "Bagi Hasil Sukses",
                    description: `Data pembayaran dan retur "${filterConsignor}" senilai ${formatCurrency(payoutAmount)} berhasil dilunasi secara aman.`
                });

                await fetchMovements();

            } catch (err: any) {
                toast({
                    variant: "destructive",
                    title: "Gagal Pelunasan",
                    description: err.message || "Gagal memproses pelunasan."
                });
            }
        });
    };

    const handleExcelExport = async () => {
        if (storeConfig && date?.from && date?.to) {
            await exportConsignorReportToExcel(calculatedReportData, { from: date.from, to: date.to }, storeConfig.store_name, filterStatus);
        }
    };

    const handlePdfExport = async () => {
        if (storeConfig && date?.from && date?.to) {
            await exportConsignorReportToPdf(calculatedReportData, { from: date.from, to: date.to }, storeConfig.store_name, filterStatus);
        }
    };

    return (
        <div className="flex min-h-screen w-full flex-col bg-muted/40">
            {/* Header */}
            <header className="sticky top-0 flex h-10 items-center gap-4 border-b border-border/60 bg-background/80 px-4 backdrop-blur-md z-20">
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
                                <FileDown className="mr-2 h-4 w-4 text-success" /> Excel (.xlsx)
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
                {/* Real-time Settlement Action Card */}
                {filterConsignor !== 'all' && filterStatus === 'unpaid' && (
                    <div className="space-y-3">
                        {!activeShift && (
                            <div className="flex items-center gap-3 p-4 rounded-lg border border-warning/30 bg-warning/10 text-warning dark:text-warning-foreground animate-pulse">
                                <AlertTriangle className="h-5 w-5 shrink-0 text-warning dark:text-warning-foreground" />
                                <div className="text-sm font-medium">
                                    Sif kasir belum aktif. Silakan buka sif kasir terlebih dahulu untuk dapat memproses pelunasan dana ke penitip.
                                </div>
                            </div>
                        )}
                        <Card className={cn(
                            'border-warning/20 bg-warning/5 transition-colors duration-200',
                            !activeShift ? 'opacity-50 pointer-events-none' : ''
                        )}>
                            <CardHeader className="pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                <div>
                                    <CardTitle className="text-base font-bold text-warning dark:text-warning-foreground flex items-center gap-2">
                                        <CheckCircle className="h-5 w-5 text-warning dark:text-warning-foreground" />
                                        Proses Pelunasan: {filterConsignor}
                                    </CardTitle>
                                    <CardDescription className="text-warning/80 dark:text-warning-foreground/80">
                                        Tombol ini akan melunasi seluruh bagi hasil penjualan belum lunas pada rentang tanggal, menarik sisa stok, dan memotong ekspektasi kas sif kasir.
                                    </CardDescription>
                                </div>
                                <Button 
                                    onClick={handleSettleConsignment} 
                                    disabled={isSettling || kpis.totalPayout === 0 || !activeShift}
                                    className="bg-warning text-white hover:bg-warning/90 font-bold h-11 px-6"
                                >
                                    {isSettling ? (
                                        <>
                                            <Loader2 className="animate-spin mr-2 h-4 w-4" /> Memproses...
                                        </>
                                    ) : (
                                        <>
                                            <Wallet className="mr-2 h-4 w-4" /> Lunasi Bagi Hasil ({formatCurrency(kpis.totalPayout)})
                                        </>
                                    )}
                                </Button>
                            </CardHeader>
                        </Card>
                    </div>
                )}

                {/* KPI Summary Row */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">
                                {filterStatus === 'paid' ? 'Kuantitas Lunas' : 'Barang Masuk'}
                            </CardTitle>
                            <Package className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-light">
                                {filterStatus === 'paid' 
                                    ? kpis.totalOut.toLocaleString() 
                                    : kpis.totalIn.toLocaleString()
                                } <span className="text-xs text-muted-foreground font-normal">unit</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">
                                {filterStatus === 'paid' ? 'Total Transaksi Selesai' : `Barang Terjual (${filterStatus === 'unpaid' ? 'Belum Lunas' : 'Semua'})`}
                            </CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-light">
                                {filterStatus === 'paid'
                                    ? calculatedReportData.length.toLocaleString()
                                    : kpis.totalOut.toLocaleString()
                                } <span className="text-xs text-muted-foreground font-normal">
                                    {filterStatus === 'paid' ? 'kali' : 'unit'}
                                </span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Margin / Komisi Toko</CardTitle>
                            <DollarSign className="h-4 w-4 text-primary" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-light text-primary">{formatCurrency(kpis.totalComm)}</div>
                        </CardContent>
                    </Card>

                    <Card className="border-success/30 bg-success/5">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-success dark:text-success-foreground">
                                {filterStatus === 'paid' ? 'Total Terbayar Lunas' : 'Siap Bayar ke Penitip'}
                            </CardTitle>
                            <Wallet className="h-4 w-4 text-success dark:text-success-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-light text-success dark:text-success-foreground">{formatCurrency(kpis.totalPayout)}</div>
                        </CardContent>
                    </Card>
                </div>

                {/* Audit Table Card */}
                <Card className="flex-1 overflow-hidden">
                    <CardHeader>
                        <div className="flex flex-col gap-4">
                            <div>
                                <CardTitle>
                                    {filterStatus === 'paid' ? 'Buku Riwayat Pembayaran Konsinyasi' : 'Buku Pembagian Hasil Konsinyasi'}
                                </CardTitle>
                                <CardDescription>
                                    {filterStatus === 'paid' 
                                        ? 'Daftar audit penyerahan dana bagi hasil yang telah lunas dibayarkan kepada mitra penitip.' 
                                        : 'Daftar bagi hasil titipan barang berdasarkan mutasi stok dan penjualan real-time.'}
                                </CardDescription>
                            </div>

                            {/* Filters Bar */}
                            <div className="flex flex-col sm:flex-row items-center gap-2">
                                <DateRangeFilter date={date} setDate={setDate} />
                                <DeviceScopeFilter />

                                <Select value={filterStatus} onValueChange={setFilterStatus}>
                                    <SelectTrigger className="w-full sm:w-40">
                                        <SelectValue placeholder="Status Bayar" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="unpaid">Belum Lunas</SelectItem>
                                        <SelectItem value="paid">Sudah Lunas</SelectItem>
                                        <SelectItem value="all">Semua Status</SelectItem>
                                    </SelectContent>
                                </Select>
                                
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
                        {filterStatus === 'paid' ? (
                            // --- RENDER PAID PAYMENT LEDGER (PER DATE OF PAID) ---
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Tanggal Bayar</TableHead>
                                        <TableHead>Nama Penitip</TableHead>
                                        <TableHead>Nama Produk</TableHead>
                                        <TableHead className="text-right">Harga Jual</TableHead>
                                        <TableHead className="text-center">Kuantitas Lunas</TableHead>
                                        <TableHead className="text-center">Tipe Komisi</TableHead>
                                        <TableHead className="text-right">Komisi Toko</TableHead>
                                        <TableHead className="text-right font-bold text-success dark:text-success-foreground bg-success/5">Total Dibayar</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        <TableRow>
                                            <TableCell colSpan={8} className="text-center py-10">
                                                <Loader2 className="animate-spin mx-auto text-muted-foreground h-6 w-6" />
                                            </TableCell>
                                        </TableRow>
                                    ) : calculatedReportData.length > 0 ? (
                                        calculatedReportData.map((row) => (
                                            <TableRow key={row.key}>
                                                <TableCell>{format(new Date(row.settledDate), 'dd MMM yyyy')}</TableCell>
                                                <TableCell>{row.consignorName}</TableCell>
                                                <TableCell className="font-medium">{row.productName}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(row.price)}</TableCell>
                                                <TableCell className="text-center font-bold text-success dark:text-success-foreground">{row.qty} unit</TableCell>
                                                <TableCell className="text-center text-xs">
                                                    {row.commissionType === 'flat' ? (
                                                        <span className="bg-muted px-2 py-1 rounded">Rp {row.commissionValue.toLocaleString()} (Flat)</span>
                                                    ) : (
                                                        <span className="bg-muted px-2 py-1 rounded">{row.commissionValue}% (Pct)</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right text-muted-foreground">{formatCurrency(row.storeCommission)}</TableCell>
                                                <TableCell className="text-right font-bold text-success dark:text-success-foreground bg-success/5">
                                                    {formatCurrency(row.consignorShare)}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                                                Tidak ada riwayat pembayaran lunas pada periode ini.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        ) : (
                            // --- RENDER STANDARD UNPAID / ALL PRODUCT STOCK LEDGER ---
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
                                        <TableHead className="text-right font-bold text-success dark:text-success-foreground">Hak Penitip</TableHead>
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
                                                <TableCell className="font-medium">{row.consignorName}</TableCell>
                                                <TableCell className="font-medium">{row.productName}</TableCell>
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
                                                <TableCell className="text-right font-bold text-success dark:text-success-foreground bg-success/5">
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
                        )}
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}