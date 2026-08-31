import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatIDR as formatCurrency } from "@/lib/format";
import { DateRange } from 'react-day-picker';
import { endOfDay, startOfDay, subDays, format } from 'date-fns';
import { ArrowLeft, BadgePercent, TicketPercent, Wallet, ReceiptText, PiggyBank, PieChart, FileDown, Printer } from 'lucide-react';
import { Bar, CartesianGrid, ComposedChart, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DateRangeFilter } from '@/components/DateRangeFilter';
import { DeviceScopeFilter } from '@/components/DeviceScopeFilter';
import { NotificationBell } from '@/components/NotificationBell';
import { ThemeToggle } from '@/components/ThemeButtons';
import { useLoadTransactions } from '@/hooks/useLoadTransaction';
import { useDeviceScope } from '@/hooks/useDeviceScope';
import { useStore } from '@/lib/store';
import { exportPromoPerformanceToExcel, buildPromoPerformancePdfBytes } from '@/lib/export';
import { Promotion, Transaction } from '@/lib/types';
import { PdfPreviewSheet } from '@/components/PdfPreviewSheet';
import { usePdfGeneration, PdfGeneratingOverlay } from '@/hooks/usePdfGeneration';
import { useToast } from '@/hooks/use-toast';

interface DiskonRow {
    id: string;
    name: string;
    type: string;
    transactions: number;
    totalDiscount: number;
    avgPerTx: number;
    sharePct: number;
}

interface VoucherRow {
    code: string;
    name: string;
    redeems: number;
    totalValue: number;
    quotaUsed: number;
    quotaTotal: number;
    status: string;
}

const describeRule = (rule?: Promotion) => {
    if (!rule) return 'Diskon Otomatis';
    switch (rule.kind) {
        case 'flat':
            return rule.discount_type === 'percentage' ? `Diskon ${rule.discount_value}%` : `Diskon ${formatCurrency(rule.discount_value || 0)}`;
        case 'bogo':
            return `Beli ${rule.buy_quantity} Gratis ${rule.free_quantity}`;
        case 'criteria':
        case 'conditional':
            return 'Syarat & Hadiah';
        default:
            return 'Diskon Otomatis';
    }
};

const CHART_COLORS = {
    auto: 'hsl(211 100% 42%)',
    manual: 'hsl(34 92% 48%)',
    voucher: 'hsl(280 60% 60%)',
};

// The engine persists promo_discount (auto + voucher + free value), manual_discount
// and applied_promos[] — voucher value is only stored per record inside applied_promos.
const discountBreakdown = (tx: Transaction) => {
    const applied = tx.applied_promos || [];
    const voucher = applied.filter(p => p.kind === 'voucher').reduce((s, p) => s + (p.amount || 0), 0);
    const manual = tx.manual_discount || 0;
    const total = tx.discount_total || (applied.reduce((s, p) => s + (p.amount || 0), 0) + manual);
    return {
        total,
        voucher,
        manual,
        auto: Math.max(0, total - voucher - manual),
    };
};

