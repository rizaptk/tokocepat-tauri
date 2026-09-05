import { Link, useNavigate } from 'react-router-dom';
import { formatIDR as formatCurrency } from "@/lib/format";
import * as React from 'react';
import { useState, useMemo, useRef } from 'react';
import { DateRange } from 'react-day-picker';
import { endOfDay, startOfDay, subDays, format } from 'date-fns';
import { ArrowLeft, BarChart2, DollarSign, ReceiptText, Landmark, Search, Loader2, FileDown, FileText, Package, Wallet, TrendingUp, BadgePercent, Printer } from 'lucide-react';
import { exportSalesToExcel, buildSalesPdfBytes } from '@/lib/export';
import { PdfPreviewSheet } from '@/components/PdfPreviewSheet';
import { usePdfGeneration, PdfGeneratingOverlay } from '@/hooks/usePdfGeneration';

// 1. Import Virtualizer
import { useVirtualizer } from '@tanstack/react-virtual';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Transaction } from '@/lib/types';
import TransactionDetailDialog from '@/components/TransactionDetailDialog';
import { DateRangeFilter } from '@/components/DateRangeFilter';
import { useStore } from '@/lib/store';
import { NotificationBell } from '@/components/NotificationBell';
import { ThemeToggle } from '@/components/ThemeButtons';
import { useLoadTransactions, type TxRow } from '@/hooks/useLoadTransaction';
import { useDeviceScope } from '@/hooks/useDeviceScope';
import { DeviceScopeFilter } from '@/components/DeviceScopeFilter';




// Pre-define the Memoized Row
const TransactionRow = React.memo(({
    tx,
    virtualRow,
    columnStyles,
    onClick
}: {
    tx: TxRow,
    virtualRow: any,
    columnStyles: any,
    onClick: (tx: TxRow) => void
}) => {
    // Aggregates precomputed in useLoadTransactions — no per-row items walk.
    const standardCost = tx._stdCost;
    const consignmentPayout = tx._payout;

    const txProfit = tx.subtotal - (tx.discount_total || 0) - standardCost - consignmentPayout;

    return (
        <div
            onClick={() => onClick(tx)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(tx); } }}
            role="button"
            tabIndex={0}
            className="flex items-center px-6 border-b hover:bg-muted/50 cursor-pointer transition-colors text-sm absolute top-0 left-0 w-full focus:outline-none focus-visible:bg-muted/70"
            style={{
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
            }}
        >
            <div className={columnStyles.waktu}>
                <div>{format(new Date(tx.created_at), 'dd MMM yyyy')}</div>
                <div className="text-xs text-muted-foreground">{format(new Date(tx.created_at), 'p')}</div>
            </div>
            <div className={`${columnStyles.invoice} font-mono text-xs`}>
                <div>{tx.invoice_number}</div>
                {(tx as any).is_wholesale && <span className="text-[10px] px-1 rounded bg-amber-100 text-amber-700">Grosir{(tx as any).customer_name_snapshot ? ` · ${(tx as any).customer_name_snapshot}` : ''}</span>}
                {(tx as any).payment_status && (tx as any).payment_status !== 'lunas' && <span className="text-[10px] px-1 rounded bg-destructive/10 text-destructive ml-1">{(tx as any).payment_status}</span>}
            </div>
            <div className={columnStyles.subtotal}>
                {formatCurrency(tx.subtotal)}
            </div>
            <div className={columnStyles.diskon}>
                {(tx.discount_total || 0) > 0 ? `-${formatCurrency(tx.discount_total || 0)}` : '—'}
            </div>
            <div className={`${columnStyles.hpp} text-destructive/80`}>
                {formatCurrency(standardCost)}
            </div>
            <div className={`${columnStyles.titipan} text-warning dark:text-warning-foreground`}>
                {formatCurrency(consignmentPayout)}
            </div>
            <div className={`${columnStyles.laba} text-success dark:text-success-foreground font-medium`}>
                {formatCurrency(txProfit)}
            </div>
            <div className={columnStyles.pajak}>
                {formatCurrency(tx.tax_amount)}
            </div>
            <div className={`${columnStyles.total} font-bold text-primary`}>
                {formatCurrency(tx.total)}
            </div>
        </div>
    );
});

TransactionRow.displayName = 'TransactionRow';


