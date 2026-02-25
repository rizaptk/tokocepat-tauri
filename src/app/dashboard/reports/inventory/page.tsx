
'use client';

import Link from 'next/link';
import { useStore } from '@/lib/store';
import { useMemo } from 'react';
import { ArrowLeft, Warehouse, DollarSign, Package, FileDown } from 'lucide-react';
import { exportInventoryToExcel } from '@/lib/export';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(amount);
};

export default function InventoryReportPage() {
    const { products, categories, storeConfig } = useStore();

    const getCategoryName = (categoryId?: string) => {
        if (!categoryId) return 'N/A';
        return categories.find(c => c.id === categoryId)?.name || 'N/A';
    }

    const stockTrackedProducts = useMemo(() => 
        products
            .filter(p => p.track_stock)
            .map(p => ({
                ...p,
                categoryName: getCategoryName(p.category_id),
            })),
    [products, categories]);
    
    const totalUnits = stockTrackedProducts.reduce((sum, p) => sum + p.stock, 0);
    const totalValueCost = stockTrackedProducts.reduce((sum, p) => sum + (p.stock * (p.cost_price || 0)), 0);
    const totalValueRetail = stockTrackedProducts.reduce((sum, p) => sum + (p.stock * p.price), 0);

    const stats = [
        { title: 'Total Units', value: totalUnits.toLocaleString(), icon: Package },
        { title: 'Total Value (Cost)', value: formatCurrency(totalValueCost), icon: DollarSign },
        { title: 'Total Value (Retail)', value: formatCurrency(totalValueRetail), icon: DollarSign },
    ];

    const handleExport = () => {
        if (storeConfig) {
            exportInventoryToExcel(stockTrackedProducts, storeConfig.store_name);
        } else {
            alert("Store configuration not found.");
        }
    };

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
                        <Warehouse className="h-5 w-5" /> Inventory Report
                    </h1>
                </div>
                <Button variant="outline" size="sm" onClick={handleExport} disabled={stockTrackedProducts.length === 0}>
                    <FileDown className="mr-2 h-4 w-4" />
                    <span>Export</span>
                </Button>
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
                    <CardTitle>Stock Valuation</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Product</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead className="text-right">Current Stock</TableHead>
                                <TableHead className="text-right">Value (Cost)</TableHead>
                                <TableHead className="text-right">Value (Retail)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {stockTrackedProducts.length > 0 ? (
                                stockTrackedProducts.map(p => (
                                    <TableRow key={p.id}>
                                        <TableCell className="font-medium">{p.name}</TableCell>
                                        <TableCell><Badge variant="outline">{p.categoryName}</Badge></TableCell>
                                        <TableCell className="text-right font-bold">{p.stock}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(p.stock * (p.cost_price || 0))}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(p.stock * p.price)}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">
                                        No stock-tracked products found.
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
