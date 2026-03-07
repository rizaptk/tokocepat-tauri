'use client';

import React, { useMemo, useState } from 'react';
import { DateRange } from 'react-day-picker';
import { format, isSameDay, differenceInDays, addDays, startOfDay, endOfDay } from 'date-fns';
import { Product, Transaction, Shift, StoreConfig, Category, RawIngredient, StockMovement } from '@/lib/types';
import { DateRangeFilter } from '@/components/DateRangeFilter';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from "@/components/ui/chart";
import { Bar, ComposedChart, CartesianGrid, XAxis, YAxis, Area } from "recharts";
import { DollarSign, LineChart, ShoppingBag, CheckCircle, Package } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

type ReportData = {
    products: Product[];
    transactions: Transaction[];
    shifts: Shift[];
    storeConfig: StoreConfig | null;
    categories: Category[];
    rawIngredients: RawIngredient[];
    stockMovements: StockMovement[];
}

interface ReportViewProps {
    data: ReportData;
    onReset: () => void;
}

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
};


export default function ReportView({ data, onReset }: ReportViewProps) {
    const { products, transactions, shifts, storeConfig, categories, rawIngredients, stockMovements } = data;

    const [date, setDate] = React.useState<DateRange | undefined>({
      from: startOfDay(new Date()),
      to: endOfDay(new Date()),
    });

    const filteredTransactions = useMemo(() => {
        if (!date?.from) return [];
        return transactions.filter(tx => {
            const txDate = new Date(tx.created_at);
            return tx.status === 'paid' && txDate >= date.from! && txDate <= (date.to || date.from!);
        });
    }, [date, transactions]);
    
    // --- KPIs ---
    const { totalRevenue, totalProfit, totalTransactions } = useMemo(() => {
        const revenue = filteredTransactions.reduce((sum, tx) => sum + tx.total, 0);
        const profit = filteredTransactions.reduce((sum, tx) => {
            const cost = tx.items.reduce((itemSum, item) => itemSum + ((item.cost_snapshot || 0) * item.qty), 0);
            return sum + (tx.subtotal - cost);
        }, 0);
        
        return {
            totalRevenue: revenue,
            totalProfit: profit,
            totalTransactions: filteredTransactions.length,
        }
    }, [filteredTransactions]);

    // --- Chart Data ---
    const chartData = useMemo(() => {
        if (!date?.from) return [];

        const isSingleDay = date.from && date.to ? isSameDay(date.from, date.to) : true;

        if (isSingleDay) {
            // HOURLY
            const data = Array.from({ length: 24 }, (_, i) => ({
                name: `${String(i).padStart(2, '0')}`,
                sales: 0,
                profit: 0,
            }));
            filteredTransactions.forEach(tx => {
                const hour = new Date(tx.created_at).getHours();
                const profit = tx.subtotal - tx.items.reduce((sum, item) => sum + (item.cost_snapshot || 0) * item.qty, 0);
                data[hour].sales += tx.total;
                data[hour].profit += profit;
            });
            return data;
        } else {
            // DAILY
            const data: { [key: string]: { name: string, sales: number, profit: number } } = {};
            const dayCount = differenceInDays(date.to!, date.from!) + 1;

            for (let i = 0; i < dayCount; i++) {
                const currentDay = addDays(date.from!, i);
                const dayKey = format(currentDay, 'yyyy-MM-dd');
                data[dayKey] = {
                    name: format(currentDay, 'MMM d'),
                    sales: 0,
                    profit: 0,
                };
            }

            filteredTransactions.forEach(tx => {
                const dayKey = format(new Date(tx.created_at), 'yyyy-MM-dd');
                const profit = tx.subtotal - tx.items.reduce((sum, item) => sum + (item.cost_snapshot || 0) * item.qty, 0);
                if (data[dayKey]) {
                    data[dayKey].sales += tx.total;
                    data[dayKey].profit += profit;
                }
            });
            return Object.values(data);
        }
    }, [date, filteredTransactions]);

    const chartConfig = {
        sales: { label: "Sales", color: "hsl(var(--primary))" },
        profit: { label: "Profit", color: "hsl(var(--success))" }
    } satisfies ChartConfig;

    // --- Top Selling Products ---
    const topSellingProducts = useMemo(() => {
        const productSales = new Map<string, { name: string; quantity: number }>();
        filteredTransactions.forEach(tx => {
            tx.items.forEach(item => {
                const productId = item.product_snapshot.id;
                const currentSale = productSales.get(productId) || { name: item.product_snapshot.name, quantity: 0 };
                currentSale.quantity += item.qty;
                productSales.set(productId, currentSale);
            });
        });
        return Array.from(productSales.values())
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 5);
    }, [filteredTransactions]);

    return (
        <ScrollArea className="h-full">
            <div className="p-4 md:p-8 space-y-8">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                     <div>
                        <h1 className="text-2xl font-bold tracking-tight">{storeConfig?.store_name || 'Store Report'}</h1>
                        <p className="text-muted-foreground">Read-only report generated from backup file.</p>
                    </div>
                    <Button variant="outline" onClick={onReset}>Load Another File</Button>
                </div>

                <Separator />
                
                {/* KPI Summary */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card> <CardHeader><CardTitle className="text-sm font-medium">Total Revenue</CardTitle></CardHeader> <CardContent><p className="text-2xl font-bold">{formatCurrency(totalRevenue)}</p></CardContent> </Card>
                  <Card> <CardHeader><CardTitle className="text-sm font-medium">Total Profit</CardTitle></CardHeader> <CardContent><p className="text-2xl font-bold text-success-foreground">{formatCurrency(totalProfit)}</p></CardContent> </Card>
                  <Card> <CardHeader><CardTitle className="text-sm font-medium">Transactions</CardTitle></CardHeader> <CardContent><p className="text-2xl font-bold">{totalTransactions}</p></CardContent> </Card>
                  <Card> <CardHeader><CardTitle className="text-sm font-medium">Products</CardTitle></CardHeader> <CardContent><p className="text-2xl font-bold">{products.length}</p></CardContent> </Card>
                </div>
                
                {/* Sales Chart */}
                <Card>
                    <CardHeader>
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                            <div>
                                <CardTitle className="flex items-center gap-2"><LineChart className="h-5 w-5" /> Sales Overview</CardTitle>
                                <CardDescription>Sales and profit over the selected period.</CardDescription>
                            </div>
                            <DateRangeFilter date={date} setDate={setDate} />
                        </div>
                    </CardHeader>
                    <CardContent>
                      {filteredTransactions.length > 0 ? (
                        <ChartContainer config={chartConfig} className="h-[280px] w-full">
                            <ComposedChart data={chartData}>
                                <defs><linearGradient id="fillProfit" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--color-profit)" stopOpacity={0.4}/><stop offset="95%" stopColor="var(--color-profit)" stopOpacity={0.05}/></linearGradient></defs>
                                <CartesianGrid vertical={false} />
                                <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
                                <YAxis tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(value) => `Rp${Number(value) / 1000}k`} />
                                <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
                                <Bar dataKey="sales" fill="var(--color-sales)" radius={4} barSize={20} />
                                <Area type="monotone" dataKey="profit" stroke="var(--color-profit)" fill="url(#fillProfit)" strokeWidth={2} />
                            </ComposedChart>
                        </ChartContainer>
                      ) : (
                        <div className="text-center text-muted-foreground h-[250px] flex flex-col justify-center items-center">
                          <ShoppingBag className="h-10 w-10 mb-2" />
                          <p>No sales recorded for this period.</p>
                        </div>
                      )}
                    </CardContent>
                </Card>

                 {/* Top Sellers */}
                <Card>
                  <CardHeader><CardTitle>Top Sellers</CardTitle></CardHeader>
                  <CardContent>
                    {topSellingProducts.length === 0 ? (
                      <div className="text-center text-muted-foreground py-8">
                        <ShoppingBag className="mx-auto h-8 w-8 mb-2"/><p>No sales recorded for this period.</p>
                      </div>
                    ) : (
                      <Table>
                        <TableBody>
                          {topSellingProducts.map(product => (
                            <TableRow key={product.name}>
                              <TableCell>{product.name}</TableCell>
                              <TableCell className="text-right font-medium">{product.quantity}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>

            </div>
        </ScrollArea>
    );
}
