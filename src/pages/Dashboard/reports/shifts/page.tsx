import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '@/lib/store';
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ArrowLeft, BookOpen, AlertTriangle, FileDown, FileText } from 'lucide-react';
import React, { useState, useMemo } from 'react';
import { DateRange } from 'react-day-picker';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Shift } from '@/lib/types';
import { DateRangeFilter } from '@/components/DateRangeFilter';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { NotificationBell } from '@/components/NotificationBell';
import { ThemeToggle } from '@/components/ThemeButtons';

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(amount);
};

export default function ShiftsReportPage() {
    const navigate = useNavigate();
    const { shifts } = useStore();
    const { toast } = useToast();
    const [date, setDate] = React.useState<DateRange | undefined>({
      from: startOfDay(subDays(new Date(), 29)),
      to: endOfDay(new Date()),
    });

    const filteredShifts = useMemo(() => {
        if (!date?.from || !date?.to) return [];
        return shifts.filter(s => {
            if (s.status !== 'closed' || !s.closed_at) return false;
            const closedDate = new Date(s.closed_at);
            return closedDate >= date.from! && closedDate <= date.to!;
        });
    }, [shifts, date]);

    const handlePdfExport = () => {
        toast({ title: 'Coming Soon', description: 'PDF export for shifts is not yet available.' });
    };
    
    const handleExcelExport = () => {
        toast({ title: 'Coming Soon', description: 'Excel export for shifts is not yet available.' });
    };

    return (
        <div className="flex min-h-screen w-full flex-col bg-muted/40">
           <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6 z-10">
                <Button variant="outline" size="icon" className="shrink-0" asChild>
                    <Link to="/dashboard/reports">
                        <ArrowLeft className="h-4 w-4" />
                        <span className="sr-only">Back to Reports</span>
                    </Link>
                </Button>
                <div className="flex-1">
                    <h1 className="text-lg font-semibold flex items-center gap-2">
                        <BookOpen className="h-5 w-5" /> Shift History
                    </h1>
                </div>
                <div className="flex items-center gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" disabled={filteredShifts.length === 0}>
                            <FileDown className="mr-2 h-4 w-4" />
                            <span>Export</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={handleExcelExport}>
                                <FileDown className="mr-2 h-4 w-4"/> Excel (.xlsx)
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={handlePdfExport}>
                                <FileText className="mr-2 h-4 w-4"/> PDF (.pdf)
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <NotificationBell />
                    <ThemeToggle />
                </div>
           </header>
          <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
            <Card>
                <CardHeader>
                     <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <CardTitle>Closed Shifts</CardTitle>
                            {date?.from && date?.to && (
                                <CardDescription>
                                    A history of all closed shifts from {format(date.from, 'PPP')} to {format(date.to, 'PPP')}.
                                </CardDescription>
                            )}
                        </div>
                        <DateRangeFilter date={date} setDate={setDate} />
                    </div>
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
                                    <TableRow key={s.id} onClick={() => navigate(`/dashboard/shifts/${s.id}`)} className="cursor-pointer">
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
