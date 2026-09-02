import { useMemo, useState, useRef } from 'react';
import { useStore } from '@/lib/store';
import { useDbStore } from '@/lib/db-store';
import { useLoadTransactions } from '@/hooks/useLoadTransaction';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Wallet, AlertTriangle, CheckCircle, Clock, Search, CreditCard, X, Mail, History } from 'lucide-react';
import { formatIDR } from '@/lib/format';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Transaction } from '@/lib/types';
import { ThemeToggle } from '@/components/ThemeButtons';
import { NotificationBell } from '@/components/NotificationBell';
import { usePdfGeneration, PdfGeneratingOverlay } from '@/hooks/usePdfGeneration';
import { PdfPreviewSheet } from '@/components/PdfPreviewSheet';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { cn } from '@/lib/utils';

function daysOverdue(due?: string) {
  if (!due) return 0;
  const d = new Date(due).getTime();
  if (isNaN(d)) return 0;
  const diff = Date.now() - d;
  return diff > 0 ? Math.floor(diff / (24 * 60 * 60 * 1000)) : 0;
}

type PiutangTx = Transaction & { due_date?: string; customer_name_snapshot?: string; customer_group_snapshot?: string };

function PillButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        "rounded-md px-3 h-7 shrink-0 text-xs gap-1.5",
        active ? "bg-background text-foreground ring-1 ring-inset ring-border" : "text-muted-foreground hover:text-foreground"
      )}
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

