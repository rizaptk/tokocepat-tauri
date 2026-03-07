
'use client';

import React, { useMemo, useState } from 'react';
import { DateRange } from 'react-day-picker';
import { format, isSameDay, differenceInDays, addDays, startOfDay, endOfDay } from 'date-fns';
import { Product, Transaction, Shift, StoreConfig, Category, RawIngredient, StockMovement, ProductVariant } from '@/lib/types';
import { DateRangeFilter } from '@/components/DateRangeFilter';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableRow, TableHead } from '@/components/ui/table';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from "@/components/ui/chart";
import { Bar, ComposedChart, CartesianGrid, XAxis, YAxis, Area } from "recharts";
import { RefreshCw, LineChart, ShoppingBag, Search, Package, Beaker, Layers2, Warehouse, ReceiptText } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';


type ReportData = {
    products: Product[];
    productVariants: ProductVariant[];
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
    const { products, transactions, storeConfig, stockMovements, rawIngredients, productVariants } = data;

    const [date, setDate] = React.useState<DateRange | undefined>(() => {
        if (!transactions || transactions.length === 0) {
            return { from: startOfDay(new Date()), to: endOfDay(new Date()) };
        }
        // Ensure dates are valid before sorting
        const validTransactions = transactions.filter(tx => !isNaN(new Date(tx.created_at).getTime()));
        if (validTransactions.length === 0) {
            return { from: startOfDay(new Date()), to: endOfDay(new Date()) };
        }
        
        const sorted = [...validTransactions].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        const fromDate = new Date(sorted[0].created_at);
        const toDate = new Date(sorted[sorted.length - 1].created_at);

        return {
            from: startOfDay(fromDate),
            to: endOfDay(toDate),
        };
    });
    
    const [salesSearchTerm, setSalesSearchTerm] = useState('');
    const [stockFilterType, setStockFilterType] = useState<'all' | 'product' | 'ingredient' | 'variant'>('all');

    const filteredTransactions = useMemo(() => {
        if (!date?.from) return [];
        return transactions.filter(tx => {
            const txDate = new Date(tx.created_at);
            if (isNaN(txDate.getTime())) return false;
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
                const txDate = new Date(tx.created_at);
                if (isNaN(txDate.getTime())) return;
                const hour = txDate.getHours();
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
                const txDate = new Date(tx.created_at);
                if (isNaN(txDate.getTime())) return;
                const dayKey = format(txDate, 'yyyy-MM-dd');
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

    // --- Sales Report Logic ---
    const filteredSalesReport = useMemo(() => {
        if (!salesSearchTerm.trim()) return filteredTransactions;
        return filteredTransactions.filter(tx => 
            tx.invoice_number.toLowerCase().includes(salesSearchTerm.toLowerCase())
        );
    }, [filteredTransactions, salesSearchTerm]);

    // --- Stock Summary Logic ---
    const allStockableItems = useMemo(() => {
        const stockableProducts = products
            .filter(p => p.track_stock && !p.has_variant)
            .map(p => ({ ...p, name: p.name, stock: p.stock, itemType: 'product' as const }));

        const stockableVariants = productVariants
            .filter(v => v.track_stock)
            .map(v => {
                const parent = products.find(p => p.id === v.product_id);
                return {
                    ...v,
                    id: v.id,
                    name: `${parent?.name || 'Product'} (${v.name})`,
                    stock: v.stock,
                    itemType: 'variant' as const,
                };
            });
        
        const stockableIngredients = rawIngredients.map(i => ({ ...i, name: i.name, stock: i.stock_qty, itemType: 'ingredient' as const }));

        return [...stockableProducts, ...stockableVariants, ...stockableIngredients];
    }, [products, productVariants, rawIngredients]);

    const stockSummaryData = useMemo(() => {
        const movementsInPeriod = stockMovements.filter(m => {
            const moveDate = new Date(m.created_at);
            return date?.from && date?.to && moveDate >= date.from && moveDate <= date.to;
        });

        const filteredItems = allStockableItems.filter(item => {
            if (stockFilterType === 'all') return true;
            return item.itemType === stockFilterType;
        });

        return filteredItems.map(item => {
            const itemMovements = movementsInPeriod.filter(m => m.product_id === item.id);
            const totalChangeInPeriod = itemMovements.reduce((sum, m) => sum + m.qty_change, 0);
            
            const currentStock = item.stock;
            const openingStock = currentStock - totalChangeInPeriod;
            
            const added = itemMovements.filter(m => m.type === 'restock' || m.type === 'initial_balance').reduce((sum, m) => sum + m.qty_change, 0);
            const sold = Math.abs(itemMovements.filter(m => m.type === 'sale').reduce((sum, m) => sum + m.qty_change, 0));
            const adjusted = itemMovements.filter(m => ['correction', 'lost', 'damaged'].includes(m.type)).reduce((sum, m) => sum + m.qty_change, 0);

            return { id: item.id, name: item.name, type: item.itemType, openingStock, added, sold, adjusted, closingStock: currentStock };
        });
    }, [allStockableItems, stockMovements, date, stockFilterType]);


    return (
        <ScrollArea className="h-full">
            <div className="p-4 md:p-8 space-y-8">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                     <div>
                        <h1 className="text-2xl font-bold tracking-tight">{storeConfig?.store_name || 'Store Report'}</h1>
                        <p className="text-muted-foreground">Read-only report generated from backup file.</p>
                    </div>
                    <Button variant="outline" onClick={onReset}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Load Another File
                    </Button>
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

                {/* Transaction Details */}
                <Card>
                    <CardHeader>
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                             <div>
                                <CardTitle className="flex items-center gap-2"><ReceiptText className="h-5 w-5" /> Transaction Details</CardTitle>
                                <CardDescription>A log of all sales in the selected period.</CardDescription>
                            </div>
                            <div className="relative w-full sm:w-64">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input type="search" placeholder="Search by invoice..." className="w-full pl-8" value={salesSearchTerm} onChange={(e) => setSalesSearchTerm(e.target.value)} />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Invoice</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {filteredSalesReport.length > 0 ? (
                                    filteredSalesReport.map(tx => (
                                        <TableRow key={tx.id}><TableCell>{format(new Date(tx.created_at), 'Pp')}</TableCell><TableCell className="font-mono text-xs">{tx.invoice_number}</TableCell><TableCell className="text-right font-medium">{formatCurrency(tx.total)}</TableCell></TableRow>
                                    ))
                                ) : ( <TableRow><TableCell colSpan={3} className="h-24 text-center">No transactions match your criteria.</TableCell></TableRow> )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
                
                {/* Stock Summary */}
                <Card>
                    <CardHeader>
                         <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div>
                                <CardTitle className="flex items-center gap-2"><Warehouse className="h-5 w-5" /> Stock Summary</CardTitle>
                                <CardDescription>An overview of stock movements for all items.</CardDescription>
                            </div>
                             <Select value={stockFilterType} onValueChange={(v) => setStockFilterType(v as any)}>
                                <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Filter type" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Items</SelectItem>
                                    <SelectItem value="product">Products</SelectItem>
                                    <SelectItem value="variant">Variants</SelectItem>
                                    <SelectItem value="ingredient">Ingredients</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardHeader>
                    <CardContent>
                         <Table>
                            <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Opening</TableHead><TableHead className="text-right">Added</TableHead><TableHead className="text-right">Sold</TableHead><TableHead className="text-right">Adjust</TableHead><TableHead className="text-right">Closing</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {stockSummaryData.length > 0 ? (
                                    stockSummaryData.map(item => (
                                        <TableRow key={item.id}>
                                            <TableCell className="font-medium">{item.name}</TableCell>
                                            <TableCell><Badge variant="outline">{item.type}</Badge></TableCell>
                                            <TableCell className="text-right">{item.openingStock}</TableCell>
                                            <TableCell className="text-right text-green-600">+{item.added}</TableCell>
                                            <TableCell className="text-right text-red-500">-{item.sold}</TableCell>
                                            <TableCell className="text-right text-blue-500">{item.adjusted}</TableCell>
                                            <TableCell className="text-right font-bold">{item.closingStock}</TableCell>
                                        </TableRow>
                                    ))
                                ) : ( <TableRow><TableCell colSpan={7} className="h-24 text-center">No stock data for this period.</TableCell></TableRow> )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

            </div>
        </ScrollArea>
    );
}

