import { useMemo, useState } from 'react';
import { usePdfGeneration, PdfGeneratingOverlay } from '@/hooks/usePdfGeneration';
import { Link, useNavigate } from 'react-router-dom';
import { DateRange } from 'react-day-picker';
import { startOfDay, endOfDay, subDays, format } from 'date-fns';
import { ArrowLeft, Wallet, AlertTriangle, CheckCircle, Clock, FileDown, Users } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DateRangeFilter } from '@/components/DateRangeFilter';
import { DeviceScopeFilter } from '@/components/DeviceScopeFilter';
import { useDeviceScope } from '@/hooks/useDeviceScope';
import { useLoadTransactions } from '@/hooks/useLoadTransaction';
import { formatIDR } from '@/lib/format';
import { NotificationBell } from '@/components/NotificationBell';
import { ThemeToggle } from '@/components/ThemeButtons';
import * as XLSX from 'xlsx';


function daysOverdue(due?: string) {
  if (!due) return 0;
  const t = new Date(due).getTime();
  if (isNaN(t)) return 0;
  const diff = Date.now() - t;
  return diff > 0 ? Math.floor(diff / (24 * 60 * 60 * 1000)) : 0;
}

function agingBucket(days: number): string {
  if (days <= 0) return 'Belum Jatuh Tempo';
  if (days <= 7) return '1-7 hari';
  if (days <= 14) return '8-14 hari';
  if (days <= 30) return '15-30 hari';
  return '>30 hari (Macet)';
}

