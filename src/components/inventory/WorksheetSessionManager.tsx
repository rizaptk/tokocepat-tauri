import { useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { getWorksheetSessionWithItems, commitWorksheetSession, cancelWorksheetSession, subscribeWorksheetItems, updateWorksheetSession } from '@/services/stockService';
import type { WorksheetSessionWithItems, WorksheetItem } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Printer, Loader2, Save, XCircle, RotateCcw, FileText, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogCancel, AlertDialogAction, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ProductSearchBar } from '@/components/ProductSearchBar';
import { WorksheetGrid } from './WorksheetGrid';
import { cn } from '@/lib/utils';
import { useStore } from '@/lib/store';
import { addWorksheetItem, updateWorksheetItem, removeWorksheetItem } from '@/services/stockService';

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
        const it = items.find(i => i.id === id);
        if (it) {
            const next = { ...it, ...data } as WorksheetItem;
            let physical = next.physical_qty;
            if (data.action !== undefined || data.qty !== undefined || (data as any).uom_factor !== undefined) {
                const baseQty = next.qty * (next.uom_factor || 1);
                if (next.action === 'tambah') physical = next.system_qty + baseQty;
                else if (next.action === 'kurang') physical = Math.max(0, next.system_qty - baseQty);
                else if (next.action === 'koreksi') physical = baseQty;
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
        try { const { exportWorksheetSessionToPdf } = await import('@/lib/export'); await (exportWorksheetSessionToPdf as any)(session, items, 'Kastoko'); toast({ title: 'PDF dibuat' }); } catch (e) { toast({ variant: 'destructive', title: 'Gagal cetak', description: String(e) }); } finally { setExporting(false); }
    };
    const handleExcel = async () => {
        if (!session) return; setExporting(true);
        try { const { exportWorksheetSessionToExcel } = await import('@/lib/export'); await (exportWorksheetSessionToExcel as any)(session, items, 'Kastoko'); } catch (e) { toast({ variant: 'destructive', title: 'Gagal ekspor', description: String(e) }); } finally { setExporting(false); }
    };

    const totals = items.reduce((a, it) => { if (it.action === 'tambah') a.tambah += it.qty; else if (it.action === 'kurang') a.kurang += it.qty; else a.koreksi += 1; return a; }, { tambah: 0, kurang: 0, koreksi: 0 });
    const isReadOnly = session?.status !== 'draft';

    if (loading) return <div className="h-full flex items-center justify-center"><Loader2 className="size-8 animate-spin text-muted-foreground" /></div>;
    if (!session) return <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Sesi tidak ditemukan</div>;

    return (
        <div className="h-full flex flex-col">
            <div className="p-3 border-t bg-card">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={onBackToHistory}><RotateCcw className="size-4" /></Button>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h2 className="font-semibold text-sm truncate">{session.name}</h2>
                                <Badge className={cn('text-[10px] px-1.5 py-0', STATUS_COLORS[session.status])}>{session.status}</Badge>
                                <span className="text-xs text-muted-foreground truncate hidden sm:inline">• Perihal: {subj(session.subject, session.subject_other)} • Pihak: {session.related_party || '-'} • {session.description}</span>
                            </div>
                            <p className="text-xs text-muted-foreground truncate sm:hidden">{subj(session.subject, session.subject_other)} • {session.related_party || '-'}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                        <Select value={session.status} onValueChange={async (v) => { try { await updateWorksheetSession(sessionId, { status: v as any }); setSession(prev => prev ? { ...prev, status: v as any } : prev); toast({ title: 'Status diperbarui' }); } catch (e: any) { toast({ variant: 'destructive', title: 'Gagal', description: String(e) }); } }}><SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="committed">Selesai</SelectItem><SelectItem value="cancelled">Cancelled</SelectItem></SelectContent></Select>
                        <Button variant="outline" size="sm" className="h-7" onClick={handlePrint} disabled={exporting}><Printer className="size-3.5 mr-1" />PDF</Button>
                        <Button variant="outline" size="sm" className="h-7" onClick={handleExcel} disabled={exporting}><FileText className="size-3.5 mr-1" />Excel</Button>
                        <Button variant="outline" size="sm" className="h-7" onClick={handlePrint} disabled={exporting}>Cetak</Button>
                        <Button variant="outline" size="sm" className="h-7" onClick={handleCancel}><XCircle className="size-3.5 mr-1" />Batalkan</Button>
                        <AlertDialog><AlertDialogTrigger asChild><Button size="sm" className="h-7" disabled={committing || items.length===0}><Save className="size-3.5 mr-1" />Simpan</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Simpan Sesi?</AlertDialogTitle><AlertDialogDescription>Akan membuat pergerakan stok permanen. Tidak dapat dibatalkan.</AlertDialogDescription></AlertDialogHeader><div className="flex justify-end gap-2"><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={handleCommit}>{committing ? <Loader2 className="size-4 animate-spin mr-2" /> : null}Ya, Simpan</AlertDialogAction></div></AlertDialogContent></AlertDialog>
                    </div>
                </div>
                <p className="text-xs text-muted-foreground sm:hidden truncate mt-1">{session.description}</p>
            </div>
            <div className="flex-1 min-h-0">
                <WorksheetGrid 
                    items={items} 
                    // readOnly={!!isReadOnly} 
                    readOnly={false} //always editable 
                    onItemUpdate={handleUpdate} 
                    onItemRemove={handleRemove} 
                />
            </div>
        </div>
    );
}
