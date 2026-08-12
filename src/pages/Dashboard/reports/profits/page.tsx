import { Link } from 'react-router-dom';
import * as React from 'react';
import { useState, useMemo, useEffect } from 'react';
import { DateRange } from 'react-day-picker';
import { endOfDay, startOfDay, subDays, format } from 'date-fns';
import { ArrowLeft, ShieldCheck, DollarSign, TrendingUp, Loader2, FileDown, Package, Wallet } from 'lucide-react';
import { exportAuditReportToExcel, exportAuditReportToPdf } from '@/lib/export';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Transaction } from '@/lib/types';
import { DateRangeFilter } from '@/components/DateRangeFilter';
import { getTransactionsByDateRange } from '@/services/transactionService';
import { useStore } from '@/lib/store';
import { useDeviceScope } from '@/hooks/useDeviceScope';
import { DeviceScopeFilter } from '@/components/DeviceScopeFilter';
import { NotificationBell } from '@/components/NotificationBell';
import { ThemeToggle } from '@/components/ThemeButtons';

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(amount);
};

export default function AuditReportPage() {
    const [date, setDate] = React.useState<DateRange | undefined>({
      from: startOfDay(subDays(new Date(), 29)),
      to: endOfDay(new Date()),
    });
    
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { storeConfig, shifts } = useStore();
    const { activeDeviceId } = useDeviceScope();

    useEffect(() => {
        if (!date?.from || !date?.to) return;
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const txData = await getTransactionsByDateRange(date.from!, date.to!, activeDeviceId);
                setTransactions(txData);
            } catch (err) {
                console.error("Gagal mengambil data transaksi:", err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [date, activeDeviceId]);

    // --- AUDIT LOGIC: Join Transactions to Shifts ---
    const auditData = useMemo(() => {
        if (!date?.from || !date?.to) return [];

        // 1. Get closed shifts in range
        const periodShifts = shifts.filter(s => {
            if (s.status !== 'closed' || !s.closed_at) return false;
            if (activeDeviceId && s.device && s.device !== activeDeviceId) return false;
            const d = new Date(s.closed_at);
            return d >= date.from! && d <= date.to!;
        });

        // 2. Map data per shift
        return periodShifts.map(shift => {
            const shiftTx = transactions.filter(tx => tx.shift_id === shift.id && tx.status === 'paid');
            
            const revenue = shiftTx.reduce((sum, tx) => sum + tx.total, 0);
            const subtotal = shiftTx.reduce((sum, tx) => sum + tx.subtotal, 0);
            
            // --- SPLIT INVENTORY COGS AND CONSIGNMENT PAYOUTS ---
            let standardHPP = 0;
            let consignmentPayout = 0;

            shiftTx.forEach(tx => {
                tx.items.forEach(i => {
                    const isCons = i.product_snapshot.is_consignment;
                    const costVal = (i.cost_snapshot || 0) * i.qty;
                    if (isCons) {
                        consignmentPayout += costVal;
                    } else {
                        standardHPP += costVal;
                    }
                });
            });

            // Profit = Subtotal (Omzet Netto) - Total Costs (COGS + Payouts)
            const paperProfit = subtotal - (standardHPP + consignmentPayout);
            const variance = shift.variance || 0;
            const actualProfit = paperProfit + variance; // Adjust profit by cash register variance

            return {
                shiftId: shift.id,
                date: shift.closed_at!,
                revenue,
                paperProfit,
                standardHPP,
                consignmentPayout,
                variance,
                actualProfit,
                txCount: shiftTx.length
            };
        }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [transactions, shifts, date, activeDeviceId]);

    const stats = useMemo(() => {
        const totalRevenue = auditData.reduce((sum, row) => sum + row.revenue, 0);
        const totalStandardHPP = auditData.reduce((sum, row) => sum + row.standardHPP, 0);
        const totalConsignmentPayout = auditData.reduce((sum, row) => sum + row.consignmentPayout, 0);
        const totalPaperProfit = auditData.reduce((sum, row) => sum + row.paperProfit, 0);
        const totalVariance = auditData.reduce((sum, row) => sum + row.variance, 0);
        const totalNetProfit = totalPaperProfit + totalVariance;

        return [
            { title: 'Total Omzet (Gross)', value: formatCurrency(totalRevenue), icon: DollarSign, color: '' },
            { title: 'HPP Inventori Toko', value: formatCurrency(totalStandardHPP), icon: Package, color: 'text-muted-foreground' },
            { title: 'Bagi Hasil Titipan', value: formatCurrency(totalConsignmentPayout), icon: Wallet, color: 'text-amber-600 dark:text-amber-400' },
            { title: 'Laba Bersih Riil', value: formatCurrency(totalNetProfit), icon: TrendingUp, color: 'text-primary' },
        ];
    }, [auditData]);

    return (
        <div className="flex min-h-screen w-full flex-col bg-muted/40">
           <header className="sticky top-0 flex h-12 items-center gap-4 border-b border-border/60 bg-background/80 px-4 backdrop-blur-md z-10">
                <Button variant="outline" size="icon" asChild><Link to="/dashboard/reports"><ArrowLeft className="h-4 w-4" /></Link></Button>
                <div className="flex-1"><h1 className="text-lg font-semibold flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Audit Laba & Kas</h1></div>
                <div className="flex items-center gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" disabled={auditData.length === 0}><FileDown className="mr-2 h-4 w-4" /> Ekspor</Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => date?.from && date?.to && exportAuditReportToExcel(auditData, {from: date.from, to: date.to }, storeConfig?.store_name || 'TokoCepat')}>Excel (.xlsx)</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => date?.from && date?.to && exportAuditReportToPdf(auditData, {from: date.from, to: date.to }, storeConfig?.store_name || 'TokoCepat')}>PDF (.pdf)</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <NotificationBell /><ThemeToggle />
                </div>
           </header>

          <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {stats.map((stat, i) => (
                    <Card key={i}>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                            <stat.icon className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent><div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div></CardContent>
                    </Card>
                ))}
            </div>

            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <CardTitle>Buku Audit</CardTitle>
                            <CardDescription>Rekonsiliasi margin penjualan, biaya modal, pengeluaran titipan, dan selisih kas fisik per sif.</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            <DateRangeFilter date={date} setDate={setDate} preset='last30' />
                            <DeviceScopeFilter />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Tanggal / Sif</TableHead>
                                <TableHead className="text-right">Omzet</TableHead>
                                <TableHead className="text-right">HPP Toko</TableHead>
                                <TableHead className="text-right">Bagi Hasil Titipan</TableHead>
                                <TableHead className="text-right">Margin Laba</TableHead>
                                <TableHead className="text-right">Selisih Kas</TableHead>
                                <TableHead className="text-right font-bold">Laba Bersih Riil</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={7} className="text-center py-10"><Loader2 className="animate-spin mx-auto"/></TableCell></TableRow>
                            ) : auditData.map((row, i) => (
                                <TableRow key={i}>
                                    <TableCell>
                                        <div className="font-medium">{format(new Date(row.date), 'PP')}</div>
                                        <div className="text-xs text-muted-foreground font-mono">{row.shiftId.substring(0,8)}</div>
                                    </TableCell>
                                    <TableCell className="text-right">{formatCurrency(row.revenue)}</TableCell>
                                    <TableCell className="text-right text-muted-foreground">{formatCurrency(row.standardHPP)}</TableCell>
                                    <TableCell className="text-right text-amber-600 dark:text-amber-400">{formatCurrency(row.consignmentPayout)}</TableCell>
                                    <TableCell className="text-right font-medium">{formatCurrency(row.paperProfit)}</TableCell>
                                    <TableCell className={`text-right ${row.variance < 0 ? 'text-destructive font-bold' : row.variance > 0 ? 'text-green-600' : ''}`}>
                                        {row.variance > 0 ? '+' : ''}{formatCurrency(row.variance)}
                                    </TableCell>
                                    <TableCell className="text-right font-bold bg-muted/30">{formatCurrency(row.actualProfit)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
          </main>
        </div>
    );
}