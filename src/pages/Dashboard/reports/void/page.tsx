import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '@/lib/store';
import { format, startOfDay, endOfDay } from 'date-fns';
import { ArrowLeft, ArchiveX, FileDown, FileText, Loader2 } from 'lucide-react';
import React, { useState, useMemo } from 'react';
import { DateRange } from 'react-day-picker';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Transaction } from '@/lib/types';
import { DateRangeFilter } from '@/components/DateRangeFilter';
import { useToast } from '@/hooks/use-toast';
import TransactionDetailDialog from '@/components/TransactionDetailDialog';
import { NotificationBell } from '@/components/NotificationBell';
import { ThemeToggle } from '@/components/ThemeButtons';
import { exportVoidToExcel, exportVoidToPdf } from '@/lib/export';
import { useLoadTransactions } from '@/hooks/useLoadTransaction';
import { useDeviceScope } from '@/hooks/useDeviceScope';
import { DeviceScopeFilter } from '@/components/DeviceScopeFilter';

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(amount);
};

export default function VoidReportPage() {
    const { storeConfig } = useStore();
    const { toast } = useToast();
    const [date, setDate] = React.useState<DateRange | undefined>({
      from: startOfDay(new Date()),
      to: endOfDay(new Date()),
    });
    const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
    const nav = useNavigate();

    const { activeDeviceId } = useDeviceScope();
    const { transactions, isLoading } = useLoadTransactions(date, activeDeviceId);

    const voidedTransactions = useMemo(() => {
        if (!date?.from || !date?.to) return [];
        return transactions.filter(tx => {
            if (tx.status !== 'voided' || !tx.voided_at) return false;
            const txDate = new Date(tx.voided_at);
            return txDate >= date.from! && txDate <= date.to!;
        });
    }, [transactions, date]);
    
    const handleExcelExport = async () => {
        if (storeConfig && date?.from && date?.to) {
            await exportVoidToExcel(voidedTransactions, { from: date.from, to: date.to }, storeConfig.store_name);
        } else {
            toast({ variant: 'destructive', title: 'Export Failed', description: 'Store config or date range missing.' });
        }
    };

    const handlePdfExport = async () => {
        if (storeConfig && date?.from && date?.to) {
            await exportVoidToPdf(voidedTransactions, { from: date.from, to: date.to }, storeConfig.store_name);
        } else {
            toast({ variant: 'destructive', title: 'Export Failed', description: 'Store config or date range missing.' });
        }
    };

    return (
        <>
            <div className="flex min-h-screen w-full flex-col bg-muted/40">
               <header className="sticky top-0 flex h-12 items-center gap-4 border-b border-border/60 bg-background/80 px-4 backdrop-blur-md z-10">
                    <Button variant="outline" size="icon" className="shrink-0" asChild>
                        <Link to="#" onClick={() => nav(-1)}>
                            <ArrowLeft className="h-4 w-4" />
                            <span className="sr-only">Kembali ke Laporan</span>
                        </Link>
                    </Button>
                    <div className="flex-1">
                        <h1 className="text-lg font-semibold flex items-center gap-2">
                            <ArchiveX className="h-5 w-5" /> Laporan Void
                        </h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm" disabled={voidedTransactions.length === 0}>
                                <FileDown className="mr-2 h-4 w-2" />
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
                                <CardTitle>Transaksi Batal (Void)</CardTitle>
                                {date?.from && date?.to && (
                                    <CardDescription>
                                        Daftar transaksi yang dibatalkan dari {format(date.from, 'dd MMM yyyy')} s/d {format(date.to, 'dd MMM yyyy')}.
                                    </CardDescription>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <DateRangeFilter date={date} setDate={setDate} />
                                <DeviceScopeFilter />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Waktu</TableHead>
                                    <TableHead>Invoice</TableHead>
                                    <TableHead>Alasan</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-10"><Loader2 className="animate-spin mx-auto" /></TableCell>
                                    </TableRow>
                                ) : voidedTransactions.length > 0 ? (
                                    voidedTransactions.map((tx: Transaction) => (
                                        <TableRow key={tx.id} onClick={() => setSelectedTx(tx)} className="cursor-pointer">
                                            <TableCell>
                                                <div className="font-medium">{tx.voided_at ? format(new Date(tx.voided_at), 'PP') : '-'}</div>
                                                <div className="text-sm text-muted-foreground">{tx.voided_at ? format(new Date(tx.voided_at), 'p') : '-'}</div>
                                            </TableCell>
                                            <TableCell className="font-mono text-xs">{tx.invoice_number}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground italic">{tx.void_reason || 'Tanpa alasan.'}</TableCell>
                                            <TableCell className="text-right font-medium">{formatCurrency(tx.total)}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center">
                                            Tidak ada transaksi void pada periode ini.
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
