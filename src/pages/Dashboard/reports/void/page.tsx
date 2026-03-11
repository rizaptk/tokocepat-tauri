'use client';

import { Link } from 'react-router-dom';
import { useStore } from '@/lib/store';
import { format, startOfDay, endOfDay } from 'date-fns';
import { ArrowLeft, ArchiveX, FileDown, FileText } from 'lucide-react';
import React, { useState, useMemo } from 'react';
import { DateRange } from 'react-day-picker';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Transaction } from '@/lib/types';
import { DateRangeFilter } from '@/components/DateRangeFilter';
import { useToast } from '@/hooks/use-toast';
import { TransactionDetailDialog } from '@/components/TransactionDetailDialog';
import { NotificationBell } from '@/components/NotificationBell';
import { ThemeToggle } from '@/components/ThemeButtons';

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(amount);
};

export default function VoidReportPage() {
    const { transactions } = useStore();
    const { toast } = useToast();
    const [date, setDate] = React.useState<DateRange | undefined>({
      from: startOfDay(new Date()),
      to: endOfDay(new Date()),
    });
    const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

    const voidedTransactions = useMemo(() => {
        if (!date?.from || !date?.to) return [];
        return transactions.filter(tx => {
            if (tx.status !== 'voided' || !tx.voided_at) return false;
            const txDate = new Date(tx.voided_at);
            return txDate >= date.from! && txDate <= date.to!;
        });
    }, [transactions, date]);
    
    const handleExcelExport = () => {
        toast({ title: 'Coming Soon', description: 'Excel export for voided transactions is not yet available.' });
    };

    const handlePdfExport = () => {
        toast({ title: 'Coming Soon', description: 'PDF export for voided transactions is not yet available.' });
    };

    return (
        <>
            <div className="flex min-h-screen w-full flex-col bg-muted/40">
               <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6 z-10">
                    <Button variant="outline" size="icon" className="shrink-0" asChild>
                        <Link to="/dashboard/reports">
                            <ArrowLeft className="h-4 w-4" />
                            <span className="sr-only">Back to Reports</span>
                        </Link>
                    </Button>
                    <div className="flex-1">
                        <h1 className="text-lg font-semibold flex items-center gap-2">
                            <ArchiveX className="h-5 w-5" /> Void Report
                        </h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm" disabled={voidedTransactions.length === 0}>
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
                <Card>
                    <CardHeader>
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div>
                                <CardTitle>Voided Transactions</CardTitle>
                                {date?.from && date?.to && (
                                    <CardDescription>
                                        A log of all transactions that have been voided from {format(date.from, 'PPP')} to {format(date.to, 'PPP')}.
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
                                    <TableHead>Date</TableHead>
                                    <TableHead>Invoice</TableHead>
                                    <TableHead>Reason</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {voidedTransactions.length > 0 ? (
                                    voidedTransactions.map((tx: Transaction) => (
                                        <TableRow key={tx.id} onClick={() => setSelectedTx(tx)} className="cursor-pointer">
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
            <TransactionDetailDialog transaction={selectedTx} onOpenChange={(isOpen) => !isOpen && setSelectedTx(null)} />
        </>
    );
}
