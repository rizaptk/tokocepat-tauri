'use client';

import Link from 'next/link';
import { useStore } from '@/lib/store';
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ArrowLeft, ArchiveX } from 'lucide-react';
import { useState, useMemo } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Transaction } from '@/lib/types';
import { DateRangeFilter, DateRangePreset } from '@/components/DateRangeFilter';
import { useToast } from '@/hooks/use-toast';

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(amount);
};

export default function VoidReportPage() {
    const { transactions, storeConfig } = useStore();
    const { toast } = useToast();
    const [range, setRange] = useState<DateRangePreset>('today');

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

    const voidedTransactions = useMemo(() => {
        return transactions.filter(tx => {
            if (tx.status !== 'voided' || !tx.voided_at) return false;
            const txDate = new Date(tx.voided_at);
            return txDate >= dateRange.from && txDate <= dateRange.to;
        });
    }, [transactions, dateRange]);
    
    const handleExcelExport = () => {
        toast({ title: 'Coming Soon', description: 'Excel export for voided transactions is not yet available.' });
    };

    const handlePdfExport = () => {
        toast({ title: 'Coming Soon', description: 'PDF export for voided transactions is not yet available.' });
    };

    return (
        <div className="flex min-h-screen w-full flex-col bg-muted/40">
           <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6 z-10">
                <Button variant="outline" size="icon" className="shrink-0" asChild>
                    <Link href="/dashboard/reports">
                        <ArrowLeft className="h-4 w-4" />
                        <span className="sr-only">Back to Reports</span>
                    </Link>
                </Button>
                <div className="flex-1">
                    <h1 className="text-lg font-semibold flex items-center gap-2">
                        <ArchiveX className="h-5 w-5" /> Void Report
                    </h1>
                </div>
                 <DateRangeFilter
                    range={range}
                    onRangeChange={setRange}
                    onExportExcel={handleExcelExport}
                    onExportPdf={handlePdfExport}
                    hasData={voidedTransactions.length > 0}
                />
           </header>
          <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
            <Card>
                <CardHeader>
                    <CardTitle>Voided Transactions</CardTitle>
                    <CardDescription>
                        A log of all transactions that have been voided from {format(dateRange.from, 'PPP')} to {format(dateRange.to, 'PPP')}.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Invoice</TableHead>
                                <TableHead>Reason</TableHead>
                                <TableHead className="text-right">Total</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {voidedTransactions.length > 0 ? (
                                voidedTransactions.map((tx: Transaction) => (
                                    <TableRow key={tx.id}>
                                        <TableCell>
                                            <div className="font-medium">{tx.voided_at ? format(new Date(tx.voided_at), 'PP') : '-'}</div>
                                            <div className="text-sm text-muted-foreground">{tx.voided_at ? format(new Date(tx.voided_at), 'p') : '-'}</div>
                                        </TableCell>
                                        <TableCell className="font-mono text-xs">{tx.invoice_number}</TableCell>
                                        <TableCell className="text-sm text-muted-foreground italic">{tx.void_reason || 'No reason provided.'}</TableCell>
                                        <TableCell className="text-right font-medium">{formatCurrency(tx.total)}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">
                                        No voided transactions found in this period.
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
