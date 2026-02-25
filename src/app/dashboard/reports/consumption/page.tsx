
'use client';

import Link from 'next/link';
import { useStore } from '@/lib/store';
import { useState, useMemo } from 'react';
import { ArrowLeft, Beaker, FileDown, MoreVertical } from 'lucide-react';
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type DateRangePreset = 'today' | 'last7' | 'last30' | 'lastMonth';

export default function ConsumptionReportPage() {
    const { rawIngredients, stockMovements } = useStore();
    const [range, setRange] = useState<DateRangePreset>('today');

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

    const reportData = useMemo(() => {
        return rawIngredients.map(ing => {
            const movements_after_period = stockMovements.filter(m => m.product_id === ing.id && new Date(m.created_at) > dateRange.to);
            const movements_in_period = stockMovements.filter(m => m.product_id === ing.id && new Date(m.created_at) >= dateRange.from && new Date(m.created_at) <= dateRange.to);
            
            const total_change_after_period = movements_after_period.reduce((sum, m) => sum + m.qty_change, 0);
            const total_change_in_period = movements_in_period.reduce((sum, m) => sum + m.qty_change, 0);

            const closingStock = ing.stock_qty - total_change_after_period;
            const openingStock = closingStock - total_change_in_period;

            const consumed = Math.abs(movements_in_period
                .filter(m => m.type === 'sale')
                .reduce((sum, m) => sum + m.qty_change, 0));
            
            const adjusted = movements_in_period
                .filter(m => m.type !== 'sale')
                .reduce((sum, m) => sum + m.qty_change, 0);

            return {
                ...ing,
                openingStock,
                consumed,
                adjusted,
                closingStock,
            };
        });
    }, [rawIngredients, stockMovements, dateRange]);
    
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
        }).format(amount);
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
                        <Beaker className="h-5 w-5" /> F&B Consumption Report
                    </h1>
                </div>
                 {/* Desktop Buttons */}
                <div className="hidden md:flex items-center gap-2">
                    <Button variant={range === 'today' ? 'default' : 'outline'} size="sm" onClick={() => setRange('today')}>Today</Button>
                    <Button variant={range === 'last7' ? 'default' : 'outline'} size="sm" onClick={() => setRange('last7')}>Last 7 Days</Button>
                    <Button variant={range === 'last30' ? 'default' : 'outline'} size="sm" onClick={() => setRange('last30')}>Last 30 Days</Button>
                    <Button variant={range === 'lastMonth' ? 'default' : 'outline'} size="sm" onClick={() => setRange('lastMonth')}>Last Month</Button>
                    <Button variant="outline" size="sm" disabled>
                        <FileDown className="mr-2 h-4 w-4" />
                        <span>Export</span>
                    </Button>
                </div>
                 {/* Mobile Dropdown */}
                <div className="md:hidden">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Date Range</DropdownMenuLabel>
                            <DropdownMenuRadioGroup value={range} onValueChange={(value) => setRange(value as DateRangePreset)}>
                                <DropdownMenuRadioItem value="today">Today</DropdownMenuRadioItem>
                                <DropdownMenuRadioItem value="last7">Last 7 Days</DropdownMenuRadioItem>
                                <DropdownMenuRadioItem value="last30">Last 30 Days</DropdownMenuRadioItem>
                                <DropdownMenuRadioItem value="lastMonth">Last Month</DropdownMenuRadioItem>
                            </DropdownMenuRadioGroup>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem disabled>
                                <FileDown className="mr-2 h-4 w-4" />
                                Export
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
           </header>
          <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
            <Card>
                <CardHeader>
                    <CardTitle>Ingredient Consumption</CardTitle>
                    <CardDescription>
                        Showing consumption data from {format(dateRange.from, 'PPP')} to {format(dateRange.to, 'PPP')}.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Ingredient</TableHead>
                                <TableHead className="text-right">Opening</TableHead>
                                <TableHead className="text-right">Consumed</TableHead>
                                <TableHead className="text-right">Adjusted</TableHead>
                                <TableHead className="text-right">Closing</TableHead>
                                <TableHead className="text-right">Value (Cost)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {reportData.length > 0 ? (
                                reportData.map(ing => (
                                    <TableRow key={ing.id}>
                                        <TableCell className="font-medium">{ing.name}</TableCell>
                                        <TableCell className="text-right">{ing.openingStock.toLocaleString()} {ing.unit_type}</TableCell>
                                        <TableCell className="text-right text-red-500">{ing.consumed > 0 ? `-${ing.consumed.toLocaleString()}` : 0} {ing.unit_type}</TableCell>
                                        <TableCell className="text-right text-blue-500">{ing.adjusted > 0 ? `+${ing.adjusted.toLocaleString()}` : ing.adjusted.toLocaleString()} {ing.unit_type}</TableCell>
                                        <TableCell className="text-right font-bold">{ing.closingStock.toLocaleString()} {ing.unit_type}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(ing.closingStock * ing.cost_per_unit)}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">
                                        No raw ingredients found.
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
