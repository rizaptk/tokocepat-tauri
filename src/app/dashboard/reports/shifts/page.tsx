
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ArrowLeft, BookOpen, Clock, AlertTriangle } from 'lucide-react';
import { useState, useMemo } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Shift } from '@/lib/types';
import { DateRangeFilter, DateRangePreset } from '@/components/DateRangeFilter';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
// import { exportShiftsToPdf } from '@/lib/export';

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(amount);
};

export default function ShiftsReportPage() {
    const router = useRouter();
    const { shifts, storeConfig } = useStore();
    const { toast } = useToast();
    const [range, setRange] = useState<DateRangePreset>('last30');

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

    const filteredShifts = useMemo(() => {
        return shifts.filter(s => {
            if (s.status !== 'closed' || !s.closed_at) return false;
            const closedDate = new Date(s.closed_at);
            return closedDate >= dateRange.from && closedDate <= dateRange.to;
        });
    }, [shifts, dateRange]);

    const handlePdfExport = () => {
        // if (storeConfig) {
        //     exportShiftsToPdf(filteredShifts, dateRange, storeConfig.store_name);
        // } else {
            toast({ title: 'Coming Soon', description: 'PDF export for shifts is not yet available.' });
        // }
    };
    
    const handleExcelExport = () => {
        toast({ title: 'Coming Soon', description: 'Excel export for shifts is not yet available.' });
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
                        <BookOpen className="h-5 w-5" /> Shift History
                    </h1>
                </div>
                 <DateRangeFilter
                    range={range}
                    onRangeChange={setRange}
                    onExportExcel={handleExcelExport}
                    onExportPdf={handlePdfExport}
                    hasData={filteredShifts.length > 0}
                />
           </header>
          <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
            <Card>
                <CardHeader>
                    <CardTitle>Closed Shifts</CardTitle>
                    <CardDescription>
                        A history of all closed shifts from {format(dateRange.from, 'PPP')} to {format(dateRange.to, 'PPP')}.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Opening Cash</TableHead>
                                <TableHead>Expected Cash</TableHead>
                                <TableHead>Declared Cash</TableHead>
                                <TableHead>Variance</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredShifts.length > 0 ? (
                                filteredShifts.map((s: Shift) => (
                                    <TableRow key={s.id} onClick={() => router.push(`/dashboard/shifts/${s.id}`)} className="cursor-pointer">
                                        <TableCell>
                                            <div className="font-medium">{s.closed_at ? format(new Date(s.closed_at), 'PP') : '-'}</div>
                                            <div className="text-sm text-muted-foreground">
                                                {s.opened_at && s.closed_at ? 
                                                    `${format(new Date(s.opened_at), 'p')} - ${format(new Date(s.closed_at), 'p')}`
                                                    : '-'
                                                }
                                            </div>
                                        </TableCell>
                                        <TableCell>{formatCurrency(s.opening_cash)}</TableCell>
                                        <TableCell>{formatCurrency(s.system_cash || 0)}</TableCell>
                                        <TableCell>{formatCurrency(s.declared_cash || 0)}</TableCell>
                                        <TableCell className={cn(s.variance !== 0 ? 'text-destructive' : '', 'font-bold')}>
                                            { s.variance !== 0 && <AlertTriangle className="inline h-4 w-4 mr-1"/> }
                                            {formatCurrency(s.variance || 0)}
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">
                                        No closed shifts found in this period.
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

    