import { useEffect, useState, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { listWorksheetSessions, subscribeWorksheetSessions } from '@/services/stockService';
import type { WorksheetSession, WorksheetSubject } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { createWorksheetSession } from '@/services/stockService';

const SUBJECT_LABELS: Record<string, string> = {
    dealer_in: 'Produk Masuk dari Dealer',
    restock: 'Stok Masuk',
    routine_check: 'Cek Rutin',
    warehouse_cleanup: 'Bersih Gudang',
    other: 'Lain-lain',
};
const STATUS_LABELS: Record<string, string> = { draft: 'Draft', committed: 'Selesai', cancelled: 'Dibatalkan' };
const STATUS_COLORS: Record<string, string> = {
    draft: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    committed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

interface Props { onSessionSelect: (id: string) => void; onNewSessionCreated?: (id: string) => void; }

export function WorksheetHistoryList({ onSessionSelect, onNewSessionCreated }: Props) {
    const { toast } = useToast();
    const [sessions, setSessions] = useState<WorksheetSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [form, setForm] = useState({ session_date: new Date().toISOString().split('T')[0], created_by: '', subject: 'restock' as WorksheetSubject, subject_other: '', description: '', related_party: '' });

    useEffect(() => {
        let unsub: (() => void) | null = null;
        (async () => {
            try { const data = await listWorksheetSessions({ limit: 50 }); setSessions(data); } catch (e) { toast({ variant: 'destructive', title: 'Gagal memuat histori', description: String(e) }); } finally { setLoading(false); }
            unsub = subscribeWorksheetSessions((s) => setSessions(s));
        })();
        return () => { unsub?.(); };
    }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.created_by.trim()) { toast({ variant: 'destructive', title: 'Nama operator wajib diisi' }); return; }
        if (!form.description.trim()) { toast({ variant: 'destructive', title: 'Keterangan wajib diisi' }); return; }
        if (form.subject === 'other' && !form.subject_other.trim()) { toast({ variant: 'destructive', title: 'Perihal lain-lain wajib diisi' }); return; }
        setSubmitting(true);
        try {
            const id = await createWorksheetSession({ session_date: form.session_date, created_by: form.created_by.trim(), subject: form.subject, subject_other: form.subject === 'other' ? form.subject_other.trim() : undefined, description: form.description.trim(), related_party: form.related_party.trim() || undefined });
            toast({ title: 'Sesi dibuat' });
            setShowCreate(false);
            setForm({ session_date: new Date().toISOString().split('T')[0], created_by: '', subject: 'restock', subject_other: '', description: '', related_party: '' });
            onSessionSelect(id);
            onNewSessionCreated?.(id);
        } catch (err) { toast({ variant: 'destructive', title: 'Gagal membuat sesi', description: String(err) }); } finally { setSubmitting(false); }
    };

    const fmt = (iso: string) => { try { return format(new Date(iso), 'dd MMM yyyy HH:mm', { locale: localeId }); } catch { return iso; } };
    const subjLabel = (s: WorksheetSubject, o?: string) => s === 'other' ? (o || 'Lain-lain') : (SUBJECT_LABELS[s] || s);

    return (
        <div className="h-full flex flex-col">
            <div className="flex items-center justify-between p-4 border-b bg-card">
                <div className="flex items-center gap-3"><h2 className="text-base font-semibold">Histori Sesi</h2><Badge variant="secondary" className="text-xs">{sessions.length} sesi</Badge></div>
                <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1.5"><Plus className="size-4" /> Buat Sesi</Button>
            </div>

            <Sheet open={showCreate} onOpenChange={setShowCreate}>
                <SheetContent side="right" className="w-full max-w-md overflow-y-auto">
                    <SheetHeader><SheetTitle>Buat Sesi Kelola</SheetTitle><SheetDescription>Isi data sesi untuk mulai mengelola inventori</SheetDescription></SheetHeader>
                    <form onSubmit={handleCreate} className="space-y-4 mt-4">
                        <div className="grid grid-cols-2 gap-3"><div><Label>Tanggal</Label><Input type="date" value={form.session_date} onChange={e => setForm(p => ({ ...p, session_date: e.target.value }))} className="mt-1" /></div><div><Label>Operator *</Label><Input placeholder="Nama operator" value={form.created_by} onChange={e => setForm(p => ({ ...p, created_by: e.target.value }))} className="mt-1" /></div></div>
                        <div><Label>Perihal *</Label><Select value={form.subject} onValueChange={v => setForm(p => ({ ...p, subject: v as WorksheetSubject }))}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(SUBJECT_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select></div>
                        {form.subject === 'other' && <div><Label>Perihal Lain-lain *</Label><Input placeholder="Tulis perihal" value={form.subject_other} onChange={e => setForm(p => ({ ...p, subject_other: e.target.value }))} className="mt-1" /></div>}
                        <div><Label>Pihak Terkait</Label><Input placeholder="Nama dealer/manajer" value={form.related_party} onChange={e => setForm(p => ({ ...p, related_party: e.target.value }))} className="mt-1" /></div>
                        <div><Label>Keterangan *</Label><Textarea placeholder="Detail kegiatan..." value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} className="mt-1" /></div>
                        <div className="flex justify-end gap-2 pt-4 border-t"><Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Batal</Button><Button type="submit" disabled={submitting}>{submitting ? <Loader2 className="size-4 animate-spin mr-2" /> : null}Buat Sesi</Button></div>
                    </form>
                </SheetContent>
            </Sheet>

            <div className="flex-1 overflow-hidden">
                {loading ? <div className="h-full flex items-center justify-center"><Loader2 className="size-8 animate-spin text-muted-foreground" /></div>
                    : sessions.length === 0 ? <div className="h-full flex items-center justify-center text-muted-foreground text-sm p-8 text-center">Belum ada sesi.<br />Klik "Buat Sesi" untuk memulai.</div>
                        : <ScrollArea className="h-full"><table className="w-full text-sm"><thead className="sticky top-0 bg-background/95 backdrop-blur z-10"><tr className="border-b text-left text-muted-foreground text-[11px] uppercase tracking-wider"><th className="p-3">No. Sesi</th><th className="p-3">Tanggal</th><th className="p-3">Operator</th><th className="p-3">Perihal</th><th className="p-3">Status</th></tr></thead><tbody className="divide-y divide-border/50">{sessions.map(s => <tr key={s.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => onSessionSelect(s.id)}><td className="p-3 font-mono text-xs">{s.name}</td><td className="p-3 whitespace-nowrap text-xs">{fmt(s.created_at)}</td><td className="p-3">{s.created_by}</td><td className="p-3 max-w-[180px] truncate">{subjLabel(s.subject, s.subject_other)}</td><td className="p-3"><Badge variant="secondary" className={cn('text-xs', STATUS_COLORS[s.status])}>{STATUS_LABELS[s.status]}</Badge></td></tr>)}</tbody></table></ScrollArea>}
            </div>
        </div>
    );
}