// Build surat tagihan PDF — polite, non-offensive wording. One letter per customer, lists all overdue invoices for that customer.
async function buildSuratTagihanPdfBytes(
  customerName: string,
  customerGroup: string | undefined,
  invoices: PiutangTx[],
  storeConfig: any
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const page = pdfDoc.addPage([595, 842]); // A4
  const { width, height } = page.getSize();
  const margin = 48;
  let y = height - margin;

  const storeName = storeConfig?.store_name || 'Toko';
  const storeAddr = storeConfig?.address || '';
  const todayStr = format(new Date(), 'd MMMM yyyy', { locale: localeId });

  // Kop surat
  page.drawText(storeName, { x: margin, y, font: boldFont, size: 14, color: rgb(0.13, 0.13, 0.13) });
  y -= 14;
  if (storeAddr) {
    page.drawText(storeAddr, { x: margin, y, font, size: 8, color: rgb(0.4, 0.4, 0.4) });
    y -= 12;
  }
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1.5, color: rgb(0.13, 0.4, 0.8) });
  y -= 18;

  // Judul
  page.drawText('Surat Pengingat Tagihan', { x: width / 2 - 70, y, font: boldFont, size: 13, color: rgb(0.13, 0.13, 0.13) });
  y -= 18;
  page.drawText(`No: TAG-${format(new Date(), 'yyyyMMdd')}-${(customerName.slice(0,3) || 'CUS').toUpperCase()}`, { x: margin, y, font, size: 7, color: rgb(0.5, 0.5, 0.5) });
  page.drawText(todayStr, { x: width - margin - 90, y, font, size: 8, color: rgb(0.3, 0.3, 0.3) });
  y -= 20;

  // Kepada
  page.drawText('Kepada Yth.', { x: margin, y, font, size: 9, color: rgb(0.2, 0.2, 0.2) });
  y -= 12;
  page.drawText(`Bapak/Ibu ${customerName}`, { x: margin, y, font: boldFont, size: 10, color: rgb(0.13, 0.13, 0.13) });
  y -= 12;
  if (customerGroup) {
    page.drawText(`Grup: ${customerGroup}`, { x: margin, y, font, size: 8, color: rgb(0.4, 0.4, 0.4) });
    y -= 12;
  }
  page.drawText('di Tempat', { x: margin, y, font, size: 9, color: rgb(0.2, 0.2, 0.2) });
  y -= 20;

  // Salam pembuka — tidak ofensif, menghargai
  const intro = `Dengan hormat,`;
  page.drawText(intro, { x: margin, y, font, size: 9, color: rgb(0.2, 0.2, 0.2) });
  y -= 12;
  const p1 = `Terima kasih atas kepercayaan Bapak/Ibu berbelanja di ${storeName}. Semoga Bapak/Ibu senantiasa sehat dan usaha lancar.`;
  // simple wrap
  const maxW = width - margin * 2;
  const wrap = (text: string, size: number, maxWidth: number) => {
    const words = text.split(' ');
    const lines: string[] = [];
    let cur = '';
    for (const w of words) {
      const test = cur ? `${cur} ${w}` : w;
      if (font.widthOfTextAtSize(test, size) > maxWidth) {
        if (cur) lines.push(cur);
        cur = w;
      } else cur = test;
    }
    if (cur) lines.push(cur);
    return lines;
  };
  for (const line of wrap(p1, 9, maxW)) {
    page.drawText(line, { x: margin, y, font, size: 9, color: rgb(0.2, 0.2, 0.2) });
    y -= 11;
  }
  y -= 6;
  const p2 = `Bersama surat ini, kami menyampaikan pengingat tagihan yang telah melewati jatuh tempo. Kami memahami kesibukan Bapak/Ibu, dan mohon maaf apabila pembayaran telah dilakukan sebelum surat ini diterima.`;
  for (const line of wrap(p2, 9, maxW)) {
    page.drawText(line, { x: margin, y, font, size: 9, color: rgb(0.2, 0.2, 0.2) });
    y -= 11;
  }
  y -= 8;

  page.drawText('Rincian tagihan:', { x: margin, y, font: boldFont, size: 9, color: rgb(0.13, 0.13, 0.13) });
  y -= 14;

  // Table header
  const headers = ['No', 'Invoice', 'Tanggal', 'Jatuh Tempo', 'Hari Lewat', 'Total', 'Sisa'];
  const colW = [28, 110, 80, 80, 64, 70, 70];
  let x = margin;
  // header bg
  page.drawRectangle({ x: margin - 2, y: y - 4, width: colW.reduce((a,b)=>a+b,0)+4, height: 14, color: rgb(0.94, 0.94, 0.94) });
  headers.forEach((h, i) => {
    page.drawText(h, { x: x + 2, y, font: boldFont, size: 7, color: rgb(0.2, 0.2, 0.2) });
    x += colW[i];
  });
  y -= 12;
  page.drawLine({ start: { x: margin, y: y + 8 }, end: { x: width - margin, y: y + 8 }, thickness: 0.6, color: rgb(0.8, 0.8, 0.8) });

  let totalSisa = 0;
  invoices.forEach((tx, idx) => {
    if (y < 90) {
      // for simplicity, we do not add new page for this letter (typically few invoices)
    }
    const sisa = Math.max(0, tx.total - (tx.cash_paid || 0));
    totalSisa += sisa;
    const od = daysOverdue((tx as any).due_date);
    const row = [
      String(idx + 1),
      tx.invoice_number,
      format(new Date(tx.created_at), 'dd/MM/yy', { locale: localeId }),
      (tx as any).due_date ? format(new Date((tx as any).due_date), 'dd/MM/yy', { locale: localeId }) : '-',
      od > 0 ? `${od} hari` : '-',
      new Intl.NumberFormat('id-ID').format(tx.total),
      new Intl.NumberFormat('id-ID').format(sisa),
    ];
    let cx = margin;
    row.forEach((cell, i) => {
      const alignRight = i >= 5;
      const cellW = colW[i] - 4;
      let tx_ = cell;
      // truncate if too wide
      while (font.widthOfTextAtSize(tx_, 7) > cellW && tx_.length > 8) tx_ = tx_.slice(0, -4) + '…';
      const txX = alignRight ? cx + colW[i] - 2 - font.widthOfTextAtSize(tx_, 7) : cx + 2;
      page.drawText(tx_, { x: txX, y, font: i >= 5 ? boldFont : font, size: 7, color: i === 6 ? rgb(0.8, 0.15, 0.15) : rgb(0.2, 0.2, 0.2) });
      cx += colW[i];
    });
    y -= 10;
  });

  // total
  y -= 4;
  page.drawLine({ start: { x: margin, y: y + 8 }, end: { x: width - margin, y: y + 8 }, thickness: 0.8, color: rgb(0.2, 0.2, 0.2) });
  const totalLabel = 'Total Sisa Tagihan';
  page.drawText(totalLabel, { x: margin + 2, y, font: boldFont, size: 8, color: rgb(0.13, 0.13, 0.13) });
  const totalStr = `Rp ${new Intl.NumberFormat('id-ID').format(totalSisa)}`;
  page.drawText(totalStr, { x: width - margin - 2 - boldFont.widthOfTextAtSize(totalStr, 9), y, font: boldFont, size: 9, color: rgb(0.8, 0.15, 0.15) });
  y -= 22;

  // Penutup — tidak ofensif
  const closing = [
    `Kami sangat menghargai kerja sama Bapak/Ibu selama ini. Apabila berkenan, pembayaran dapat dilakukan di kasir ${storeName} atau melalui transfer dengan konfirmasi kepada kami.`,
    `Jika ada pertanyaan atau perlu penyesuaian jadwal, silakan hubungi kami — kami siap membantu.`,
    `Atas perhatian dan kerja samanya, kami ucapkan terima kasih.`,
  ];
  for (const para of closing) {
    for (const line of wrap(para, 9, maxW)) {
      if (y < 70) break;
      page.drawText(line, { x: margin, y, font, size: 9, color: rgb(0.2, 0.2, 0.2) });
      y -= 11;
    }
    y -= 6;
  }

  // Tanda tangan
  y = Math.max(y, 70);
  page.drawText('Hormat kami,', { x: margin, y, font, size: 9, color: rgb(0.2, 0.2, 0.2) });
  y -= 22;
  page.drawText(storeName, { x: margin, y, font: boldFont, size: 10, color: rgb(0.13, 0.13, 0.13) });
  y -= 12;
  page.drawText('Petugas Piutang', { x: margin, y, font, size: 8, color: rgb(0.5, 0.5, 0.5) });

  // footer kecil
  page.drawText('Surat ini bersifat pengingat kekeluargaan, bukan penagihan paksa.', { x: margin, y: 32, font, size: 6, color: rgb(0.6, 0.6, 0.6) });

  return pdfDoc.save() as Promise<Uint8Array>;
}

