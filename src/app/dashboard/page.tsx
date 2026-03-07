

"use client";

import Link from "next/link";
import { History, CheckCircle, ShoppingBag, ArrowRight, DollarSign, LineChart } from "lucide-react";
import { useStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { TokoCepatLogo } from "@/components/TokoCepatLogo";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Bar, ComposedChart, CartesianGrid, XAxis, YAxis, Area } from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { ThemeToggle } from "@/components/ThemeButtons";
import React, { useMemo } from "react";
import { NotificationBell } from "@/components/NotificationBell";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { DateRange } from "react-day-picker";
import { isSameDay, differenceInDays, addDays, startOfDay, endOfDay, format } from 'date-fns';

export default function DashboardPage() {
  const router = useRouter();
  const { products, transactions, activeShift, productVariants } = useStore((state) => ({
    products: state.products,
    productVariants: state.productVariants,
    transactions: state.transactions,
    activeShift: state.activeShift,
  }));
  
  const [date, setDate] = React.useState<DateRange | undefined>({
      from: startOfDay(new Date()),
      to: endOfDay(new Date()),
  });

  const lowStockItems = useMemo(() => {
    const lowStockProducts = products.filter(
        p => !p.has_variant && p.track_stock && p.low_stock_alert != null && p.stock > 0 && p.stock <= p.low_stock_alert
    );
    const lowStockVariants = productVariants
        .filter(v => v.track_stock && v.low_stock_alert != null && v.stock > 0 && v.stock <= v.low_stock_alert)
        .map(v => {
            const parent = products.find(p => p.id === v.product_id);
            return {
                id: v.id,
                name: `${parent?.name || 'Product'} (${v.name})`,
                stock: v.stock
            };
        });
    return [
        ...lowStockProducts.map(p => ({ id: p.id, name: p.name, stock: p.stock })),
        ...lowStockVariants
    ];
  }, [products, productVariants]);
  
  const filteredTransactions = useMemo(() => {
    if (!date?.from) return [];
    return transactions.filter(tx => {
        const txDate = new Date(tx.created_at);
        return tx.status === 'paid' && txDate >= date.from! && txDate <= (date.to || date.from!);
    });
  }, [date, transactions]);

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

  // --- Currency Formatter ---
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };
  
  // --- Active Shift Calculations ---
  const activeShiftTransactions = activeShift
    ? transactions.filter(t => t.shift_id === activeShift.id && t.status === 'paid')
    : [];
  const activeShiftRevenue = activeShiftTransactions.reduce((sum, t) => sum + t.total, 0);

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
       <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6 z-10 justify-between">
          <Link href="/">
            <TokoCepatLogo />
          </Link>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <ThemeToggle />
          </div>
       </header>
      <main className="flex flex-1 flex-col lg:flex-row">

        {/* ========================= */}
        {/* LEFT — HERO / EXECUTIVE */}
        {/* ========================= */}

        <section className="lg:w-2/5 border-b lg:border-b-0 lg:border-r bg-background p-8 flex flex-col justify-between">
          
          <div className="space-y-8">

            {/* Executive Heading */}
            <div className="space-y-3">
              <h2 className="text-3xl font-bold tracking-tight">
                Business Overview
              </h2>
              <p className="text-muted-foreground">
                Real-time operational visibility across sales,
                inventory, and shift performance.
              </p>
            </div>

            {/* KPI Summary */}
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <div className="p-4">
                  <p className="text-xs text-muted-foreground">Total Revenue</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(totalRevenue)}
                  </p>
                </div>
              </Card>

              <Card>
                <div className="p-4">
                  <p className="text-xs text-muted-foreground">Total Profit</p>
                  <p className="text-2xl font-bold text-success-foreground">
                    {formatCurrency(totalProfit)}
                  </p>
                </div>
              </Card>
              
              <Card>
                <div className="p-4">
                  <p className="text-xs text-muted-foreground">Transactions</p>
                  <p className="text-2xl font-bold">
                    {totalTransactions}
                  </p>
                </div>
              </Card>

              <Card>
                <div className="p-4">
                  <p className="text-xs text-muted-foreground">Low Stock Items</p>
                  <p className="text-2xl font-bold text-destructive">
                    {lowStockItems.length}
                  </p>
                </div>
              </Card>
            </div>

            {/* Active Shift Block */}
            {activeShift && (
              <div className="rounded-xl border p-6 space-y-3 bg-muted/40">
                <div>
                  <p className="text-sm text-muted-foreground">Active Shift</p>
                  <p className="font-semibold">
                    Started {new Date(activeShift.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Opening Cash</p>
                    <p className="font-semibold">{formatCurrency(activeShift.opening_cash)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Current Sales</p>
                    <p className="font-semibold">{formatCurrency(activeShiftRevenue)}</p>
                  </div>
                </div>

                <Button className="w-full mt-4" asChild>
                  <Link href="/cashier">
                    Go to Cashier <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            )}

          </div>
        </section>


        {/* ========================= */}
        {/* RIGHT — ANALYTICS GRID  */}
        {/* ========================= */}

        <section className="flex-1 p-8 space-y-8">

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
                        <defs>
                            <linearGradient id="fillProfit" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--color-profit)" stopOpacity={0.4}/>
                                <stop offset="95%" stopColor="var(--color-profit)" stopOpacity={0.05}/>
                            </linearGradient>
                        </defs>
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

          {/* Two Column Insight Grid */}
          <div className="grid gap-6 md:grid-cols-2">

            {/* Low Stock */}
            <Card>
              <CardHeader>
                <CardTitle>Low Stock Items</CardTitle>
              </CardHeader>
              <CardContent>
                {lowStockItems.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <CheckCircle className="mx-auto h-8 w-8 mb-2 text-green-500"/>
                    <p>All inventory levels healthy.</p>
                  </div>
                ) : (
                  <Table>
                    <TableBody>
                      {lowStockItems.slice(0, 5).map(product => (
                        <TableRow key={product.id}>
                          <TableCell>{product.name}</TableCell>
                          <TableCell className="text-right font-medium text-destructive">
                            {product.stock}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Top Sellers */}
            <Card>
              <CardHeader>
                <CardTitle>Top Sellers</CardTitle>
              </CardHeader>
              <CardContent>
                {topSellingProducts.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <ShoppingBag className="mx-auto h-8 w-8 mb-2"/>
                    <p>No sales recorded for this period.</p>
                  </div>
                ) : (
                  <Table>
                    <TableBody>
                      {topSellingProducts.map(product => (
                        <TableRow key={product.name}>
                          <TableCell>{product.name}</TableCell>
                          <TableCell className="text-right font-medium">
                            {product.quantity}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

          </div>
        </section>

      </main>
    </div>
  );
}
