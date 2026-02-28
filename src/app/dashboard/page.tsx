
"use client";

import Link from "next/link";
import { History, TriangleAlert, CheckCircle, TrendingUp, ShoppingBag, BarChart as BarChartIcon, ArrowRight } from "lucide-react";
import { useStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TokoCepatLogo } from "@/components/TokoCepatLogo";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

export default function DashboardPage() {
  const router = useRouter();
  const { products, shifts, transactions, activeShift } = useStore((state) => ({
    products: state.products,
    shifts: state.shifts,
    transactions: state.transactions,
    activeShift: state.activeShift,
  }));
  const closedShifts = shifts.filter(s => s.status === 'closed');
  
  const lowStockItems = products.filter(
    p => p.track_stock && p.low_stock_alert != null && p.stock <= p.low_stock_alert
  );

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
       <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6 z-10">
          <Link href="/">
            <TokoCepatLogo />
          </Link>
       </header>
      {/* <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        {activeShift && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div>
                  <CardTitle>Active Shift Summary</CardTitle>
                  <CardDescription>
                      Shift started at {new Date(activeShift.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </CardDescription>
                </div>
                <Button asChild>
                    <Link href="/cashier">
                        Go to Cashier <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                </Button>
            </CardHeader>
            <CardContent className="grid gap-4 pt-4 sm:grid-cols-3">
                <div className="flex flex-col space-y-1">
                    <p className="text-sm text-muted-foreground">Opening Cash</p>
                    <p className="text-2xl font-bold">{formatCurrency(activeShift.opening_cash)}</p>
                </div>
                <div className="flex flex-col space-y-1">
                    <p className="text-sm text-muted-foreground">Current Sales</p>
                    <p className="text-2xl font-bold">{formatCurrency(activeShiftRevenue)}</p>
                </div>
                <div className="flex flex-col space-y-1">
                    <p className="text-sm text-muted-foreground">Transactions</p>
                    <p className="text-2xl font-bold">{activeShiftTransactions.length}</p>
                </div>
            </CardContent>
          </Card>
        )}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="lg:col-span-2">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChartIcon className="text-primary"/>
                      Today's Sales by Hour
                    </CardTitle>
                    <CardDescription>An overview of sales activity throughout the day.</CardDescription>
                </CardHeader>
                <CardContent>
                    {todaysTransactions.length > 0 ? (
                        <ChartContainer config={chartConfig} className="h-[250px] w-full">
                            <BarChart accessibilityLayer data={hourlySalesData}>
                                <CartesianGrid vertical={false} />
                                <XAxis
                                    dataKey="hour"
                                    tickLine={false}
                                    axisLine={false}
                                    tickMargin={8}
                                    tickFormatter={(value) => value.slice(0, 2)}
                                />
                                <YAxis
                                    tickLine={false}
                                    axisLine={false}
                                    tickMargin={8}
                                    tickFormatter={(value) => `Rp${Number(value) / 1000}k`}
                                />
                                <ChartTooltip
                                    cursor={false}
                                    content={<ChartTooltipContent
                                        formatter={(value) => formatCurrency(value as number)}
                                        indicator="dot"
                                    />}
                                />
                                <Bar dataKey="total" fill="var(--color-total)" radius={4} />
                            </BarChart>
                        </ChartContainer>
                    ) : (
                        <div className="text-center text-muted-foreground h-[250px] flex flex-col justify-center items-center">
                           <ShoppingBag className="mx-auto h-10 w-10 mb-2"/>
                           <p>No sales recorded today.</p>
                       </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TriangleAlert className="text-destructive"/>
                      Low Stock Items
                    </CardTitle>
                    <CardDescription>Products that need to be restocked soon.</CardDescription>
                </CardHeader>
                <CardContent>
                   {lowStockItems.length === 0 ? (
                     <div className="text-center text-muted-foreground py-8">
                       <CheckCircle className="mx-auto h-10 w-10 mb-2 text-green-500"/>
                       <p className="font-medium">All items are well-stocked.</p>
                     </div>
                   ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                              <TableHead>Product</TableHead>
                              <TableHead className="text-right">Qty</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {lowStockItems.slice(0, 5).map(product => (
                                <TableRow key={product.id} className="text-destructive font-medium">
                                    <TableCell>{product.name}</TableCell>
                                    <TableCell className="font-bold text-right">{product.stock}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                   )}
                </CardContent>
            </Card>
            
             <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="text-primary"/>
                      Today's Top Sellers
                    </CardTitle>
                    <CardDescription>Top 5 most sold products today.</CardDescription>
                </CardHeader>
                <CardContent>
                   {topSellingProducts.length === 0 ? (
                     <div className="text-center text-muted-foreground py-8">
                       <ShoppingBag className="mx-auto h-10 w-10 mb-2"/>
                       <p>No sales recorded today.</p>
                     </div>
                   ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                              <TableHead>Product</TableHead>
                              <TableHead className="text-right">Qty</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {topSellingProducts.map(product => (
                                <TableRow key={product.name}>
                                    <TableCell className="font-medium">{product.name}</TableCell>
                                    <TableCell className="text-right font-bold">{product.quantity}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                   )}
                </CardContent>
            </Card>

            <Card className="lg:col-span-4">
                <CardHeader>
                    <CardTitle>Shift History</CardTitle>
                    <CardDescription>Review previously closed shifts. Click a row to see details.</CardDescription>
                </CardHeader>
                <CardContent>
                   {closedShifts.length === 0 ? (
                     <div className="text-center text-muted-foreground py-8">
                       <History className="mx-auto h-10 w-10 mb-2"/>
                       <p>No closed shifts yet.</p>
                     </div>
                   ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Variance</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {closedShifts.map(shift => (
                                <TableRow key={shift.id} onClick={() => router.push(`/dashboard/shifts/${shift.id}`)} className="cursor-pointer">
                                    <TableCell>
                                        <div className="font-medium">{new Date(shift.opened_at).toLocaleDateString()}</div>
                                        <div className="text-xs text-muted-foreground">
                                            {new Date(shift.opened_at).toLocaleTimeString()} - {shift.closed_at ? new Date(shift.closed_at).toLocaleTimeString() : ''}
                                        </div>
                                    </TableCell>
                                    <TableCell><Badge variant="secondary">CLOSED</Badge></TableCell>
                                    <TableCell className={`text-right font-medium ${shift.variance && shift.variance !== 0 ? 'text-destructive' : ''}`}>
                                        {formatCurrency(shift.variance || 0)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                   )}
                </CardContent>
            </Card>
        </div>
      </main> */}
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
            <CardHeader>
              <CardTitle>Shift History</CardTitle>
              <CardDescription>Closed operational sessions.</CardDescription>
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
                    {closedShifts.map(shift => (
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

    