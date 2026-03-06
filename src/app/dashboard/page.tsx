

"use client";

import Link from "next/link";
import { History, CheckCircle, ShoppingBag, ArrowRight } from "lucide-react";
import { useStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { TokoCepatLogo } from "@/components/TokoCepatLogo";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { ThemeToggle } from "@/components/ThemeButtons";
import { useMemo } from "react";

export default function DashboardPage() {
  const router = useRouter();
  const { products, shifts, transactions, activeShift, productVariants } = useStore((state) => ({
    products: state.products,
    productVariants: state.productVariants,
    shifts: state.shifts,
    transactions: state.transactions,
    activeShift: state.activeShift,
  }));
  const closedShifts = shifts.filter(s => s.status === 'closed');
  
  const lowStockItems = useMemo(() => {
    const lowStockProducts = products.filter(
        p => !p.has_variant && p.track_stock && p.low_stock_alert != null && p.stock <= p.low_stock_alert
    );
    const lowStockVariants = productVariants
        .filter(v => v.track_stock && v.low_stock_alert != null && v.stock <= v.low_stock_alert)
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

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todaysTransactions = transactions.filter(t => new Date(t.created_at) >= today && t.status === 'paid');

  // --- Top Selling Products ---
  const productSales = new Map<string, { name: string; quantity: number }>();
  todaysTransactions.forEach(tx => {
    tx.items.forEach(item => {
        const productId = item.product_snapshot.id;
        const currentSale = productSales.get(productId) || { name: item.product_snapshot.name, quantity: 0 };
        currentSale.quantity += item.qty;
        productSales.set(productId, currentSale);
    });
  });
  const topSellingProducts = Array.from(productSales.values())
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  // --- Hourly Sales Chart ---
  const hourlySalesData = Array.from({ length: 17 }, (_, i) => ({
    hour: `${String(i + 7).padStart(2, '0')}:00`,
    total: 0,
  })); // From 07:00 to 23:00

  todaysTransactions.forEach(tx => {
    const hour = new Date(tx.created_at).getHours();
    if (hour >= 7 && hour <= 23) {
      hourlySalesData[hour - 7].total += tx.total;
    }
  });

  const chartConfig = {
    total: {
      label: "Sales",
      color: "hsl(var(--primary))",
    },
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
          <ThemeToggle />
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
                  <p className="text-xs text-muted-foreground">Today's Revenue</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(todaysTransactions.reduce((sum, t) => sum + t.total, 0))}
                  </p>
                </div>
              </Card>

              <Card>
                <div className="p-4">
                  <p className="text-xs text-muted-foreground">Transactions</p>
                  <p className="text-2xl font-bold">
                    {todaysTransactions.length}
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

              <Card>
                <div className="p-4">
                  <p className="text-xs text-muted-foreground">Closed Shifts</p>
                  <p className="text-2xl font-bold">
                    {closedShifts.length}
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
              <CardTitle>Today's Sales by Hour</CardTitle>
              <CardDescription>
                Sales distribution across operating hours.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {todaysTransactions.length > 0 ? (
                <ChartContainer config={chartConfig} className="h-[280px] w-full">
                  <BarChart accessibilityLayer data={hourlySalesData}>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="hour"
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => value.slice(0, 2)}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `Rp${Number(value) / 1000}k`}
                    />
                    <ChartTooltip
                      cursor={false}
                      content={
                        <ChartTooltipContent
                          formatter={(value) => formatCurrency(value as number)}
                          indicator="dot"
                        />
                      }
                    />
                    <Bar dataKey="total" fill="var(--color-total)" radius={6} />
                  </BarChart>
                </ChartContainer>
              ) : (
                <div className="text-center text-muted-foreground h-[250px] flex flex-col justify-center items-center">
                  <ShoppingBag className="h-10 w-10 mb-2" />
                  <p>No sales recorded today.</p>
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
                    <p>No sales recorded today.</p>
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

          {/* Shift History */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Shift History</CardTitle>
                    <CardDescription>Recent closed sessions.</CardDescription>
                </div>
                <Button asChild variant="link" className="text-sm -mr-4">
                    <Link href="/dashboard/reports/shifts">View All</Link>
                </Button>
            </CardHeader>
            <CardContent>
              {closedShifts.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <History className="mx-auto h-8 w-8 mb-2"/>
                  <p>No closed shifts yet.</p>
                </div>
              ) : (
                <Table>
                  <TableBody>
                    {closedShifts.slice(0, 5).map(shift => (
                      <TableRow
                        key={shift.id}
                        onClick={() => router.push(`/dashboard/shifts/${shift.id}`)}
                        className="cursor-pointer"
                      >
                        <TableCell>
                          {new Date(shift.opened_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(shift.variance || 0)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

        </section>

      </main>
    </div>
  );
}

    

    