export default function SalesReportPage() {
    const [date, setDate] = React.useState<DateRange | undefined>({
      from: startOfDay(subDays(new Date(), 29)),
      to: endOfDay(new Date()),
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState<'all' | 'retail' | 'grosir' | 'piutang'>('all');
    const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
    const pdf = usePdfGeneration();
    const { storeConfig } = useStore();
    const nav = useNavigate();

    // 2. Setup Reference for the scrolling container
    const parentRef = useRef<HTMLDivElement>(null);

    const { activeDeviceId } = useDeviceScope();
    const {transactions, isLoading} = useLoadTransactions(date, activeDeviceId);

    // Deferred so keystrokes stay responsive while the big-range filter runs.
    const deferredSearch = React.useDeferredValue(searchTerm);

    const filteredTransactions = useMemo(() => {
        let paidTransactions = transactions.filter(tx => tx.status === 'paid');
        if (typeFilter === 'retail') paidTransactions = paidTransactions.filter(tx => !(tx as any).is_wholesale);
        else if (typeFilter === 'grosir') paidTransactions = paidTransactions.filter(tx => (tx as any).is_wholesale);
        else if (typeFilter === 'piutang') paidTransactions = paidTransactions.filter(tx => (tx as any).is_wholesale && (tx as any).payment_status && (tx as any).payment_status !== 'lunas');
        const q = deferredSearch.trim().toLowerCase();
        if (!q) return paidTransactions;
        return paidTransactions.filter(tx => tx._hay.includes(q));
    }, [transactions, deferredSearch, typeFilter]);

    const rowVirtualizer = useVirtualizer({
        count: filteredTransactions.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 44,
        overscan: 10,
    });

    // Define columns to ensure header and body are ALWAYS identical
    const columnStyles = {
        waktu: "w-[150px] shrink-0",
        invoice: "w-[130px] shrink-0",
        subtotal: "w-[125px] shrink-0 text-right tabular-nums",
        diskon: "w-[100px] shrink-0 text-right tabular-nums text-success dark:text-success-foreground",
        hpp: "w-[115px] shrink-0 text-right tabular-nums",
        titipan: "w-[115px] shrink-0 text-right tabular-nums",
        laba: "w-[115px] shrink-0 text-right tabular-nums",
        pajak: "w-[90px] shrink-0 text-right tabular-nums",
        total: "w-[125px] shrink-0 text-right pr-6 tabular-nums"
    };

    const stats = useMemo(() => {
        const paidTransactions = transactions.filter(tx => tx.status === 'paid');
        let totalRevenue = 0;
        let totalSubtotal = 0;
        let totalTax = 0;
        let totalStandardCost = 0;
        let totalConsignmentPayout = 0;
        let totalDiscount = 0;

        // Scalar pass — per-tx costs precomputed in useLoadTransactions.
        for (const tx of paidTransactions) {
            totalRevenue += tx.total;
            totalSubtotal += tx.subtotal;
            totalTax += tx.tax_amount;
            totalDiscount += tx.discount_total || 0;
            totalStandardCost += tx._stdCost;
            totalConsignmentPayout += tx._payout;
        }

        const totalProfit = totalSubtotal - totalDiscount - totalStandardCost - totalConsignmentPayout;

        return [
            { title: 'Total Omzet', value: formatCurrency(totalRevenue), icon: DollarSign },
            { title: 'Total Diskon', value: formatCurrency(totalDiscount), icon: BadgePercent },
            { title: 'HPP Standar Toko', value: formatCurrency(totalStandardCost), icon: Package },
            { title: 'Bagi Hasil Titipan', value: formatCurrency(totalConsignmentPayout), icon: Wallet },
            { title: 'Margin Laba Kotor', value: formatCurrency(totalProfit), icon: TrendingUp },
            { title: 'Total Pajak', value: formatCurrency(totalTax), icon: Landmark },
            { title: 'Transaksi', value: paidTransactions.length.toString(), icon: ReceiptText },
        ];
    }, [transactions]);
    
    const handleExcelExport = async () => {
        const paidTransactions = transactions.filter(tx => tx.status === 'paid');
        if (storeConfig && date?.from && date?.to) {
            await exportSalesToExcel(paidTransactions, {from: date.from, to: date.to }, storeConfig.store_name);
        } else {
            alert("Konfigurasi toko atau periode tidak ditemukan.");
        }
    };
    
    const handleCetak = () => {
        const paidTransactions = transactions.filter(tx => tx.status === 'paid');
        if (storeConfig && date?.from && date?.to) {
            pdf.setTitle('Laporan Penjualan');
            pdf.setFilename('laporan_penjualan.pdf');
            pdf.setPageCount(paidTransactions.length);
            pdf.start('Laporan Penjualan');
            queueMicrotask(async () => {
                try {
                    const bytes = await buildSalesPdfBytes(paidTransactions, {from: date.from!, to: date.to! }, storeConfig.store_name);
                    pdf.finish(bytes);
                } catch (e) { pdf.fail(e); }
            });
        } else {
            alert("Konfigurasi toko atau periode tidak ditemukan.");
        }
    }

    const handleRowClick = React.useCallback((tx: Transaction) => {
        setSelectedTx(tx);
    }, []);

    return (
        <>
        <div className="flex min-h-screen w-full flex-col bg-muted/40">
           <header className="sticky top-0 flex h-10 items-center gap-4 border-b border-border/60 bg-background/80 px-4 backdrop-blur-md z-20">
                <Button variant="outline" size="icon" className="shrink-0" asChild>
                    <Link to="#" onClick={() => nav(-1)}>
                        <ArrowLeft className="h-4 w-4" />
                        <span className="sr-only">Kembali ke Laporan</span>
                    </Link>
                </Button>
                <div className="flex-1">
                    <h1 className="text-lg font-semibold flex items-center gap-2">
                        <BarChart2 className="h-5 w-5" /> Laporan Penjualan
                    </h1>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                        <Button variant="outline" size="sm" onClick={handleCetak} disabled={transactions.length === 0}><Printer className="mr-2 h-4 w-4" /> Cetak</Button>
                        <Button variant="outline" size="sm" onClick={handleExcelExport} disabled={transactions.length === 0}><FileDown className="mr-2 h-4 w-4 text-green-600" /> Excel</Button>
                    </div>
                    <PdfPreviewSheet open={pdf.previewOpen} onOpenChange={pdf.setPreviewOpen} pdfBytes={pdf.pdfBytes} title={pdf.title} filename={pdf.filename} />
                    <PdfGeneratingOverlay open={pdf.open} onCancel={pdf.cancel} title={pdf.title} elapsedMs={pdf.elapsedMs} pageCount={pdf.pageCount} />
                    <NotificationBell />
                    <ThemeToggle />
                </div>
           </header>
          <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {stats.map((stat, index) => (
                    <Card key={index}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                            <stat.icon className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-light">{stat.value}</div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Card className="flex-1 flex flex-col overflow-hidden mb-4">
                <CardHeader className="shrink-0">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <CardTitle>Detail Transaksi</CardTitle>
                            <CardDescription>
                                Menampilkan {filteredTransactions.length} transaksi.
                            </CardDescription>
                        </div>
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                            <DateRangeFilter date={date} setDate={setDate} preset='last30' />
                            <DeviceScopeFilter />
                            <Select value={typeFilter} onValueChange={v => setTypeFilter(v as any)}>
                                <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Tipe" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Semua</SelectItem>
                                    <SelectItem value="retail">Retail</SelectItem>
                                    <SelectItem value="grosir">Grosir</SelectItem>
                                    <SelectItem value="piutang">Piutang</SelectItem>
                                </SelectContent>
                            </Select>
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="search"
                                    placeholder="Cari invoice / pelanggan..."
                                    className="pl-8 w-full sm:w-64"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="py-0 px-6 flex-1 flex flex-col relative overflow-hidden">
                    {/* Locked header + body into one horizontal scroll so columns stay aligned */}
                    <div className="flex-1 min-h-0 overflow-x-auto">
                        <div className="flex min-w-full h-full flex-col">
                    {/* TABLE HEADER (Separated to stay static) */}
                    <div className="w-full border-b shrink-0">
                        <div className="flex items-center h-8 px-6 text-xs font-medium uppercase tracking-wider text-muted-foreground hover:bg-muted/50">
                            <div className={columnStyles.waktu}>Waktu</div>
                            <div className={columnStyles.invoice}>Invoice</div>
                            <div className={columnStyles.subtotal}>Subtotal</div>
                            <div className={columnStyles.diskon}>Diskon</div>
                            <div className={columnStyles.hpp}>HPP Toko</div>
                            <div className={columnStyles.titipan}>Bagi Hasil</div>
                            <div className={columnStyles.laba}>Laba</div>
                            <div className={columnStyles.pajak}>Pajak</div>
                            <div className={columnStyles.total}>Total</div>
                        </div>
                    </div>

                    {/* VIRTUALIZED BODY CONTAINER */}
                    <div
                        ref={parentRef}
                        className="flex-1 overflow-y-auto scrollbar-thin relative"
                    >
                        <div
                            style={{
                                height: `${rowVirtualizer.getTotalSize()}px`,
                                width: '100%',
                                position: 'relative',
                            }}
                        >
                            {isLoading ? (
                                <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto"/></div>
                            ) : filteredTransactions.length > 0 ? (
                                rowVirtualizer.getVirtualItems().map((virtualRow) => 
                                <TransactionRow
                                    key={filteredTransactions[virtualRow.index].id}
                                    tx={filteredTransactions[virtualRow.index]}
                                    virtualRow={virtualRow}
                                    columnStyles={columnStyles}
                                    onClick={handleRowClick}
                                />
                                )
                            ) : (
                                <div className="p-20 text-center text-muted-foreground">Tidak ada data.</div>
                            )}
                        </div>
                    </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
          </main>
        </div>
        <TransactionDetailDialog transaction={selectedTx} onOpenChange={(isOpen) => !isOpen && setSelectedTx(null)} />
        </>
    );
}