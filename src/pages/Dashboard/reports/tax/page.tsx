import { Link, useNavigate } from 'react-router-dom';
import { useState, useMemo, useEffect } from 'react';
import { DateRange } from 'react-day-picker';
import { endOfDay, startOfDay, subDays, format } from 'date-fns';
import { 
    ArrowLeft, Percent, Landmark, Receipt, FileDown, 
    Loader2, AlertCircle, History, Calendar, FileText 
} from 'lucide-react';
import { useStore } from '@/lib/store';
import { getTransactionsByDateRange } from '@/services/transactionService';
import { Transaction } from '@/lib/types';
// Import both export functions
import { exportTaxAuditToExcel, exportTaxSummaryToPdf } from '@/lib/export';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DateRangeFilter } from '@/components/DateRangeFilter';
import { ThemeToggle } from '@/components/ThemeButtons';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const formatCurrency = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);

export default function TaxReportPage() {
    const { storeConfig } = useStore();
    const [date, setDate] = useState<DateRange | undefined>({ from: startOfDay(subDays(new Date(), 29)), to: endOfDay(new Date()) });
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const nav = useNavigate();

    useEffect(() => {
        if (!date?.from || !date?.to) return;
        const fetch = async () => {
            setIsLoading(true);
            const data = await getTransactionsByDateRange(date.from!, date.to!);
            setTransactions(data);
            setIsLoading(false);
        };
        fetch();
    }, [date]);

    // --- 1. TAX RATE SUMMARY LOGIC ---
    const taxReport = useMemo(() => {
        if (!storeConfig) return { groups: [], totals: { taxable: 0, tax: 0, gross: 0, voidedTax: 0 } };
        const groups = new Map<number, { rate: number, taxableAmount: number, taxAmount: number }>();
        let voidedTax = 0;

        transactions.forEach(tx => {
            if (tx.status === 'voided') {
                voidedTax += tx.tax_amount;
                return;
            }
            tx.items.forEach(item => {
                let rate = storeConfig.tax_settings?.default_rate ?? storeConfig.tax_rate;
                const catOverride = storeConfig.tax_settings?.category_overrides.find(co => co.category_id === item.product_snapshot.category_id);
                if (catOverride) rate = catOverride.tax_rate;
                else if (item.product_snapshot.product_type === 'food_and_beverage' && storeConfig.tax_settings?.product_type_overrides.food_and_beverage !== undefined) {
                    rate = storeConfig.tax_settings.product_type_overrides.food_and_beverage;
                }

                const currentGroup = groups.get(rate) || { rate, taxableAmount: 0, taxAmount: 0 };
                groups.set(rate, {
                    rate,
                    taxableAmount: currentGroup.taxableAmount + item.subtotal,
                    taxAmount: currentGroup.taxAmount + (item.subtotal * rate)
                });
            });
        });
        const sortedGroups = Array.from(groups.values()).sort((a, b) => b.rate - a.rate);
        const taxable = sortedGroups.reduce((s, g) => s + g.taxableAmount, 0);
        const tax = sortedGroups.reduce((s, g) => s + g.taxAmount, 0);
        return { groups: sortedGroups, totals: { taxable, tax, gross: taxable + tax, voidedTax } };
    }, [transactions, storeConfig]);

    // --- 2. DAILY LEDGER LOGIC (Actual Current Liability) ---
    const dailySummary = useMemo(() => {
        const map = new Map<string, any>();
        transactions.forEach(tx => {
            const dateKey = format(new Date(tx.created_at), 'yyyy-MM-dd');
            const current = map.get(dateKey) || { 
                date: dateKey, taxableBase: 0, taxCollected: 0, taxVoided: 0, netTaxOwed: 0 
            };

            if (tx.status === 'paid') {
                current.taxableBase += tx.subtotal;
                current.taxCollected += tx.tax_amount;
                current.netTaxOwed += tx.tax_amount;
            } else if (tx.status === 'voided') {
                current.taxableBase -= tx.subtotal; // Reflect actual realized liability
                current.taxVoided += tx.tax_amount;
                current.netTaxOwed -= tx.tax_amount;
            }
            map.set(dateKey, current);
        });
        return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
    }, [transactions]);

    const handleExcelExport = async () => {
        if (storeConfig && date?.from && date?.to) {
            await exportTaxAuditToExcel(taxReport.groups, transactions, { from: date.from, to: date.to }, storeConfig.store_name);
        }
    };

    const handlePdfExport = async () => {
        if (storeConfig && date?.from && date?.to) {
            await exportTaxSummaryToPdf(dailySummary, { from: date.from, to: date.to }, storeConfig.store_name);
        }
    };

    return (
        <div className="flex min-h-screen w-full flex-col bg-muted/40">
            <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6 z-10">
                <Button variant="outline" size="icon" asChild><Link to="#" onClick={() => nav(-1)}><ArrowLeft className="h-4 w-4" /></Link></Button>
                <div className="flex-1">
                    <h1 className="text-lg font-semibold flex items-center gap-2"><Landmark className="h-5 w-5" /> Audit Kewajiban Pajak</h1>
                </div>
                <div className="flex items-center gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" disabled={transactions.length === 0}>
                                <FileDown className="mr-2 h-4 w-4" /> Ekspor
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={handleExcelExport}>
                                <FileDown className="mr-2 h-4 w-4 text-green-500" /> Audit Detail (.xlsx)
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={handlePdfExport}>
                                <FileText className="mr-2 h-4 w-4 text-red-400" /> Ringkasan Laporan (.pdf)
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <ThemeToggle />
                </div>
            </header>

            <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
                {/* KPI Summary Grid */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Total DPP (Net)</CardTitle>
                            <Receipt className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent><div className="text-2xl font-bold">{formatCurrency(taxReport.totals.taxable)}</div></CardContent>
                    </Card>
                    <Card className="border-primary/50">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Kewajiban Pajak</CardTitle>
                            <Percent className="h-4 w-4 text-primary" />
                        </CardHeader>
                        <CardContent><div className="text-2xl font-bold text-primary">{formatCurrency(taxReport.totals.tax)}</div></CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Kredit Pajak (Void)</CardTitle>
                            <History className="h-4 w-4 text-destructive" />
                        </CardHeader>
                        <CardContent><div className="text-2xl font-bold text-destructive">{formatCurrency(taxReport.totals.voidedTax)}</div></CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Periode Laporan</CardTitle>
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent><div className="text-sm font-medium">
                            {date?.from && format(date.from, 'MMM d')} - {date?.to && format(date.to, 'MMM d, yyyy')}
                        </div></CardContent>
                    </Card>
                </div>

                <div className="grid gap-6 lg:grid-cols-3">
                    {/* Left: Breakdown by Rate (Accounting Rules) */}
                    <Card className="lg:col-span-1">
                        <CardHeader><CardTitle className="text-base">Ringkasan per Tarif</CardTitle></CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Tarif</TableHead>
                                        <TableHead className="text-right">Tax</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {taxReport.groups.map((group, i) => (
                                        <TableRow key={i}>
                                            <TableCell className="font-medium">{(group.rate * 100).toFixed(0)}%</TableCell>
                                            <TableCell className="text-right">{formatCurrency(group.taxAmount)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    {/* Right: Daily Ledger (Audit Trail) */}
                    <Card className="lg:col-span-2">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="text-base">Buku Besar Pajak Harian</CardTitle>
                            <DateRangeFilter date={date} setDate={setDate} preset='last30' />
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Tanggal</TableHead>
                                        <TableHead className="text-right">DPP (Net)</TableHead>
                                        <TableHead className="text-right">Void</TableHead>
                                        <TableHead className="text-right">Net Owed</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        <TableRow><TableCell colSpan={4} className="text-center py-10"><Loader2 className="animate-spin mx-auto"/></TableCell></TableRow>
                                    ) : dailySummary.map((row, i) => (
                                        <TableRow key={i}>
                                            <TableCell className="font-medium">{format(new Date(row.date), 'dd MMM yyyy')}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(row.taxableBase)}</TableCell>
                                            <TableCell className="text-right text-destructive">
                                                {row.taxVoided > 0 ? `(${formatCurrency(row.taxVoided)})` : '-'}
                                            </TableCell>
                                            <TableCell className="text-right font-bold bg-muted/30">{formatCurrency(row.netTaxOwed)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>

                <div className="flex items-start gap-3 p-4 rounded-lg border bg-blue-500/10 border-blue-500/20 text-blue-700">
                    <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
                    <div className="text-sm">
                        <p className="font-bold">Info Kalkulasi Kewajiban:</p>
                        <p>Kewajiban dihitung dari (Total Pajak Terkumpul) dikurangi (Pajak dari Transaksi Void). Laporan ini memastikan Anda hanya membayar pajak atas penjualan yang terealisasi.</p>
                    </div>
                </div>
            </main>
        </div>
    );
}