export default function PiutangPage() {
  const { customers, storeConfig } = useStore();
  const { isInitialized } = useDbStore();
  const { transactions, isLoading } = useLoadTransactions(undefined, 'all');
  const { toast } = useToast();
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'piutang' | 'lunas_sebagian' | 'overdue'>('all');
  const [payOpen, setPayOpen] = useState(false);
  const [payTx, setPayTx] = useState<PiutangTx | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payError, setPayError] = useState<string | null>(null);
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [activeTab, setActiveTab] = useState<'aktif' | 'riwayat'>('aktif');
  const suratPdf = usePdfGeneration();
  const [isGeneratingSurat, setIsGeneratingSurat] = useState(false);

  const piutangTx = useMemo(() => {
    return (transactions as PiutangTx[])
      .filter(t => t.is_wholesale && t.payment_status && t.payment_status !== 'lunas' && t.status !== 'voided')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [transactions]);

  const historyTx = useMemo(() => {
    return (transactions as PiutangTx[])
      .filter(t => t.is_wholesale && t.payment_status === 'lunas' && t.status !== 'voided')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [transactions]);

  const derived = useMemo(() => {
    return piutangTx.map(t => {
      const sisa = t.total - (t.cash_paid || 0);
      const od = daysOverdue(t.due_date);
      return { t, sisa: Math.max(0, sisa), od };
    });
  }, [piutangTx]);

  const historyDerived = useMemo(() => {
    return historyTx.map(t => ({ t, sisa: 0, od: 0 }));
  }, [historyTx]);

  const filtered = useMemo(() => {
    let list = derived;
    if (q.trim()) {
      const term = q.toLowerCase();
      list = list.filter(({ t }) => `${t.invoice_number} ${t.customer_name_snapshot || ''}`.toLowerCase().includes(term));
    }
    if (statusFilter === 'piutang') list = list.filter(({ t }) => t.payment_status === 'piutang');
    if (statusFilter === 'lunas_sebagian') list = list.filter(({ t }) => t.payment_status === 'lunas_sebagian');
    if (statusFilter === 'overdue') list = list.filter(({ od }) => od > 0);
    return list;
  }, [derived, q, statusFilter]);

  const filteredHistory = useMemo(() => {
    let list = historyDerived;
    if (q.trim()) {
      const term = q.toLowerCase();
      list = list.filter(({ t }) => `${t.invoice_number} ${t.customer_name_snapshot || ''}`.toLowerCase().includes(term));
    }
    return list;
  }, [historyDerived, q]);

  const summary = useMemo(() => {
    let totalPiutang = 0;
    let overdueCount = 0;
    let totalOverdue = 0;
    for (const { sisa, od } of derived) {
      totalPiutang += sisa;
      if (od > 0) { overdueCount++; totalOverdue += sisa; }
    }
    return { totalPiutang, overdueCount, totalOverdue, count: derived.length };
  }, [derived]);

  const historySummary = useMemo(() => {
    let totalLunas = 0;
    for (const { t } of historyDerived) totalLunas += t.total;
    return { totalLunas, count: historyDerived.length };
  }, [historyDerived]);

  // Group overdue invoices by customer for surat tagihan (one letter per customer)
  const overdueByCustomer = useMemo(() => {
    const map = new Map<string, PiutangTx[]>();
    for (const { t, od } of derived) {
      if (od <= 0) continue;
      const key = (t as any).customer_id || t.customer_name_snapshot || t.id;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return map;
  }, [derived]);

  const openPay = (row: PiutangTx, trigger: HTMLButtonElement | null) => {
    lastTriggerRef.current = trigger;
    setPayTx(row);
    const sisa = row.total - (row.cash_paid || 0);
    setPayAmount(String(Math.max(0, Math.floor(sisa))));
    setPayError(null);
    setPayOpen(true);
  };

  const handlePayOpenChange = (open: boolean) => {
    setPayOpen(open);
    if (!open) {
      setPayError(null);
      requestAnimationFrame(() => lastTriggerRef.current?.focus());
    }
  };

  const handlePay = async () => {
    if (!payTx) return;
    const amt = parseFloat(payAmount) || 0;
    const sisa = payTx.total - (payTx.cash_paid || 0);
    if (amt <= 0) { setPayError('Jumlah harus lebih dari Rp 0.'); return; }
    if (amt > sisa + 0.01) { setPayError(`Melebihi sisa tagihan ${formatIDR(sisa)}.`); return; }
    const { db, firesqlite, isInitialized: ready } = useDbStore.getState();
    if (!ready || !db || !firesqlite) { setPayError('Database belum siap. Coba lagi.'); return; }
    const { doc, updateDoc, setDoc } = firesqlite as any;
    const newPaid = (payTx.cash_paid || 0) + amt;
    const newStatus = newPaid >= payTx.total - 0.01 ? 'lunas' : 'lunas_sebagian';
    try {
      await updateDoc(doc(db, 'transactions', payTx.id), { cash_paid: newPaid, payment_status: newStatus, change: newPaid - payTx.total });
      const payId = `pay-${crypto.randomUUID()}`;
      await setDoc(doc(db, 'customer_payments', payId), {
        id: payId,
        customer_id: payTx.customer_id,
        transaction_id: payTx.id,
        amount: amt,
        created_at: new Date().toISOString(),
      });
      toast({ title: newStatus === 'lunas' ? 'Piutang lunas' : 'Pembayaran dicatat', description: `${payTx.customer_name_snapshot || payTx.invoice_number} +${formatIDR(amt)}` });
      setPayOpen(false);
    } catch (e: any) {
      setPayError(e?.message || 'Gagal menyimpan pembayaran.');
    }
  };

  const handleCetakSurat = async (tx: PiutangTx) => {
    const customerId = (tx as any).customer_id as string | undefined;
    const customerName = tx.customer_name_snapshot || 'Pelanggan';
    const customerGroup = (tx as any).customer_group_snapshot as string | undefined;
    // one letter per customer: collect all overdue invoices for this customer
    let invoices: PiutangTx[] = [];
    if (customerId && overdueByCustomer.has(customerId)) {
      invoices = overdueByCustomer.get(customerId)!;
    } else {
      // fallback: find by name
      const keyByName = Array.from(overdueByCustomer.entries()).find(([, list]) => list.some(x => x.customer_name_snapshot === customerName));
      if (keyByName) invoices = keyByName[1];
      else invoices = [tx];
    }
    // dedupe and sort by due date
    invoices = [...invoices].sort((a,b) => new Date((a as any).due_date || a.created_at).getTime() - new Date((b as any).due_date || a.created_at).getTime());

    try {
      setIsGeneratingSurat(true);
      const group = customers.find(c => c.id === customerId) as any;
      const displayName = customerName;
      const displayGroup = customerGroup || group?.groupId;
      suratPdf.setTitle('Surat Tagihan');
      suratPdf.setFilename(`surat-tagihan-${displayName.replace(/\s+/g, '-')}.pdf`);
      suratPdf.start('Surat Tagihan');
      await new Promise(r => setTimeout(r, 30));
      const bytes = await buildSuratTagihanPdfBytes(displayName, displayGroup, invoices, storeConfig as any);
      suratPdf.finish(bytes);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Gagal cetak surat', description: e?.message || String(e) });
    } finally {
      setIsGeneratingSurat(false);
    }
  };

  const paySisa = payTx ? Math.max(0, payTx.total - (payTx.cash_paid || 0)) : 0;
  const payValid = payTx ? (() => { const v = parseFloat(payAmount) || 0; return v > 0 && v <= paySisa + 0.01; })() : false;

  const isAktif = activeTab === 'aktif';
  const displayList = isAktif ? filtered : filteredHistory;
  const displayCount = isAktif ? summary.count : historySummary.count;

  return (
    <div className="flex h-screen w-full flex-col bg-muted/40 selection:bg-primary selection:text-primary-foreground">
      <header className="sticky top-0 z-20 flex h-10 items-center gap-3 border-b border-border/60 bg-background/80 px-4 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-1.5 text-sm font-semibold tracking-tight">
          <Wallet className="h-4 w-4" aria-hidden /> Piutang Grosir
        </div>
        <div className="ml-auto flex items-center gap-2 min-w-0">
          <div className="relative hidden sm:block">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Label htmlFor="piutang-q" className="sr-only">Cari invoice atau pelanggan</Label>
            <Input
              id="piutang-q"
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Cari invoice / pelanggan..."
              className="h-8 w-64 pl-8 pr-8 bg-card"
              aria-label="Cari invoice atau pelanggan"
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ('')}
                className="absolute right-1 top-1/2 -translate-y-1/2 grid size-6 place-items-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                aria-label="Hapus pencarian"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            )}
          </div>
          <Label htmlFor="piutang-status" className="sr-only">Filter status</Label>
          <Select value={statusFilter} onValueChange={v => setStatusFilter(v as any)}>
            <SelectTrigger id="piutang-status" className="h-8 w-36 bg-card" aria-label="Filter status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua</SelectItem>
              <SelectItem value="piutang">Piutang</SelectItem>
              <SelectItem value="lunas_sebagian">Cicilan</SelectItem>
              <SelectItem value="overdue">Jatuh Tempo</SelectItem>
            </SelectContent>
          </Select>
          <NotificationBell />
          <ThemeToggle />
        </div>
      </header>

      {/* Mobile search — visible only below sm */}
      <div className="sm:hidden px-3 pt-2 shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Label htmlFor="piutang-q-mobile" className="sr-only">Cari invoice atau pelanggan</Label>
          <Input
            id="piutang-q-mobile"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Cari invoice / pelanggan..."
            className="h-8 w-full pl-8 pr-8 bg-card"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ('')}
              className="absolute right-1 top-1/2 -translate-y-1/2 grid size-6 place-items-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Hapus pencarian"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 shrink-0">
        {isAktif ? (
          <>
            <Card className="rounded-[2px]"><CardHeader className="p-3 pb-1"><CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Total Piutang</CardTitle></CardHeader><CardContent className="px-3 pb-3"><p className="text-2xl font-light tracking-tight tabular-nums">{formatIDR(summary.totalPiutang)}</p><p className="text-xs text-muted-foreground tabular-nums">{summary.count} transaksi</p></CardContent></Card>
            <Card className={summary.overdueCount > 0 ? 'rounded-[2px] border-destructive/50 bg-destructive/[0.03]' : 'rounded-[2px]'}><CardHeader className="p-3 pb-1"><CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-3 w-3" aria-hidden /> Jatuh Tempo</CardTitle></CardHeader><CardContent className="px-3 pb-3"><p className="text-2xl font-light tracking-tight tabular-nums text-destructive">{formatIDR(summary.totalOverdue)}</p><p className="text-xs text-muted-foreground">{summary.overdueCount} tagihan lewat</p></CardContent></Card>
            <Card className="rounded-[2px]"><CardHeader className="p-3 pb-1"><CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1"><CheckCircle className="h-3 w-3" aria-hidden /> Pelanggan</CardTitle></CardHeader><CardContent className="px-3 pb-3"><p className="text-2xl font-light tracking-tight tabular-nums">{customers.length}</p><p className="text-xs text-muted-foreground">terdaftar</p></CardContent></Card>
          </>
        ) : (
          <>
            <Card className="rounded-[2px]"><CardHeader className="p-3 pb-1"><CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1"><History className="h-3 w-3" aria-hidden /> Total Riwayat</CardTitle></CardHeader><CardContent className="px-3 pb-3"><p className="text-2xl font-light tracking-tight tabular-nums">{formatIDR(historySummary.totalLunas)}</p><p className="text-xs text-muted-foreground tabular-nums">{historySummary.count} transaksi lunas</p></CardContent></Card>
            <Card className="rounded-[2px]"><CardHeader className="p-3 pb-1"><CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Pelanggan</CardTitle></CardHeader><CardContent className="px-3 pb-3"><p className="text-2xl font-light tracking-tight tabular-nums">{customers.length}</p><p className="text-xs text-muted-foreground">terdaftar</p></CardContent></Card>
            <Card className="rounded-[2px]"><CardHeader className="p-3 pb-1"><CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Periode</CardTitle></CardHeader><CardContent className="px-3 pb-3"><p className="text-sm font-medium">Riwayat Selesai</p><p className="text-xs text-muted-foreground">Untuk keperluan audit</p></CardContent></Card>
          </>
        )}
      </div>

      {/* Tabs: Aktif vs Riwayat */}
      <div className="px-3 pb-2 shrink-0">
        <div className="inline-flex items-center gap-1.5 bg-muted/60 rounded-md p-1">
          <PillButton active={isAktif} onClick={() => setActiveTab('aktif')}><Wallet className="size-3.5" aria-hidden /> Aktif</PillButton>
          <PillButton active={!isAktif} onClick={() => setActiveTab('riwayat')}><History className="size-3.5" aria-hidden /> Riwayat</PillButton>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto px-3 pb-3">
        <div className="rounded-[2px] border bg-card overflow-hidden">
          <div className="overflow-x-auto [scrollbar-width:thin]">
          <Table className="min-w-[820px]">
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow className="hover:bg-transparent">
                <TableHead scope="col" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground h-6">Invoice</TableHead>
                <TableHead scope="col" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground h-6">Pelanggan</TableHead>
                <TableHead scope="col" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground h-6">{isAktif ? 'Tanggal' : 'Tanggal Selesai'}</TableHead>
                <TableHead scope="col" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground h-6">{isAktif ? 'Jatuh Tempo' : 'Status'}</TableHead>
                <TableHead scope="col" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground h-6 text-right">Total</TableHead>
                <TableHead scope="col" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground h-6 text-right">Sisa</TableHead>
                <TableHead scope="col" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground h-6">Status</TableHead>
                <TableHead scope="col" className="w-36 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground h-6">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading || !isInitialized ? (
                <>
                  {[0,1,2,3,4].map(i => (
                    <TableRow key={i} className="hover:bg-transparent">
                      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-20 mt-1" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                    </TableRow>
                  ))}
                </>
              ) : displayList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-40 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 py-6 text-muted-foreground">
                      <Wallet className="size-8 opacity-30" aria-hidden />
                      <p className="text-sm font-medium">
                        {isAktif
                          ? (statusFilter !== 'all' ? `Tidak ada piutang dengan status "${statusFilter}"` : q ? `Tidak ada hasil untuk "${q}"` : 'Tidak ada piutang aktif.')
                          : (q ? `Tidak ada riwayat untuk "${q}"` : 'Belum ada riwayat piutang lunas.')}
                      </p>
                      <p className="text-xs max-w-[32ch]">{isAktif ? (q || statusFilter !== 'all' ? 'Coba ubah filter atau kata kunci.' : 'Transaksi grosir dengan termin akan muncul di sini.') : 'Riwayat menampilkan transaksi yang telah lunas — untuk audit.'}</p>
                      {(q || (isAktif && statusFilter !== 'all')) && (
                        <Button variant="outline" size="sm" className="mt-1 h-7" onClick={() => { setQ(''); setStatusFilter('all'); }}>Reset filter</Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : isAktif ? (
                filtered.map(({ t: tx, sisa, od }) => {
                const dueLabel = tx.due_date ? format(new Date(tx.due_date), 'dd MMM yyyy', { locale: localeId }) : '-';
                const createdLabel = (() => { try { return format(new Date(tx.created_at), 'dd MMM yyyy, HH:mm', { locale: localeId }); } catch { return new Date(tx.created_at).toLocaleDateString('id-ID'); } })();
                const isOverdue = od > 0;
                return (
                  <TableRow key={tx.id} className="hover:bg-muted/40 focus-within:bg-muted/40 transition-colors" data-invoice={tx.id}>
                    <TableCell className="font-mono text-xs font-medium tabular-nums tracking-tight">{tx.invoice_number}</TableCell>
                    <TableCell><div className="font-medium text-sm leading-tight truncate max-w-[18ch]">{tx.customer_name_snapshot || '-'}</div><div className="text-xs text-muted-foreground truncate max-w-[18ch]">{tx.customer_group_snapshot || ''}</div></TableCell>
                    <TableCell className="text-xs tabular-nums whitespace-nowrap">{createdLabel}</TableCell>
                    <TableCell className={isOverdue ? 'text-destructive' : ''}>
                      <span className="flex items-center gap-1 text-xs whitespace-nowrap"><Clock className="h-3 w-3 shrink-0" aria-hidden />{dueLabel}</span>
                      {isOverdue && <span className="text-xs font-medium text-destructive tabular-nums">+{od} hari</span>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm whitespace-nowrap">{formatIDR(tx.total)}</TableCell>
                    <TableCell className="text-right tabular-nums font-bold text-destructive whitespace-nowrap">{formatIDR(sisa)}</TableCell>
                    <TableCell>
                      {tx.payment_status === 'piutang' ? <Badge variant="secondary" className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30">Piutang</Badge> : <Badge variant="outline" className="rounded-none">Cicilan</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          className="h-8 min-h-[44px] md:min-h-0 md:h-8 rounded-none"
                          onClick={e => openPay(tx, e.currentTarget)}
                          aria-label={`Bayar piutang ${tx.invoice_number} sisa ${formatIDR(sisa)}`}
                        >
                          <CreditCard className="h-3.5 w-3.5 mr-1" aria-hidden /> Bayar
                        </Button>
                        {isOverdue && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 min-h-[44px] md:min-h-0 md:h-8 rounded-none"
                            onClick={() => handleCetakSurat(tx)}
                            disabled={isGeneratingSurat}
                            aria-label={`Cetak surat tagihan ${tx.customer_name_snapshot}`}
                            title="Cetak surat tagihan (satu surat per pelanggan, daftar semua tagihan jatuh tempo)"
                          >
                            <Mail className="h-3.5 w-3.5 mr-1" aria-hidden /> Surat
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
              ) : (
                filteredHistory.map(({ t: tx }) => {
                  const createdLabel = (() => { try { return format(new Date(tx.created_at), 'dd MMM yyyy, HH:mm', { locale: localeId }); } catch { return new Date(tx.created_at).toLocaleDateString('id-ID'); } })();
                  return (
                    <TableRow key={tx.id} className="hover:bg-muted/40 transition-colors">
                      <TableCell className="font-mono text-xs font-medium tabular-nums tracking-tight">{tx.invoice_number}</TableCell>
                      <TableCell><div className="font-medium text-sm leading-tight truncate max-w-[18ch]">{(tx as any).customer_name_snapshot || '-'}</div><div className="text-xs text-muted-foreground truncate max-w-[18ch]">{(tx as any).customer_group_snapshot || ''}</div></TableCell>
                      <TableCell className="text-xs tabular-nums whitespace-nowrap">{createdLabel}</TableCell>
                      <TableCell><Badge variant="secondary" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"><CheckCircle className="h-3 w-3 mr-1" aria-hidden /> Lunas</Badge></TableCell>
                      <TableCell className="text-right tabular-nums text-sm whitespace-nowrap">{formatIDR(tx.total)}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm whitespace-nowrap text-muted-foreground">{formatIDR(0)}</TableCell>
                      <TableCell><Badge variant="outline" className="rounded-none border-emerald-500/30 text-emerald-700">Lunas</Badge></TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">—</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground hidden md:block tabular-nums" aria-live="polite" aria-atomic="true">
          {isAktif
            ? `Menampilkan ${filtered.length} dari ${summary.count} piutang · ${formatIDR(summary.totalPiutang)} tertagih · terbaru di atas.`
            : `Menampilkan ${filteredHistory.length} dari ${historySummary.count} riwayat lunas · ${formatIDR(historySummary.totalLunas)} · untuk audit.`}
        </p>
      </div>

      <Dialog open={payOpen} onOpenChange={handlePayOpenChange}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Bayar Piutang — {payTx?.invoice_number}</DialogTitle><DialogDescription className="sr-only">Form pembayaran piutang grosir</DialogDescription></DialogHeader>
          {payTx && (
            <div className="space-y-3">
              <div className="rounded-md bg-muted p-3 text-sm space-y-1">
                <div className="flex justify-between gap-4"><span className="text-muted-foreground">Pelanggan</span><span className="font-medium text-right">{payTx.customer_name_snapshot}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span className="tabular-nums">{formatIDR(payTx.total)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Sudah dibayar</span><span className="tabular-nums">{formatIDR(payTx.cash_paid || 0)}</span></div>
                <div id="pay-sisa" className="flex justify-between font-bold border-t border-border pt-2 mt-1"><span>Sisa</span><span className="text-destructive tabular-nums">{formatIDR(paySisa)}</span></div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pay-amount">Jumlah Bayar <span className="text-destructive" aria-hidden>*</span></Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">Rp</span>
                  <Input
                    id="pay-amount"
                    type="text"
                    inputMode="decimal"
                    autoFocus
                    value={payAmount}
                    onChange={e => { setPayAmount(e.target.value.replace(/[^0-9]/g, '')); setPayError(null); }}
                    placeholder="0"
                    aria-required="true"
                    aria-describedby="pay-sisa pay-error"
                    aria-invalid={!!payError}
                    className="pl-8 tabular-nums font-medium"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Maks <span className="tabular-nums font-medium text-foreground">{formatIDR(paySisa)}</span> · tanpa titik.</p>
                {payError && <p id="pay-error" role="alert" className="text-xs font-medium text-destructive">{payError}</p>}
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setPayOpen(false)}>Batal</Button>
            <Button onClick={handlePay} disabled={!payValid}>Konfirmasi Bayar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PdfPreviewSheet open={suratPdf.previewOpen} onOpenChange={suratPdf.setPreviewOpen} pdfBytes={suratPdf.pdfBytes} title={suratPdf.title || 'Surat Tagihan'} filename={suratPdf.filename || 'surat-tagihan.pdf'} />
      <PdfGeneratingOverlay open={suratPdf.open} onCancel={suratPdf.cancel} title={suratPdf.title} elapsedMs={suratPdf.elapsedMs} pageCount={suratPdf.pageCount} />
    </div>
  );
}
