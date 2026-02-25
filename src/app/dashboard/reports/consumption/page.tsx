
'use client';

import Link from 'next/link';
import { useStore } from '@/lib/store';
import { useState } from 'react';
import { ArrowLeft, Beaker, FileDown } from 'lucide-react';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function ConsumptionReportPage() {
    const { rawIngredients, stockMovements } = useStore();
    
    // Placeholder for date filtering logic
    const [dateRange, setDateRange] = useState({ from: new Date(), to: new Date() });

    // Placeholder for data processing
    const reportData = rawIngredients.map(ing => ({
        ...ing,
        openingStock: 0,
        consumed: 0,
        adjusted: 0,
        closingStock: ing.stock_qty,
    }));
    
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
                <Button variant="outline" size="sm" disabled>
                    <FileDown className="mr-2 h-4 w-4" />
                    <span>Export</span>
                </Button>
           </header>
          <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
            <Card>
                <CardHeader>
                    <CardTitle>Ingredient Consumption</CardTitle>
                    <CardDescription>
                        Showing consumption data for all ingredients.
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
                                <TableHead className="text-right">Cost</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {reportData.length > 0 ? (
                                reportData.map(ing => (
                                    <TableRow key={ing.id}>
                                        <TableCell className="font-medium">{ing.name}</TableCell>
                                        <TableCell className="text-right">{ing.openingStock.toLocaleString()} {ing.unit_type}</TableCell>
                                        <TableCell className="text-right text-red-500">-{ing.consumed.toLocaleString()} {ing.unit_type}</TableCell>
                                        <TableCell className="text-right text-blue-500">{ing.adjusted.toLocaleString()} {ing.unit_type}</TableCell>
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
