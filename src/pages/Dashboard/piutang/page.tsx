import { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { useDbStore } from '@/lib/db-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Wallet, AlertTriangle, CheckCircle, Clock, Search, CreditCard } from 'lucide-react';
import { formatIDR } from '@/lib/format';
import { useToast } from '@/hooks/use-toast';

function daysOverdue(due?: string) {
  if (!due) return 0;
  const d = new Date(due).getTime();
  if (isNaN(d)) return 0;
  const diff = Date.now() - d;
  return diff > 0 ? Math.floor(diff / (24 * 60 * 60 * 1000)) : 0;
}

export default function PiutangPage() {
  const { transactions, customers } = useStore();
  const { toast } = useToast();
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'piutang' | 'lunas_sebagian' | 'overdue'>('all');
  const [payOpen, setPayOpen] = useState(false);
  const [payTx, setPayTx] = useState<any>(null);
  const [payAmount, setPayAmount] = useState('');

  const piutangTx = useMemo(() => {
    return transactions.filter(t => (t as any).is_wholesale && (t as any).payment_status && (t as any).payment_status !== 'lunas' && t.status !== 'voided')
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [transactions]);

  const filtered = useMemo(() => {
    let list = piutangTx;
    if (q.trim()) {
      const term = q.toLowerCase();
      list = list.filter(t => `${t.invoice_number} ${(t as any).customer_name_snapshot || ''}`.toLowerCase().includes(term));
    }
    if (statusFilter === 'piutang') list = list.filter(t => (t as any).payment_status === 'piutang');
    if (statusFilter === 'lunas_sebagian') list = list.filter(t => (t as any).payment_status === 'lunas_sebagian');
    if (statusFilter === 'overdue') list = list.filter(t => daysOverdue((t as any).due_date) > 0);
    return list;
  }, [piutangTx, q, statusFilter]);

  const summary = useMemo(() => {
    let totalPiutang = 0;
    let overdueCount = 0;
    let totalOverdue = 0;
    for (const t of piutangTx) {
      const sisa = t.total - (t.cash_paid || 0);
      totalPiutang += Math.max(0, sisa);
      const od = daysOverdue((t as any).due_date);
      if (od > 0) { overdueCount++; totalOverdue += Math.max(0, sisa); }
    }
    return { totalPiutang, overdueCount, totalOverdue, count: piutangTx.length };
  }, [piutangTx]);

  const openPay = (tx: any) => {
    setPayTx(tx);
    const sisa = tx.total - (tx.cash_paid || 0);
    setPayAmount(String(sisa));
    setPayOpen(true);
  };

  const handlePay = async () => {
    if (!payTx) return;
    const amt = parseFloat(payAmount) || 0;
    if (amt <= 0) { toast({ variant: 'destructive', title: 'Jumlah tidak valid' }); return; }
    const sisa = payTx.total - (payTx.cash_paid || 0);
    if (amt > sisa + 0.01) { toast({ variant: 'destructive', title: 'Melebihi sisa tagihan' }); return; }
    const { db, firesqlite } = useDbStore.getState();
    if (!db || !firesqlite) { toast({ variant: 'destructive', title: 'DB belum siap' }); return; }
    const { doc, updateDoc, setDoc } = firesqlite as any;
    const newPaid = (payTx.cash_paid || 0) + amt;
    const newStatus = newPaid >= payTx.total - 0.01 ? 'lunas' : 'lunas_sebagian';
    try {
      await updateDoc(doc(db, 'transactions', payTx.id), { cash_paid: newPaid, payment_status: newStatus, change: newPaid - payTx.total });
      // audit payment
      const payId = `pay-${crypto.randomUUID().slice(0, 8)}`;
      await setDoc(doc(db, 'customer_payments', payId), {
        id: payId,
        customer_id: (payTx as any).customer_id,
        transaction_id: payTx.id,
        amount: amt,
        created_at: new Date().toISOString(),
      });
      toast({ title: newStatus === 'lunas' ? 'Piutang lunas' : 'Pembayaran dicatat', description: `${(payTx as any).customer_name_snapshot || payTx.invoice_number} +${formatIDR(amt)}` });
      setPayOpen(false);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Gagal', description: e.message });
    }
  };

  return (
    <div className="flex h-screen w-full flex-col bg-muted/40">
      <header className="flex h-12 items-center gap-3 border-b bg-background px-4">
        <Wallet className="h-5 w-5" />
        <h1 className="text-lg font-semibold">Piutang Grosir</h1>
        <span className="text-xs text-muted-foreground">{summary.count} tagihan aktif</span>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari invoice / pelanggan..." className="h-8 w-64 pl-8" />
          </div>
          <Select value={statusFilter} onValueChange={v => setStatusFilter(v as any)}>
            <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua</SelectItem>
              <SelectItem value="piutang">Piutang</SelectItem>
              <SelectItem value="lunas_sebagian">Cicilan</SelectItem>
              <SelectItem value="overdue">Jatuh Tempo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-3 p-3">
        <Card><CardHeader className="py-2 px-3"><CardTitle className="text-xs font-medium text-muted-foreground">Total Piutang</CardTitle></CardHeader><CardContent className="px-3 pb-3"><p className="text-xl font-bold tabular-nums">{formatIDR(summary.totalPiutang)}</p><p className="text-xs text-muted-foreground">{summary.count} transaksi</p></CardContent></Card>
        <Card className={summary.overdueCount > 0 ? 'border-destructive/50' : ''}><CardHeader className="py-2 px-3"><CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Jatuh Tempo</CardTitle></CardHeader><CardContent className="px-3 pb-3"><p className="text-xl font-bold tabular-nums text-destructive">{formatIDR(summary.totalOverdue)}</p><p className="text-xs text-muted-foreground">{summary.overdueCount} tagihan lewat</p></CardContent></Card>
        <Card><CardHeader className="py-2 px-3"><CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Pelanggan</CardTitle></CardHeader><CardContent className="px-3 pb-3"><p className="text-xl font-bold">{customers.length}</p><p className="text-xs text-muted-foreground">terdaftar</p></CardContent></Card>
      </div>

      <div className="flex-1 overflow-auto px-3 pb-3">
        <div className="rounded-md border bg-card overflow-hidden">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow><TableHead>Invoice</TableHead><TableHead>Pelanggan</TableHead><TableHead>Tanggal</TableHead><TableHead>Jatuh Tempo</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Sisa</TableHead><TableHead>Status</TableHead><TableHead className="w-24">Aksi</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">Tidak ada piutang {statusFilter !== 'all' ? `(${statusFilter})` : ''}</TableCell></TableRow>
              ) : filtered.map(tx => {
                const sisa = tx.total - (tx.cash_paid || 0);
                const od = daysOverdue((tx as any).due_date);
                const dueStr = (tx as any).due_date ? new Date((tx as any).due_date).toLocaleDateString('id-ID') : '-';
                return (
                  <TableRow key={tx.id}>
                    <TableCell className="font-mono text-xs font-medium">{tx.invoice_number}</TableCell>
                    <TableCell><div className="font-medium text-sm">{(tx as any).customer_name_snapshot || '-'}</div><div className="text-xs text-muted-foreground">{(tx as any).customer_group_snapshot || ''}</div></TableCell>
                    <TableCell className="text-xs">{new Date(tx.created_at).toLocaleDateString('id-ID')}</TableCell>
                    <TableCell className={od > 0 ? 'text-destructive font-medium' : ''}>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{dueStr}</span>
                      {od > 0 && <span className="text-xs text-destructive">+{od} hari</span>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">{formatIDR(tx.total)}</TableCell>
                    <TableCell className="text-right tabular-nums font-bold text-destructive">{formatIDR(sisa)}</TableCell>
                    <TableCell>
                      {(tx as any).payment_status === 'piutang' ? <Badge variant="destructive">Piutang</Badge> : <Badge variant="secondary">Cicilan</Badge>}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" onClick={() => openPay(tx)}><CreditCard className="h-3.5 w-3.5 mr-1" /> Bayar</Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Bayar Piutang — {payTx?.invoice_number}</DialogTitle></DialogHeader>
          {payTx && (
            <div className="space-y-3">
              <div className="rounded-md bg-muted p-3 text-sm space-y-1">
                <div className="flex justify-between"><span>Pelanggan</span><span className="font-medium">{(payTx as any).customer_name_snapshot}</span></div>
                <div className="flex justify-between"><span>Total</span><span>{formatIDR(payTx.total)}</span></div>
                <div className="flex justify-between"><span>Sudah dibayar</span><span>{formatIDR(payTx.cash_paid || 0)}</span></div>
                <div className="flex justify-between font-bold border-t pt-1"><span>Sisa</span><span className="text-destructive">{formatIDR(payTx.total - (payTx.cash_paid || 0))}</span></div>
              </div>
              <div><Label>Jumlah Bayar</Label><Input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="0" /></div>
            </div>
          )}
          <DialogFooter><Button onClick={handlePay}>Konfirmasi Bayar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
