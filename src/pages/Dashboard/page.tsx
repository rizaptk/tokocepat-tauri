import { Link } from "react-router-dom";
import { formatIDR as formatCurrency } from "@/lib/format";
import { CheckCircle, ShoppingBag, ArrowRight, LineChart, CalendarDays } from "lucide-react";
import { useStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { TokoCepatLogo } from "@/components/TokoCepatLogo";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLoadTransactions } from "@/hooks/useLoadTransaction";
import { LicenseBadge } from "@/components/LicenseBadge";
import { useDeviceScope } from "@/hooks/useDeviceScope";
import { DeviceScopeFilter } from "@/components/DeviceScopeFilter";

export default function DashboardPage() {
  const products = useStore((state) => state.products);
  const productVariants = useStore((state) => state.productVariants);
  // const transactions = useStore((state) => state.transactions);
  const activeShift = useStore((state) => state.activeShift);

  const [date, setDate] = React.useState<DateRange | undefined>({
    from: startOfDay(new Date()),
    to: endOfDay(new Date()),
  });

  const { scope: deviceScope, activeDeviceId, devices } = useDeviceScope();
  const { transactions } = useLoadTransactions(date, activeDeviceId);
  const isPerDevice = deviceScope !== 'all';
  const currentDeviceHasData = isPerDevice && transactions.length > 0;

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
      return sum + (tx.subtotal - (tx.discount_total || 0) - cost);
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
        const profit = tx.subtotal - (tx.discount_total || 0) - tx.items.reduce((sum, item) => sum + (item.cost_snapshot || 0) * item.qty, 0);
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
        const profit = tx.subtotal - (tx.discount_total || 0) - tx.items.reduce((sum, item) => sum + (item.cost_snapshot || 0) * item.qty, 0);
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
  

  // --- Active Shift Calculations ---
  const activeShiftTransactions = activeShift
    ? transactions.filter(t => t.shift_id === activeShift.id && t.status === 'paid')
    : [];
  const activeShiftRevenue = activeShiftTransactions.reduce((sum, t) => sum + t.total, 0);

  return (
    <div className="flex h-screen w-full flex-col bg-muted/40">
      <header className="sticky top-0 flex h-10 items-center gap-4 border-b border-border/60 bg-background/80 px-4 z-20 justify-between shrink-0 backdrop-blur-md">
        <Link to="/">
          <TokoCepatLogo />
        </Link>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <ThemeToggle />
        </div>
      </header>
      <main className="flex flex-1 flex-col lg:flex-row min-h-0 shrink-0">

        {/* ========================= */}
        {/* LEFT — HERO / EXECUTIVE */}
        {/* ========================= */}

        <section className="lg:w-2/5 border-b lg:border-b-0 lg:border-r bg-background p-8 flex flex-col justify-between">

          <div className="space-y-6">

            <div className="space-y-1">
              <h2 className="text-3xl font-bold tracking-tight">
                Ringkasan Bisnis
              </h2>
              <p className="text-sm text-muted-foreground">
                Pantau performa penjualan, stok, dan shift secara real-time.
              </p>
              <div className="pt-2">
                <LicenseBadge size="full" />
              </div>
            </div>

            {/* KPI Summary */}
            <div className="grid grid-cols-2 gap-3">
              <Card>
                <div className="p-3.5">
                  <p className="text-xs text-muted-foreground">Total Omzet</p>
                  <p className="text-xl font-light">
                    {formatCurrency(totalRevenue)}
                  </p>
                </div>
              </Card>

              <Card>
                <div className="p-3.5">
                  <p className="text-xs text-muted-foreground">Laba Kotor</p>
                  <p className="text-xl font-light text-success-foreground">
                    {formatCurrency(totalProfit)}
                  </p>
                </div>
              </Card>

              <Card>
                <div className="p-3.5">
                  <p className="text-xs text-muted-foreground">Transaksi</p>
                  <p className="text-xl font-light">
                    {totalTransactions}
                  </p>
                </div>
              </Card>

              <Card>
                <div className="p-3.5">
                  <p className="text-xs text-muted-foreground">Stok Tipis</p>
                  <p className="text-xl font-light text-destructive">
                    {lowStockItems.length}
                  </p>
                </div>
              </Card>
            </div>

            {/* Active Shift Block */}
            {activeShift && (
              <div className="rounded-lg border p-4 space-y-3 bg-muted/40">
                <div>
                  <p className="text-xs text-muted-foreground">Sif Aktif</p>
                  <p className="font-semibold">
                    Mulai {new Date(activeShift.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Modal Awal</p>
                    <p className="font-semibold">{formatCurrency(activeShift.opening_cash)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Penjualan</p>
                    <p className="font-semibold">{formatCurrency(activeShiftRevenue)}</p>
                  </div>
                </div>

                <Button className="w-full" asChild>
                  <Link to="/cashier">
                    Buka Kasir <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            )}

          </div>
        </section>


        {/* ========================= */}
        {/* RIGHT — ANALYTICS GRID  */}
        {/* ========================= */}

        <section className="flex-1 min-h-0">
          <ScrollArea className="h-full">
            <div className="p-8 space-y-6">
              {/* Sales Chart */}
              <Card>
                <CardHeader>
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div>
                      <CardTitle className="flex items-center gap-2"><LineChart className="h-5 w-5" /> Grafik Penjualan</CardTitle>
                      <CardDescription>Data omzet dan laba pada periode terpilih.</CardDescription>
                    </div>
                    {/* <DateRangeFilter date={date} setDate={setDate} /> */}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                    <div className="font-medium flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-muted-foreground" />
                      Periode
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <DateRangeFilter date={date} setDate={setDate} />
                      <DeviceScopeFilter />
                    </div>
                  </div>
                  {filteredTransactions.length > 0 ? (
                    <ChartContainer config={chartConfig} className="h-[280px] w-full">
                      <ComposedChart data={chartData}>
                        <defs>
                          <linearGradient id="fillProfit" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--color-profit)" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="var(--color-profit)" stopOpacity={0.05} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} />
                        <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
                        <YAxis tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(value) => `Rp${Number(value) / 1000}k`} />
                        <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
                        <Bar dataKey="sales" fill="var(--color-sales)" radius={3} barSize={18} />
                        <Area type="monotone" dataKey="profit" stroke="var(--color-profit)" fill="url(#fillProfit)" strokeWidth={2} />
                      </ComposedChart>
                    </ChartContainer>
                  ) : (
                    <div className="text-center text-muted-foreground h-[250px] flex flex-col justify-center items-center">
                      <ShoppingBag className="h-10 w-10 mb-2" />
                      <p>Tidak ada transaksi di periode ini.</p>
                      {isPerDevice && !currentDeviceHasData && (
                        <p className="text-xs mt-1 text-muted-foreground/70">
                          {deviceScope === 'current'
                            ? 'Perangkat ini belum memiliki transaksi pada periode tersebut.'
                            : `Belum ada transaksi untuk ${devices.find(d => d.id === deviceScope)?.name || 'perangkat terpilih'} pada periode tersebut.`}
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Two Column Insight Grid */}
              <div className="grid gap-6 md:grid-cols-2">

                {/* Low Stock */}
                <Card>
                  <CardHeader>
                    <CardTitle>Stok Menipis</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {lowStockItems.length === 0 ? (
                      <div className="text-center text-muted-foreground py-8">
                        <CheckCircle className="mx-auto h-8 w-8 mb-2 text-success" />
                        <p>Semua stok aman.</p>
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
                    <CardTitle>Produk Terlaris</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {topSellingProducts.length === 0 ? (
                      <div className="text-center text-muted-foreground py-8">
                        <ShoppingBag className="mx-auto h-8 w-8 mb-2" />
                        <p>Belum ada data penjualan.</p>
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
            </div>
          </ScrollArea>

        </section>

      </main>
    </div>
  );
}