export default function PiutangReportPage() {
  const [date, setDate] = useState<DateRange | undefined>({ from: startOfDay(subDays(new Date(), 29)), to: endOfDay(new Date()) });
  const { activeDeviceId } = useDeviceScope();
  const { transactions } = useLoadTransactions(date, activeDeviceId);
  const nav = useNavigate();

  const piutangTx = useMemo(() => {
    return transactions.filter(t => (t as any).is_wholesale && (t as any).payment_status && (t as any).payment_status !== 'lunas' && t.status !== 'voided');
  }, [transactions]);

  const allWholesale = useMemo(() => transactions.filter(t => (t as any).is_wholesale && t.status !== 'voided'), [transactions]);
  const lunasTx = useMemo(() => allWholesale.filter(t => (t as any).payment_status === 'lunas'), [allWholesale]);

  const stats = useMemo(() => {
    let totalPiutang = 0;
    let totalLunas = 0;
    let overdueCount = 0;
    let overdueAmount = 0;
    let menunggu = 0; // not yet due
    let macet = 0;
    for (const t of piutangTx) {
      const sisa = t.total - (t.cash_paid || 0);
      totalPiutang += Math.max(0, sisa);
      const od = daysOverdue((t as any).due_date);
      if (od > 0) { overdueCount++; overdueAmount += Math.max(0, sisa); if (od > 30) macet += Math.max(0, sisa); }
      else menunggu += Math.max(0, sisa);
    }
    for (const t of lunasTx) totalLunas += t.total;
    return { totalPiutang, overdueCount, overdueAmount, menunggu, macet, totalLunas, count: piutangTx.length, lunasCount: lunasTx.length };
  }, [piutangTx, lunasTx]);

  const agingData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of piutangTx) {
      const sisa = t.total - (t.cash_paid || 0);
      const bucket = agingBucket(daysOverdue((t as any).due_date));
      map[bucket] = (map[bucket] || 0) + sisa;
    }
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [piutangTx]);

  const statusData = useMemo(() => {
    const piutang = piutangTx.filter(t => (t as any).payment_status === 'piutang').length;
    const cicilan = piutangTx.filter(t => (t as any).payment_status === 'lunas_sebagian').length;
    const lunas = lunasTx.length;
    return [
      { name: 'Piutang', value: piutang },
      { name: 'Cicilan', value: cicilan },
      { name: 'Lunas', value: lunas },
    ].filter(d => d.value > 0);
  }, [piutangTx, lunasTx]);

  const topCustomers = useMemo(() => {
    const map: Record<string, { name: string; total: number; count: number }> = {};
    for (const t of piutangTx) {
      const name = (t as any).customer_name_snapshot || 'Tanpa Nama';
      const sisa = t.total - (t.cash_paid || 0);
      if (!map[name]) map[name] = { name, total: 0, count: 0 };
      map[name].total += sisa;
      map[name].count++;
    }
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [piutangTx]);

  const handleExportExcel = () => {
    const rows = piutangTx.map(t => ({
      Invoice: t.invoice_number,
      Pelanggan: (t as any).customer_name_snapshot || '-',
      Grup: (t as any).customer_group_snapshot || '-',
      Tanggal: format(new Date(t.created_at), 'dd/MM/yyyy'),
      JatuhTempo: (t as any).due_date ? format(new Date((t as any).due_date), 'dd/MM/yyyy') : '-',
      Total: t.total,
      Dibayar: t.cash_paid || 0,
      Sisa: t.total - (t.cash_paid || 0),
      Status: (t as any).payment_status,
      Overdue: daysOverdue((t as any).due_date),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Piutang');
    XLSX.writeFile(wb, `laporan-piutang-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6'];

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
      <header className="sticky top-0 z-20 flex h-10 items-center gap-4 border-b border-border/60 bg-background/80 px-4 backdrop-blur-md">
        <Button variant="outline" size="icon" className="shrink-0" asChild>
          <Link to="#" onClick={() => nav(-1)}><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <h1 className="text-lg font-semibold flex items-center gap-2"><Wallet className="h-5 w-5" /> Laporan Piutang</h1>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportExcel}><FileDown className="mr-2 h-4 w-4" /> Excel</Button>
          <NotificationBell />
          <ThemeToggle />
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <DateRangeFilter date={date} setDate={setDate} preset="last30" />
          <DeviceScopeFilter />
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Piutang</CardTitle><Wallet className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold text-destructive tabular-nums">{formatIDR(stats.totalPiutang)}</div><p className="text-xs text-muted-foreground">{stats.count} tagihan aktif</p></CardContent></Card>
          <Card className="border-amber-200"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Menunggak</CardTitle><AlertTriangle className="h-4 w-4 text-amber-500" /></CardHeader><CardContent><div className="text-2xl font-bold tabular-nums">{formatIDR(stats.overdueAmount)}</div><p className="text-xs text-muted-foreground">{stats.overdueCount} lewat jatuh tempo</p></CardContent></Card>
          <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Macet (&gt;30h)</CardTitle><Clock className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold tabular-nums">{formatIDR(stats.macet)}</div><p className="text-xs text-muted-foreground">{piutangTx.filter(t => daysOverdue((t as any).due_date) > 30).length} tagihan</p></CardContent></Card>
          <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Lunas (periode)</CardTitle><CheckCircle className="h-4 w-4 text-green-500" /></CardHeader><CardContent><div className="text-2xl font-bold tabular-nums">{formatIDR(stats.totalLunas)}</div><p className="text-xs text-muted-foreground">{stats.lunasCount} transaksi</p></CardContent></Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-sm">Aging Piutang</CardTitle><CardDescription>Sisa tagihan per kelompok umur</CardDescription></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={agingData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={11} />
                  <YAxis fontSize={11} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: any) => formatIDR(v)} />
                  <Bar dataKey="value" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Status Piutang</CardTitle><CardDescription>Piutang vs Cicilan vs Lunas</CardDescription></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Top Pelanggan Menunggak</CardTitle><CardDescription>5 pelanggan dengan sisa piutang terbesar</CardDescription></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Pelanggan</TableHead><TableHead className="text-right">Tagihan</TableHead><TableHead className="text-right">Sisa</TableHead></TableRow></TableHeader>
              <TableBody>
                {topCustomers.length === 0 ? <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">Belum ada piutang</TableCell></TableRow> : topCustomers.map(c => (
                  <TableRow key={c.name}><TableCell className="font-medium flex items-center gap-2"><Users className="h-3.5 w-3.5" />{c.name}</TableCell><TableCell className="text-right">{c.count}x</TableCell><TableCell className="text-right font-bold text-destructive tabular-nums">{formatIDR(c.total)}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Detail Piutang</CardTitle><CardDescription>{piutangTx.length} tagihan aktif dalam periode terpilih</CardDescription></CardHeader>
          <CardContent className="p-0 overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-card"><TableRow><TableHead>Invoice</TableHead><TableHead>Pelanggan</TableHead><TableHead>Jatuh Tempo</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Sisa</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {piutangTx.map(tx => {
                  const sisa = tx.total - (tx.cash_paid || 0);
                  const od = daysOverdue((tx as any).due_date);
                  return (
                    <TableRow key={tx.id}>
                      <TableCell className="font-mono text-xs">{tx.invoice_number}</TableCell>
                      <TableCell>{(tx as any).customer_name_snapshot || '-'}<div className="text-xs text-muted-foreground">{(tx as any).customer_group_snapshot || ''}</div></TableCell>
                      <TableCell className={od > 0 ? 'text-destructive' : ''}>{(tx as any).due_date ? format(new Date((tx as any).due_date), 'dd MMM yyyy') : '-'} {od > 0 && <Badge variant="destructive" className="ml-1">+{od}h</Badge>}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatIDR(tx.total)}</TableCell>
                      <TableCell className="text-right font-bold tabular-nums text-destructive">{formatIDR(sisa)}</TableCell>
                      <TableCell>{(tx as any).payment_status === 'piutang' ? <Badge variant="destructive">Piutang</Badge> : <Badge variant="secondary">Cicilan</Badge>}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
