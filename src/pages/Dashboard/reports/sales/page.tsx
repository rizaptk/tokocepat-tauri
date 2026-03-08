'use client';

import { Link } from 'react-router-dom';
import * as React from 'react';
import { useState, useMemo, useEffect } from 'react';
import { DateRange } from 'react-day-picker';
import { endOfDay, startOfDay, subDays, format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ArrowLeft, BarChart2, DollarSign, ReceiptText, Landmark, Search, Loader2, FileDown, FileText } from 'lucide-react';
import { exportSalesToExcel, exportSalesToPdf } from '@/lib/export';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Transaction } from '@/lib/types';
import { TransactionDetailDialog } from '@/components/TransactionDetailDialog';
import { DateRangeFilter } from '@/components/DateRangeFilter';
import { getTransactionsByDateRange } from '@/services/transactionService';
import { useStore } from '@/lib/store';
import { NotificationBell } from '@/components/NotificationBell';


const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(amount);
};

export default function SalesReportPage() {
    const [date, setDate] = React.useState<DateRange | undefined>({
      from: startOfDay(subDays(new Date(), 29)),
      to: endOfDay(new Date()),
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { storeConfig } = useStore();

    useEffect(() => {
        if (!date?.from || !date?.to) return;
        const fetchTransactions = async () => {
            setIsLoading(true);
            const data = await getTransactionsByDateRange(date.from!, date.to!);
            setTransactions(data);
            setIsLoading(false);
        };
        fetchTransactions();
    }, [date]);

    const filteredTransactions = useMemo(() => {
        const paidTransactions = transactions.filter(tx => tx.status === 'paid');
        if (!searchTerm.trim()) return paidTransactions;
        return paidTransactions.filter(tx => 
            tx.invoice_number.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [transactions, searchTerm]);

    const stats = useMemo(() => {
        const paidTransactions = transactions.filter(tx => tx.status === 'paid');
        const totalRevenue = paidTransactions.reduce((sum, tx) => sum + tx.total, 0);
        const totalSubtotal = paidTransactions.reduce((sum, tx) => sum + tx.subtotal, 0);
        const totalTax = paidTransactions.reduce((sum, tx) => sum + tx.tax_amount, 0);
        const totalCost = paidTransactions.reduce((sum, tx) => {
            return sum + tx.items.reduce((itemSum, item) => {
                return itemSum + ((item.cost_snapshot || 0) * item.qty);
            }, 0);
        }, 0);
        const totalProfit = totalSubtotal - totalCost;

        return [
            { title: 'Total Revenue', value: formatCurrency(totalRevenue), icon: DollarSign },
            { title: 'Total Profit', value: formatCurrency(totalProfit), icon: DollarSign },
            { title: 'Total Tax', value: formatCurrency(totalTax), icon: Landmark },
            { title: 'Transactions', value: paidTransactions.length, icon: ReceiptText },
        ];
    }, [transactions]);
    
    const handleExcelExport = () => {
        const paidTransactions = transactions.filter(tx => tx.status === 'paid');
        if (storeConfig && date?.from && date?.to) {
            exportSalesToExcel(paidTransactions, {from: date.from, to: date.to }, storeConfig.store_name);
        } else {
            alert("Store configuration or date range not found.");
        }
    };
    
    const handlePdfExport = () => {
        const paidTransactions = transactions.filter(tx => tx.status === 'paid');
        if (storeConfig && date?.from && date?.to) {
            exportSalesToPdf(paidTransactions, {from: date.from, to: date.to }, storeConfig.store_name);
        } else {
            alert("Store configuration or date range not found.");
        }
    }

    return (
        <>
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
                        <BarChart2 className="h-5 w-5" /> Sales Report
                    </h1>
                </div>
                <div className="flex items-center gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" disabled={transactions.length === 0}>
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
                            <div className="text-2xl font-bold">{stat.value}</div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <CardTitle>Transaction Details</CardTitle>
                            {date?.from && date?.to && (
                                <CardDescription>
                                    Showing {transactions.filter(t => t.status === 'paid').length} transactions from {format(date.from, 'PPP')} to {format(date.to, 'PPP')}.
                                </CardDescription>
                            )}
                        </div>
                         <div className="flex flex-col sm:flex-row items-center gap-2">
                            <DateRangeFilter date={date} setDate={setDate} />
                             <div className="relative w-full sm:w-auto">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="search"
                                    placeholder="Search by invoice..."
                                    className="w-full pl-8 sm:w-64"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Invoice</TableHead>
                                <TableHead className="text-right">Subtotal</TableHead>
                                <TableHead className="text-right">Cost</TableHead>
                                <TableHead className="text-right">Profit</TableHead>
                                <TableHead className="text-right">Tax</TableHead>
                                <TableHead className="text-right">Total</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={7} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                            ) : filteredTransactions.length > 0 ? (
                                filteredTransactions.map((tx: Transaction) => {
                                    const txCost = tx.items.reduce((itemSum, item) => itemSum + ((item.cost_snapshot || 0) * item.qty), 0);
                                    const txProfit = tx.subtotal - txCost;
                                    return (
                                    <TableRow key={tx.id} onClick={() => setSelectedTx(tx)} className="cursor-pointer">
                                        <TableCell>
                                            <div className="font-medium">{format(new Date(tx.created_at), 'PP')}</div>
                                            <div className="text-sm text-muted-foreground">{format(new Date(tx.created_at), 'p')}</div>
                                        </TableCell>
                                        <TableCell className="font-mono text-xs">{tx.invoice_number}</TableCell>
                                        <TableCell className="text-right font-medium">{formatCurrency(tx.subtotal)}</TableCell>
                                        <TableCell className="text-right font-medium text-destructive">{formatCurrency(txCost)}</TableCell>
                                        <TableCell className="text-right font-medium text-green-600">{formatCurrency(txProfit)}</TableCell>
                                        <TableCell className="text-right font-medium">{formatCurrency(tx.tax_amount)}</TableCell>
                                        <TableCell className="text-right font-bold">{formatCurrency(tx.total)}</TableCell>
                                    </TableRow>
                                    )
                                })
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-24 text-center">
                                        No transactions in this period.
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
