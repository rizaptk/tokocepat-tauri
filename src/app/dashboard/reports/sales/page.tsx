
'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useStore } from '@/lib/store';
import { endOfDay, startOfDay, subDays, format } from 'date-fns';
import { ArrowLeft, BarChart2, DollarSign, ReceiptText } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Transaction } from '@/lib/types';

type DateRangePreset = 'today' | 'last7' | 'last30';

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(amount);
};

export default function SalesReportPage() {
    const [range, setRange] = useState<DateRangePreset>('today');
    const { transactions } = useStore();

    const dateRange = (() => {
        const now = new Date();
        switch (range) {
            case 'today':
                return { from: startOfDay(now), to: endOfDay(now) };
            case 'last7':
                return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
            case 'last30':
                return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
            default:
                return { from: startOfDay(now), to: endOfDay(now) };
        }
    })();

    const filteredTransactions = transactions.filter(tx => {
        const txDate = new Date(tx.created_at);
        return txDate >= dateRange.from && txDate <= dateRange.to && tx.status === 'paid';
    });

    const totalRevenue = filteredTransactions.reduce((sum, tx) => sum + tx.total, 0);
    const totalCost = filteredTransactions.reduce((sum, tx) => {
        return sum + tx.items.reduce((itemSum, item) => {
            return itemSum + ((item.cost_snapshot || 0) * item.qty);
        }, 0);
    }, 0);
    const totalProfit = totalRevenue - totalCost;

    const stats = [
        { title: 'Total Revenue', value: formatCurrency(totalRevenue), icon: DollarSign },
        { title: 'Total Profit', value: formatCurrency(totalProfit), icon: DollarSign },
        { title: 'Transactions', value: filteredTransactions.length, icon: ReceiptText },
    ];

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
                        <BarChart2 className="h-5 w-5" /> Sales Report
                    </h1>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant={range === 'today' ? 'default' : 'outline'} size="sm" onClick={() => setRange('today')}>Today</Button>
                    <Button variant={range === 'last7' ? 'default' : 'outline'} size="sm" onClick={() => setRange('last7')}>Last 7 Days</Button>
                    <Button variant={range === 'last30' ? 'default' : 'outline'} size="sm" onClick={() => setRange('last30')}>Last 30 Days</Button>
                </div>
           </header>
          <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
            <div className="grid gap-4 md:grid-cols-3">
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
                    <CardTitle>Transaction Details</CardTitle>
                    <CardDescription>
                        Showing {filteredTransactions.length} transactions from {format(dateRange.from, 'PPP')} to {format(dateRange.to, 'PPP')}.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Invoice</TableHead>
                                <TableHead className="text-right">Items</TableHead>
                                <TableHead className="text-right">Total</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredTransactions.length > 0 ? (
                                filteredTransactions.map((tx: Transaction) => (
                                    <TableRow key={tx.id}>
                                        <TableCell>
                                            <div className="font-medium">{format(new Date(tx.created_at), 'PP')}</div>
                                            <div className="text-sm text-muted-foreground">{format(new Date(tx.created_at), 'p')}</div>
                                        </TableCell>
                                        <TableCell className="font-mono text-xs">{tx.invoice_number}</TableCell>
                                        <TableCell className="text-right">{tx.items.reduce((sum, item) => sum + item.qty, 0)}</TableCell>
                                        <TableCell className="text-right font-medium">{formatCurrency(tx.total)}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">
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
    );
}
