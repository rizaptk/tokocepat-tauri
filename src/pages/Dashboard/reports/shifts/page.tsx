import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '@/lib/store';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import { ArrowLeft, BookOpen, AlertTriangle, FileDown, FileText } from 'lucide-react';
import React, { useMemo } from 'react';
import { DateRange } from 'react-day-picker';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Shift } from '@/lib/types';
import { DateRangeFilter } from '@/components/DateRangeFilter';
import { useDeviceScope } from '@/hooks/useDeviceScope';
import { DeviceScopeFilter } from '@/components/DeviceScopeFilter';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { NotificationBell } from '@/components/NotificationBell';
import { ThemeToggle } from '@/components/ThemeButtons';

import { exportShiftsToExcel, exportShiftsToPdf } from '@/lib/export';


const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(amount);
};

export default function ShiftsReportPage() {
    const navigate = useNavigate();
    const { shifts, storeConfig } = useStore();
    const { activeDeviceId, devices } = useDeviceScope();
    const { toast } = useToast();
    const [date, setDate] = React.useState<DateRange | undefined>({
      from: startOfDay(subDays(new Date(), 29)),
      to: endOfDay(new Date()),
    });

    const filteredShifts = useMemo(() => {
        if (!date?.from || !date?.to) return [];
        return shifts.filter(s => {
            if (s.status !== 'closed' || !s.closed_at) return false;
            if (activeDeviceId && s.device && s.device !== activeDeviceId) return false;
            const closedDate = new Date(s.closed_at);
            return closedDate >= date.from! && closedDate <= date.to!;
        });
    }, [shifts, date, activeDeviceId]);

    const handlePdfExport = async () => {
        if (storeConfig && date?.from && date?.to) {
            await exportShiftsToPdf(filteredShifts, { from: date.from, to: date.to }, storeConfig.store_name);
        } else {
            toast({ variant: 'destructive', title: 'Export Failed', description: 'Store config or date range missing.' });
        }
    };
    
    const handleExcelExport = async () => {
        if (storeConfig && date?.from && date?.to) {
            await exportShiftsToExcel(filteredShifts, { from: date.from, to: date.to }, storeConfig.store_name);
        } else {
            toast({ variant: 'destructive', title: 'Export Failed', description: 'Store config or date range missing.' });
        }
    };

    return (
        <div className="flex min-h-screen w-full flex-col bg-muted/40">
           <header className="sticky top-0 flex h-12 items-center gap-4 border-b border-border/60 bg-background/80 px-4 backdrop-blur-md z-20">
                <Button variant="outline" size="icon" className="shrink-0" asChild>
                    <Link to="#" onClick={() => navigate(-1)}>
                        <ArrowLeft className="h-4 w-4" />
                        <span className="sr-only">Kembali</span>
                    </Link>
                </Button>
                <div className="flex-1">
                    <h1 className="text-lg font-semibold flex items-center gap-2">
                        <BookOpen className="h-5 w-5" /> Riwayat Sif
                    </h1>
                </div>
                <div className="flex items-center gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" disabled={filteredShifts.length === 0}>
                            <FileDown className="mr-2 h-4 w-4" />
                            <span>Ekspor</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={handleExcelExport}>
                                <FileDown className="mr-2 h-4 w-4 text-green-500"/> Excel (.xlsx)
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={handlePdfExport}>
                                <FileText className="mr-2 h-4 w-4 text-red-400"/> PDF (.pdf)
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
                            <CardTitle>Sif Berakhir</CardTitle>
                            {date?.from && date?.to && (
                                <CardDescription>
                                    Daftar sif yang telah ditutup dari {format(date.from, 'dd MMM yyyy')} s/d {format(date.to, 'dd MMM yyyy')}.
                                </CardDescription>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <DateRangeFilter date={date} setDate={setDate} preset='last30' />
                            <DeviceScopeFilter />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Waktu</TableHead>
                                <TableHead>Perangkat</TableHead>
                                <TableHead>Kas Awal</TableHead>
                                <TableHead>Ekspektasi</TableHead>
                                <TableHead>Aktual</TableHead>
                                <TableHead>Selisih</TableHead>
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
                                        <TableCell>{devices.find(d => d.id === s.device)?.name || s.device || '-'}</TableCell>
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
                                    <TableCell colSpan={6} className="h-24 text-center">
                                        Tidak ada data sif pada periode ini.
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