export default function PromoReportPage() {
    const [date, setDate] = useState<DateRange | undefined>({
        from: startOfDay(subDays(new Date(), 29)),
        to: endOfDay(new Date()),
    });
    const { storeConfig } = useStore();
    const { promos } = useStore();
    const nav = useNavigate();
    const { activeDeviceId } = useDeviceScope();
    const { transactions } = useLoadTransactions(date, activeDeviceId);
    const { toast } = useToast();
    const pdf = usePdfGeneration();

    const paidTx = useMemo(() => transactions.filter(tx => tx.status === 'paid' && tx.transaction_type !== 'return'), [transactions]);

    const kpis = useMemo(() => {
        let totalDiscount = 0;
        let autoDiscount = 0;
        let voucherDiscount = 0;
        let manualDiscount = 0;
        let grossSubtotal = 0;
        let promoTransactions = 0;
        let voucherRedemptions = 0;
        for (const tx of paidTx) {
            const b = discountBreakdown(tx);
            totalDiscount += b.total;
            grossSubtotal += tx.gross_subtotal ?? tx.subtotal ?? 0;
            autoDiscount += b.auto;
            voucherDiscount += b.voucher;
            manualDiscount += b.manual;
            if ((tx.applied_promos?.length || 0) > 0 || tx.voucher_code || (tx.manual_discount || 0) > 0 || (tx.discount_total || 0) > 0) promoTransactions++;
            if (tx.voucher_code) voucherRedemptions++;
        }
        const promoSharePct = grossSubtotal > 0 ? (totalDiscount / grossSubtotal) * 100 : 0;
        return { totalDiscount, autoDiscount, voucherDiscount, manualDiscount, promoSharePct, promoTransactions, voucherRedemptions };
    }, [paidTx]);

    const diskonRows = useMemo((): DiskonRow[] => {
        const rulesById = new Map(promos.map(p => [p.id, p]));
        const map = new Map<string, { name: string; key: string; transactions: number; total: number }>();
        for (const tx of paidTx) {
            const applied = tx.applied_promos || [];
            const b = discountBreakdown(tx);
            if (applied.length > 0) {
                for (const p of applied) {
                    if (p.kind === 'voucher') continue;
                    const existing = map.get(p.promo_id);
                    if (existing) {
                        existing.transactions++;
                        existing.total += p.amount || 0;
                    } else {
                        map.set(p.promo_id, { name: p.name, key: p.promo_id, transactions: 1, total: p.amount || 0 });
                    }
                }
                // Fallback: manual_discount field without applied entry (legacy/edge)
                if ((tx.manual_discount || 0) > 0 && !applied.some(p => p.kind === 'manual')) {
                    const key = 'manual';
                    const existing = map.get(key);
                    if (existing) { existing.transactions++; existing.total += tx.manual_discount || 0; }
                    else map.set(key, { name: 'Diskon Kasir', key, transactions: 1, total: tx.manual_discount || 0 });
                }
                // Fallback: auto remainder without applied entry
                if (b.auto > 0 && ![...map.keys()].some(k => k !== 'manual' && k !== '__unknown__')) {
                    // if no auto promo was counted but auto value exists, put to unknown to surface KPI
                    const key = '__unknown__';
                    const existing = map.get(key);
                    if (existing) { existing.transactions++; existing.total += b.auto; }
                    else map.set(key, { name: 'Diskon Otomatis', key, transactions: 1, total: b.auto });
                }
            } else if ((tx.discount_total || 0) > 0 || (tx.manual_discount || 0) > 0) {
                const b2 = b;
                if (b2.manual > 0) {
                    const key = 'manual';
                    const existing = map.get(key);
                    if (existing) { existing.transactions++; existing.total += b2.manual; }
                    else map.set(key, { name: 'Diskon Kasir', key, transactions: 1, total: b2.manual });
                }
                if (b2.auto > 0) {
                    const key = '__unknown__';
                    const existing = map.get(key);
                    if (existing) { existing.transactions++; existing.total += b2.auto; }
                    else map.set(key, { name: 'Diskon Otomatis', key, transactions: 1, total: b2.auto });
                }
                if (b2.total > 0 && map.size === 0) {
                    const key = '__unknown__';
                    map.set(key, { name: 'Diskon tanpa promo', key, transactions: 1, total: b2.total });
                }
            }
        }
        return [...map.values()]
            .map(r => {
                const type = r.key === 'manual' ? 'Manual Kasir'
                    : r.key === '__unknown__' ? 'Tidak teridentifikasi'
                    : describeRule(rulesById.get(r.key));
                return {
                    id: r.key,
                    name: r.name,
                    type,
                    transactions: r.transactions,
                    totalDiscount: r.total,
                    avgPerTx: r.transactions > 0 ? r.total / r.transactions : 0,
                    sharePct: kpis.totalDiscount > 0 ? (r.total / kpis.totalDiscount) * 100 : 0,
                };
            })
            .sort((a, b) => b.totalDiscount - a.totalDiscount);
    }, [paidTx, promos, kpis.totalDiscount]);

    const voucherRows = useMemo((): VoucherRow[] => {
        const map = new Map<string, { code: string; redeems: number; total: number }>();
        for (const tx of paidTx) {
            const code = (tx.voucher_code || '').toUpperCase();
            if (!code) continue;
            const value = discountBreakdown(tx).voucher;
            const existing = map.get(code);
            if (existing) {
                existing.redeems++;
                existing.total += value;
            } else {
                map.set(code, { code, redeems: 1, total: value });
            }
        }
        const rulesByCode = new Map(
            promos.filter(p => p.kind === 'voucher' && p.code).map(p => [String(p.code).toUpperCase(), p])
        );
        return [...map.values()]
            .map(v => {
                const rule = rulesByCode.get(v.code);
                const quotaUsed = v.redeems + (rule?.uses_count || 0);
                const quotaTotal = rule?.max_uses || 0;
                let status = 'Aktif';
                if (rule && rule.ends_at && new Date(rule.ends_at).getTime() < Date.now()) status = 'Kadaluarsa';
                else if (rule && !rule.is_active) status = 'Nonaktif';
                else if (quotaTotal > 0 && quotaUsed >= quotaTotal) status = 'Habis';
                return {
                    code: v.code,
                    name: rule?.name || v.code,
                    redeems: v.redeems,
                    totalValue: v.total,
                    quotaUsed,
                    quotaTotal,
                    status,
                };
            })
            .sort((a, b) => b.totalValue - a.totalValue);
    }, [paidTx, promos]);

    const dailyData = useMemo(() => {
        const map = new Map<string, { auto: number; manual: number; voucher: number }>();
        for (const tx of paidTx) {
            const day = format(new Date(tx.created_at), 'yyyy-MM-dd');
            const b = discountBreakdown(tx);
            const cur = map.get(day) || { auto: 0, manual: 0, voucher: 0 };
            cur.auto += b.auto;
            cur.voucher += b.voucher;
            cur.manual += b.manual;
            map.set(day, cur);
        }
        return [...map.entries()]
            .map(([key, v]) => ({
                key,
                label: format(new Date(key), 'dd MMM'),
                auto: Math.round(v.auto),
                manual: Math.round(v.manual),
                voucher: Math.round(v.voucher),
            }))
            .sort((a, b) => a.key.localeCompare(b.key));
    }, [paidTx]);

    const handleExcelExport = async () => {
        if (storeConfig && date?.from && date?.to) {
            await exportPromoPerformanceToExcel(kpis, diskonRows, voucherRows, { from: date.from, to: date.to }, storeConfig.store_name);
        } else {
            toast({ variant: 'destructive', title: 'Export gagal', description: 'Konfigurasi toko atau rentang tanggal tidak ditemukan.' });
        }
    };
    const handleCetak = async () => {
        if (!storeConfig || !date?.from || !date?.to) {
            toast({ variant: 'destructive', title: 'Export gagal', description: 'Konfigurasi toko atau rentang tanggal tidak ditemukan.' });
            return;
        }
        try {
            pdf.setTitle('Performa Promo');
            pdf.setFilename('promoperformance.pdf');
            pdf.start('Performa Promo');
            await new Promise(r => setTimeout(r, 30));
            const bytes = await buildPromoPerformancePdfBytes(kpis, diskonRows, voucherRows, { from: date.from, to: date.to }, storeConfig.store_name);
            pdf.finish(bytes as unknown as Uint8Array);
        } catch (e) {
            toast({ variant: 'destructive', title: 'Gagal cetak', description: String(e) });
        }
    };

    const stats = [
        { title: 'Total Diskon', value: formatCurrency(kpis.totalDiscount), icon: BadgePercent },
        { title: 'Diskon Otomatis', value: formatCurrency(kpis.autoDiscount), icon: PiggyBank },
        { title: 'Diskon Voucher', value: formatCurrency(kpis.voucherDiscount), icon: TicketPercent },
        { title: 'Diskon Manual', value: formatCurrency(kpis.manualDiscount), icon: Wallet },
        { title: '% Omzet Terdiskon', value: `${kpis.promoSharePct.toFixed(1)}%`, icon: PieChart },
        { title: 'Transaksi dgn Promo', value: kpis.promoTransactions.toString(), icon: ReceiptText },
        { title: 'Voucher Terpakai', value: kpis.voucherRedemptions.toString(), icon: TicketPercent },
    ];

    return (
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
                        <BadgePercent className="h-5 w-5" /> Performa Promo & Voucher
                    </h1>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={paidTx.length === 0} onClick={handleCetak}>
                        <Printer className="mr-2 h-4 w-4" /> Cetak
                    </Button>
                    <Button variant="outline" size="sm" disabled={paidTx.length === 0} onClick={handleExcelExport}>
                        <FileDown className="mr-2 h-4 w-4 text-success" /> Excel
                    </Button>
                    <NotificationBell />
                    <ThemeToggle />
                </div>
            </header>

            <main className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <DateRangeFilter date={date} setDate={setDate} preset='last30' />
                    <DeviceScopeFilter />
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {stats.map(stat => (
                        <Card key={stat.title}>
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

                <Tabs defaultValue="diskon">
                    <TabsList>
                        <TabsTrigger value="diskon">Diskon</TabsTrigger>
                        <TabsTrigger value="voucher">Voucher</TabsTrigger>
                    </TabsList>

                    <TabsContent value="diskon" className="mt-4 space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Tren Diskon Harian</CardTitle>
                                <CardDescription>Nilai diskon otomatis vs manual per hari.</CardDescription>
                            </CardHeader>
                            <CardContent className="h-72">
                                {dailyData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={dailyData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 0% / 0.08)" />
                                            <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} />
                                            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={70} tickFormatter={(v: number) => v >= 1000 ? `${Math.round(v / 1000)}rb` : `${v}`} />
                                            <Tooltip formatter={(value: number | string, name: string) => [formatCurrency(Number(value)), name === 'auto' ? 'Otomatis' : name === 'manual' ? 'Manual' : 'Voucher']} />
                                            <Legend formatter={(value: string) => value === 'auto' ? 'Otomatis' : value === 'manual' ? 'Manual' : 'Voucher'} />
                                            <Bar dataKey="auto" stackId="a" fill={CHART_COLORS.auto} />
                                            <Bar dataKey="voucher" stackId="a" fill={CHART_COLORS.voucher} />
                                            <Bar dataKey="manual" stackId="a" fill={CHART_COLORS.manual} />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex h-full items-center justify-center text-muted-foreground">Tidak ada data.</div>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Performa Diskon per Promo</CardTitle>
                                <CardDescription>Dampak setiap aturan diskon pada periode terpilih.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {diskonRows.length > 0 ? (
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="hover:bg-transparent">
                                                <TableHead>Promo</TableHead>
                                                <TableHead>Jenis</TableHead>
                                                <TableHead className="w-28 text-right">Transaksi</TableHead>
                                                <TableHead className="w-32 text-right">Total Diskon</TableHead>
                                                <TableHead className="w-32 text-right">Rata-rata</TableHead>
                                                <TableHead className="w-24 text-right">Kontribusi</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {diskonRows.map(row => (
                                                <TableRow key={row.id}>
                                                    <TableCell className="font-medium">{row.name}</TableCell>
                                                    <TableCell className="text-sm text-muted-foreground">{row.type}</TableCell>
                                                    <TableCell className="text-right tabular-nums">{row.transactions}</TableCell>
                                                    <TableCell className="text-right tabular-nums">{formatCurrency(row.totalDiscount)}</TableCell>
                                                    <TableCell className="text-right tabular-nums">{formatCurrency(row.avgPerTx)}</TableCell>
                                                    <TableCell className="text-right tabular-nums">{row.sharePct.toFixed(1)}%</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                ) : (
                                    <p className="py-8 text-center text-sm text-muted-foreground">Belum ada data diskon pada periode ini.</p>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="voucher" className="mt-4 space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Tren Voucher Harian</CardTitle>
                                <CardDescription>Nilai diskon voucher per hari.</CardDescription>
                            </CardHeader>
                            <CardContent className="h-72">
                                {dailyData.some(d => d.voucher > 0) ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={dailyData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 0% / 0.08)" />
                                            <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} />
                                            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={70} tickFormatter={(v: number) => v >= 1000 ? `${Math.round(v / 1000)}rb` : `${v}`} />
                                            <Tooltip formatter={(value: number | string) => formatCurrency(Number(value))} />
                                            <Bar dataKey="voucher" fill={CHART_COLORS.voucher} />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex h-full items-center justify-center text-muted-foreground">Belum ada pemakaian voucher pada periode ini.</div>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Pemakaian Voucher</CardTitle>
                                <CardDescription>Redemption dan nilai per kode voucher.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {voucherRows.length > 0 ? (
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="hover:bg-transparent">
                                                <TableHead>Kode</TableHead>
                                                <TableHead>Nama</TableHead>
                                                <TableHead className="w-20 text-right">Redeem</TableHead>
                                                <TableHead className="w-32 text-right">Total Nilai</TableHead>
                                                <TableHead className="w-24 text-right">Kuota</TableHead>
                                                <TableHead className="w-24 text-center">Status</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {voucherRows.map(row => (
                                                <TableRow key={row.code}>
                                                    <TableCell className="font-mono text-sm font-medium">{row.code}</TableCell>
                                                    <TableCell className="text-sm text-muted-foreground">{row.name}</TableCell>
                                                    <TableCell className="text-right tabular-nums">{row.redeems}</TableCell>
                                                    <TableCell className="text-right tabular-nums">{formatCurrency(row.totalValue)}</TableCell>
                                                    <TableCell className="text-right tabular-nums">{row.quotaTotal > 0 ? `${row.quotaUsed}/${row.quotaTotal}` : String(row.quotaUsed)}</TableCell>
                                                    <TableCell className="text-center">
                                                        <Badge variant={row.status === 'Aktif' ? 'success' : row.status === 'Habis' ? 'warning' : 'secondary'}>
                                                            {row.status}
                                                        </Badge>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                ) : (
                                    <p className="py-8 text-center text-sm text-muted-foreground">Belum ada pemakaian voucher pada periode ini.</p>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </main>
            <PdfPreviewSheet open={pdf.previewOpen} onOpenChange={pdf.setPreviewOpen} pdfBytes={pdf.pdfBytes} title={pdf.title} filename={pdf.filename} />
                    <PdfGeneratingOverlay open={pdf.open} onCancel={pdf.cancel} title={pdf.title} elapsedMs={pdf.elapsedMs} pageCount={pdf.pageCount} />
        </div>
    );
}