
'use client';

import Link from 'next/link';
import { useState, useMemo } from 'react';
import { useStore } from '@/lib/store';
import { endOfDay, startOfDay, subDays, format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ArrowLeft, BarChart2, DollarSign, ReceiptText, Landmark, Search } from 'lucide-react';
import { exportSalesToExcel, exportSalesToPdf } from '@/lib/export';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Transaction } from '@/lib/types';
import { TransactionDetailDialog } from '@/components/TransactionDetailDialog';
import { DateRangeFilter, DateRangePreset } from '@/components/DateRangeFilter';


const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(amount);
};

export default function SalesReportPage() {
    const [range, setRange] = useState<DateRangePreset>('today');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
    const { transactions, storeConfig } = useStore();

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

    const filteredTransactions = useMemo(() => {
        return transactions.filter(tx => {
            const txDate = new Date(tx.created_at);
            const isInDateRange = txDate >= dateRange.from && txDate <= dateRange.to;
            const matchesSearch = searchTerm.trim() === '' || tx.invoice_number.toLowerCase().includes(searchTerm.toLowerCase());
            return tx.status === 'paid' && isInDateRange && matchesSearch;
        });
    }, [transactions, dateRange, searchTerm]);

    const totalRevenue = filteredTransactions.reduce((sum, tx) => sum + tx.total, 0);
    const totalSubtotal = filteredTransactions.reduce((sum, tx) => sum + tx.subtotal, 0);
    const totalTax = filteredTransactions.reduce((sum, tx) => sum + tx.tax_amount, 0);
    const totalCost = filteredTransactions.reduce((sum, tx) => {
        return sum + tx.items.reduce((itemSum, item) => {
            return itemSum + ((item.cost_snapshot || 0) * item.qty);
        }, 0);
    }, 0);
    const totalProfit = totalSubtotal - totalCost;

    const stats = [
        { title: 'Total Revenue', value: formatCurrency(totalRevenue), icon: DollarSign },
        { title: 'Total Profit', value: formatCurrency(totalProfit), icon: DollarSign },
        { title: 'Total Tax', value: formatCurrency(totalTax), icon: Landmark },
        { title: 'Transactions', value: filteredTransactions.length, icon: ReceiptText },
    ];
    
    const handleExcelExport = () => {
        if (storeConfig) {
            exportSalesToExcel(filteredTransactions, dateRange, storeConfig.store_name);
        } else {
            alert("Store configuration not found.");
        }
    };
    
    const handlePdfExport = () => {
        if (storeConfig) {
            exportSalesToPdf(filteredTransactions, dateRange, storeConfig.store_name);
        } else {
            alert("Store configuration not found.");
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
                <DateRangeFilter
                    range={range}
                    onRangeChange={setRange}
                    onExportExcel={handleExcelExport}
                    onExportPdf={handlePdfExport}
                    hasData={filteredTransactions.length > 0}
                />
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
                            <CardDescription>
                                Showing {filteredTransactions.length} transactions from {format(dateRange.from, 'PPP')} to {format(dateRange.to, 'PPP')}.
                            </CardDescription>
                        </div>
                         <div className="relative w-full md:w-64">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Search by invoice number..."
                                className="w-full pl-8"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
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
                            {filteredTransactions.length > 0 ? (
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
