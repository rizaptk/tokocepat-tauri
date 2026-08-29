import { useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { getWorksheetSessionWithItems, commitWorksheetSession, cancelWorksheetSession, subscribeWorksheetItems } from '@/services/stockService';
import type { WorksheetSessionWithItems, WorksheetItem } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Printer, Loader2, Save, XCircle, RotateCcw, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogCancel, AlertDialogAction, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ProductSearchBar } from '@/components/ProductSearchBar';
import { WorksheetGrid } from './WorksheetGrid';
import { cn } from '@/lib/utils';
import { useStore } from '@/lib/store';
import { addWorksheetItem, updateWorksheetItem, removeWorksheetItem } from '@/services/stockService';
import { normalizeProductUoms } from '@/lib/uom';

const SUBJECT_LABELS: Record<string, string> = { dealer_in: 'Produk Masuk dari Dealer', restock: 'Stok Masuk', routine_check: 'Cek Rutin', warehouse_cleanup: 'Bersih Gudang', other: 'Lain-lain' };
const STATUS_COLORS: Record<string, string> = { draft: 'bg-yellow-100 text-yellow-800', committed: 'bg-green-100 text-green-800', cancelled: 'bg-red-100 text-red-800' };

export function WorksheetSessionManager({ sessionId, onBackToHistory, onSessionChange }: { sessionId: string; onBackToHistory: () => void; onSessionChange: (id: string | null) => void }) {
    const { toast } = useToast();
    const { products, productVariants } = useStore();
    const [session, setSession] = useState<WorksheetSessionWithItems | null>(null);
    const [items, setItems] = useState<WorksheetItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [committing, setCommitting] = useState(false);
    const [exporting, setExporting] = useState(false);

    const fmt = (iso: string) => { try { return format(new Date(iso), 'dd MMM yyyy HH:mm', { locale: localeId }); } catch { return iso; } };
    const subj = (s: string, o?: string) => s === 'other' ? (o || 'Lain-lain') : (SUBJECT_LABELS[s] || s);

    useEffect(() => {
        let mounted = true;
        setLoading(true);
        (async () => { try { const d = await getWorksheetSessionWithItems(sessionId); if (mounted) { setSession(d); setItems(d?.items || []); } } catch (e) { toast({ variant: 'destructive', title: 'Gagal memuat sesi', description: String(e) }); } finally { if (mounted) setLoading(false); } })();
        const unsub = subscribeWorksheetItems(sessionId, (its) => { if (mounted) setItems(its); });
        return () => { mounted = false; unsub?.(); };
    }, [sessionId]);

    const handleAddProduct = useCallback(async (product: any) => {
        if (!session) return;
        const isVariant = !!product.product_id;
        const prodId = isVariant ? product.product_id : product.id;
        const varId = isVariant ? product.id : undefined;
        if (items.some(i => i.product_id === prodId && (i.variant_id || undefined) === varId)) { toast({ variant: 'destructive', title: 'Produk sudah ada' }); return; }
        const baseProd = isVariant ? products.find(p => p.id === prodId) : product;
        const stock = isVariant ? (productVariants.find(v => v.id === product.id)?.stock ?? 0) : (product.stock ?? 0);
        const uom = (isVariant ? baseProd?.uoms?.find((u: any) => u.isBase) : product.uoms?.find((u: any) => u.isBase)) || { id: 'pcs', name: 'Pcs', factor: 1 };
        try { await addWorksheetItem(session.id, { product_id: prodId, variant_id: varId, product_name_snapshot: isVariant ? baseProd?.name || product.name : product.name, variant_name_snapshot: isVariant ? product.name.replace(`${baseProd?.name} (`, '').replace(')', '') || product.name : undefined, action: 'tambah', system_qty: stock, qty: 1, uom_id: uom.id, uom_name: uom.name, uom_factor: uom.factor, physical_qty: stock + 1, notes: '' }); } catch (e) { toast({ variant: 'destructive', title: 'Gagal menambah', description: String(e) }); }
    }, [session, items, products, productVariants]);

    const handleUpdate = useCallback((id: string, data: Partial<WorksheetItem>) => {
        // compute physical_qty if action/qty changed
        const it = items.find(i => i.id === id);
        if (it) {
            const next = { ...it, ...data } as WorksheetItem;
            let physical = next.physical_qty;
            if (data.action !== undefined || data.qty !== undefined) {
                if (next.action === 'tambah') physical = next.system_qty + next.qty;
                else if (next.action === 'kurang') physical = Math.max(0, next.system_qty - next.qty);
                else if (next.action === 'koreksi') physical = next.qty;
                data = { ...data, physical_qty: physical } as any;
            }
        }
        updateWorksheetItem(sessionId, id, data).catch(e => toast({ variant: 'destructive', title: 'Gagal update', description: String(e) }));
    }, [sessionId, items]);

    const handleRemove = useCallback((id: string) => { removeWorksheetItem(sessionId, id).catch(e => toast({ variant: 'destructive', title: 'Gagal hapus', description: String(e) })); }, [sessionId]);

    const handleCommit = async () => {
        if (!session) return;
        for (const it of items) if (!it.action || it.qty <= 0) { toast({ variant: 'destructive', title: 'Validasi gagal', description: `Item ${it.product_name_snapshot}: aksi dan jumlah wajib diisi` }); return; }
        setCommitting(true);
        try { const r = await commitWorksheetSession(sessionId, session.created_by); toast({ title: 'Sesi dikomit', description: `${r.movements.length} pergerakan stok dibuat` }); onSessionChange(null); onBackToHistory(); } catch (e) { toast({ variant: 'destructive', title: 'Gagal komit', description: String(e) }); } finally { setCommitting(false); }
    };
    const handleCancel = async () => { try { await cancelWorksheetSession(sessionId); toast({ title: 'Sesi dibatalkan' }); onSessionChange(null); onBackToHistory(); } catch (e) { toast({ variant: 'destructive', title: 'Gagal', description: String(e) }); } };
    const handlePrint = async () => {
        if (!session) return; setExporting(true);
        try { const { exportWorksheetSessionToPdf } = await import('@/lib/export'); await exportWorksheetSessionToPdf(session, items, 'Kastoko'); toast({ title: 'PDF dibuat' }); } catch (e) { toast({ variant: 'destructive', title: 'Gagal cetak', description: String(e) }); } finally { setExporting(false); }
    };
    const handleExcel = async () => {
        if (!session) return; setExporting(true);
        try { const { exportWorksheetSessionToExcel } = await import('@/lib/export'); await exportWorksheetSessionToExcel(session, items, 'Kastoko'); } catch (e) { toast({ variant: 'destructive', title: 'Gagal ekspor', description: String(e) }); } finally { setExporting(false); }
    };

    const totals = items.reduce((a, it) => { if (it.action === 'tambah') a.tambah += it.qty; else if (it.action === 'kurang') a.kurang += it.qty; else a.koreksi += 1; return a; }, { tambah: 0, kurang: 0, koreksi: 0 });
    const isReadOnly = session?.status !== 'draft';

    if (loading) return <div className="h-full flex items-center justify-center"><Loader2 className="size-8 animate-spin text-muted-foreground" /></div>;
    if (!session) return <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Sesi tidak ditemukan</div>;

    return (
        <div className="h-full flex flex-col">
            <div className="p-4 border-b bg-card space-y-3">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="size-8" onClick={onBackToHistory}><RotateCcw className="size-4" /></Button>
                        <div><h2 className="font-semibold">{session.name}</h2><p className="text-xs text-muted-foreground">{fmt(session.created_at)} • {session.created_by}</p></div>
                        <Badge className={cn('text-xs', STATUS_COLORS[session.status])}>{session.status}</Badge>
                    </div>
                    <div className="flex gap-2">
                        {!isReadOnly ? <>
                            <Button variant="outline" size="sm" onClick={handlePrint} disabled={exporting}><Printer className="size-4 mr-1" />Cetak</Button>
                            <Button variant="outline" size="sm" onClick={handleExcel} disabled={exporting}><FileText className="size-4 mr-1" />Excel</Button>
                            <Button variant="destructive" size="sm" onClick={handleCancel}><XCircle className="size-4 mr-1" />Batalkan</Button>
                            <AlertDialog><AlertDialogTrigger asChild><Button size="sm" disabled={committing || items.length===0}><Save className="size-4 mr-1" />Komit</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Komit Sesi?</AlertDialogTitle><AlertDialogDescription>Akan membuat pergerakan stok permanen. Tidak dapat dibatalkan.</AlertDialogDescription></AlertDialogHeader><div className="flex justify-end gap-2"><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={handleCommit}>{committing ? <Loader2 className="size-4 animate-spin mr-2" /> : null}Ya, Komit</AlertDialogAction></div></AlertDialogContent></AlertDialog>
                        </> : <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="size-4 mr-1" />Cetak</Button>}
                    </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                    <div className="p-2 bg-muted/50 rounded"><p className="text-xs text-muted-foreground">Perihal</p><p className="font-medium truncate">{subj(session.subject, session.subject_other)}</p></div>
                    <div className="p-2 bg-muted/50 rounded"><p className="text-xs text-muted-foreground">Pihak Terkait</p><p className="font-medium truncate">{session.related_party || '-'}</p></div>
                    <div className="p-2 bg-muted/50 rounded md:col-span-2"><p className="text-xs text-muted-foreground">Keterangan</p><p className="font-medium truncate">{session.description}</p></div>
                </div>
                <div className="flex gap-2 text-xs"><Badge variant="secondary">Tambah: {totals.tambah}</Badge><Badge variant="secondary">Kurang: {totals.kurang}</Badge><Badge variant="secondary">Koreksi: {totals.koreksi}</Badge><span className="ml-auto text-muted-foreground">{items.length} produk</span></div>
            </div>
            {!isReadOnly && <div className="p-3 border-b"><ProductSearchBar onBarcodeScan={(bc) => { const p = [...products, ...productVariants].find((x: any) => x.barcode===bc); if (p) handleAddProduct(p); }} onArrowNav={() => {}} placeholder="Cari produk untuk ditambah ke worksheet..." /></div>}
            <div className="flex-1 min-h-0">
                <WorksheetGrid items={items} readOnly={!!isReadOnly} onItemUpdate={handleUpdate} onItemRemove={handleRemove} />
            </div>
        </div>
    );
}
