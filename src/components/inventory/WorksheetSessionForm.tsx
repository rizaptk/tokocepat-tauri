import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Printer, FileSpreadsheet, ChevronDown } from 'lucide-react';
import { createWorksheetSession } from '@/services/stockService';
import type { WorksheetSubject } from '@/lib/types';

const SUBJECT_LABELS: Record<string, string> = {
    dealer_in: 'Produk Masuk dari Dealer',
    restock: 'Stok Masuk',
    routine_check: 'Cek Rutin',
    warehouse_cleanup: 'Bersih Gudang',
    other: 'Lain-lain',
};

export function WorksheetSessionForm({ onCreated }: { onCreated: (id: string) => void }) {
    const { toast } = useToast();
    const [submitting, setSubmitting] = useState(false);
    const [form, setForm] = useState({
        session_date: new Date().toISOString().split('T')[0],
        created_by: '',
        subject: 'restock' as WorksheetSubject,
        subject_other: '',
        description: '',
        related_party: '',
    });

    const canSave = form.created_by.trim() && form.description.trim() && (form.subject !== 'other' || form.subject_other.trim());

    const handleSave = async () => {
        if (!canSave) { toast({ variant: 'destructive', title: 'Lengkapi form' }); return; }
        setSubmitting(true);
        try {
            const id = await createWorksheetSession({
                session_date: form.session_date,
                created_by: form.created_by.trim(),
                subject: form.subject,
                subject_other: form.subject === 'other' ? form.subject_other.trim() : undefined,
                description: form.description.trim(),
                related_party: form.related_party.trim() || undefined,
            });
            toast({ title: 'Sesi dibuat' });
            setForm({ session_date: new Date().toISOString().split('T')[0], created_by: '', subject: 'restock', subject_other: '', description: '', related_party: '' });
            onCreated(id);
        } catch (e) { toast({ variant: 'destructive', title: 'Gagal', description: String(e) }); } finally { setSubmitting(false); }
    };

    return (
        <Card className="h-full flex flex-col">
            <CardHeader className="pb-3">
                <CardTitle className="text-base">Buat Sesi Baru</CardTitle>
                <p className="text-xs text-muted-foreground">Form selalu kosong — konsisten dengan Produk</p>
            </CardHeader>
            <CardContent className="flex-1 space-y-4 overflow-auto">
                <div className="grid grid-cols-2 gap-3">
                    <div><Label>Tanggal</Label><Input type="date" value={form.session_date} onChange={e => setForm(p => ({ ...p, session_date: e.target.value }))} className="mt-1 h-8" /></div>
                    <div><Label>Operator *</Label><Input placeholder="Nama operator" value={form.created_by} onChange={e => setForm(p => ({ ...p, created_by: e.target.value }))} className="mt-1 h-8" /></div>
                </div>
                <div><Label>Perihal *</Label><Select value={form.subject} onValueChange={v => setForm(p => ({ ...p, subject: v as WorksheetSubject }))}><SelectTrigger className="mt-1 h-8"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(SUBJECT_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select></div>
                {form.subject === 'other' && <div><Label>Perihal Lain *</Label><Input placeholder="Tulis perihal" value={form.subject_other} onChange={e => setForm(p => ({ ...p, subject_other: e.target.value }))} className="mt-1 h-8" /></div>}
                <div><Label>Pihak Terkait</Label><Input placeholder="Dealer/manajer" value={form.related_party} onChange={e => setForm(p => ({ ...p, related_party: e.target.value }))} className="mt-1 h-8" /></div>
                <div><Label>Keterangan *</Label><Textarea placeholder="Detail kegiatan..." value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} className="mt-1" /></div>

                <div className="flex gap-2 pt-2">
                    <Button onClick={handleSave} disabled={!canSave || submitting} className="flex-1 h-8" size="sm">
                        {submitting ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <Save className="size-4 mr-1.5" />}Simpan
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="h-8">Export <ChevronDown className="size-3.5 ml-1" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => toast({ title: 'Pilih sesi di Histori untuk export' })}><Printer className="size-4 mr-2" />Cetak PDF</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toast({ title: 'Pilih sesi di Histori untuk export' })}><FileSpreadsheet className="size-4 mr-2" />Export Excel</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
                <p className="text-[11px] text-muted-foreground">Simpan sejajar Export — aktif hanya saat form terisi. Cetak/Excel butuh sesi terpilih di Histori.</p>
            </CardContent>
        </Card>
    );
}
