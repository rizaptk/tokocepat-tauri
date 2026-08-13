import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Plus, Pencil, Trash2, Gift, TicketPercent, Power } from 'lucide-react';
import { NotificationBell } from '@/components/NotificationBell';
import { ThemeToggle } from '@/components/ThemeButtons';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useStore } from '@/lib/store';
import { useDbStore } from '@/lib/db-store';
import { toast } from '@/hooks/use-toast';
import { Promotion } from '@/lib/types';
import { savePromo, deletePromo, setPromoActive, generatePromoId } from '@/services/promoManagerService';
import { cn } from '@/lib/utils';
import { MultiSelect, SingleSelect } from './_components/SelectCombobox';
import { formatIDR } from "@/lib/format";

const toLocalInput = (iso?: string): string => {
    if (!iso) return '';
    const d = new Date(iso);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

const fromLocalInput = (v: string): string | undefined => (v ? new Date(v).toISOString() : undefined);

const fmtDate = (iso?: string): string => {
    if (!iso) return '-';
    return new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const isLiveNow = (p: Promotion): boolean => {
    if (!p.is_active) return false;
    const now = Date.now();
    if (p.starts_at && new Date(p.starts_at).getTime() > now) return false;
    if (p.ends_at && new Date(p.ends_at).getTime() <= now) return false;
    return true;
};

type Draft = Promotion;

const emptyDraft = (kind: 'bogo' | 'voucher'): Draft => ({
    id: generatePromoId(),
    name: '',
    kind,
    is_active: true,
    created_at: new Date().toISOString(),
    buy_quantity: 2,
    free_quantity: 1,
    applies_to_product_ids: [],
    applies_to_category_ids: [],
    discount_type: 'percentage',
    discount_value: 10,
    max_uses: 100,
});

export default function PromosPage() {
    const nav = useNavigate();
    const { promos, products, categories } = useStore();

    const [draft, setDraft] = useState<Draft | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Actual redemptions per voucher code, queried from the DB so the numbers
    // reflect every device + day (not just the in-memory ledger).
    const [usageByCode, setUsageByCode] = useState<Record<string, number>>({});
    useEffect(() => {
        let mounted = true;
        const fetch = async () => {
            const { db, firesqlite } = useDbStore.getState();
            if (!db || !firesqlite) return;
            const { collection, query, where, getDocs } = firesqlite;
            const codes = promos.filter(p => p.kind === 'voucher' && p.code).map(p => (p.code as string).toUpperCase());
            const map: Record<string, number> = {};
            for (const code of codes) {
                try {
                    const snap = await getDocs(query(
                        collection(db, 'transactions'),
                        where('voucher_code', 'eq', code),
                        where('status', 'eq', 'paid'),
                    ));
                    if (snap.docs) map[code] = snap.docs.length;
                } catch { /* ignore */ }
            }
            if (mounted) setUsageByCode(map);
        };
        fetch();
        return () => { mounted = false; };
    }, [promos]);

    const productName = (id: string) => products.find(p => p.id === id)?.name || id;
    const categoryName = (id: string) => categories.find(c => c.id === id)?.name || id;

    const handleSave = async () => {
        if (!draft) return;
        if (!draft.name.trim()) {
            toast({ variant: 'destructive', title: 'Nama wajib diisi' });
            return;
        }
        if (draft.kind === 'voucher' && !draft.code?.trim()) {
            toast({ variant: 'destructive', title: 'Kode voucher wajib diisi' });
            return;
        }
        if (draft.kind === 'voucher') {
            const clash = promos.find(p =>
                p.kind === 'voucher' && p.id !== draft.id &&
                (p.code || '').toUpperCase() === (draft.code || '').toUpperCase()
            );
            if (clash) {
                toast({ variant: 'destructive', title: 'Kode sudah dipakai', description: `Kode "${draft.code}" sudah digunakan pada voucher ${clash.name}.` });
                return;
            }
        }

        const clean: Promotion = {
            ...draft,
            name: draft.name.trim(),
            code: draft.kind === 'voucher' ? (draft.code || '').trim().toUpperCase() : undefined,
            applies_to_product_ids: draft.applies_to_product_ids?.length ? draft.applies_to_product_ids : undefined,
            applies_to_category_ids: draft.applies_to_category_ids?.length ? draft.applies_to_category_ids : undefined,
            free_product_id: draft.kind === 'bogo' && draft.free_product_id ? draft.free_product_id : undefined,
        };

        setIsSaving(true);
        try {
            await savePromo(clean);
            toast({ title: 'Promo Disimpan', description: `"${clean.name}" berhasil disimpan.` });
            setDraft(null);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Gagal Simpan', description: error.message });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (promo: Promotion) => {
        try {
            await deletePromo(promo.id);
            toast({ title: 'Promo Dihapus', description: `"${promo.name}" dihapus.` });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Gagal Hapus', description: error.message });
        }
    };

    const handleToggle = async (promo: Promotion, active: boolean) => {
        await setPromoActive(promo.id, active);
        toast({ title: active ? 'Promo Diaktifkan' : 'Promo Dinonaktifkan', description: promo.name });
    };

    const describe = (p: Promotion): string => {
        let desc: string;
        if (p.kind === 'voucher') {
            const disc = p.discount_type === 'percentage' ? `${p.discount_value}%` : formatIDR(p.discount_value || 0);
            const scope = p.min_purchase ? `, min ${formatIDR(p.min_purchase)}` : '';
            desc = `Diskon ${disc}${scope}`;
        } else {
            const scopeParts: string[] = [];
            if (p.applies_to_category_ids?.length) scopeParts.push(p.applies_to_category_ids.map(categoryName).join(', '));
            if (p.applies_to_product_ids?.length) scopeParts.push(p.applies_to_product_ids.map(productName).join(', '));
            if (p.applies_to_product_ids?.length === 0 && p.applies_to_category_ids?.length === 0) scopeParts.push('Semua produk');
            desc = `Beli ${p.buy_quantity ?? 2} → gratis ${p.free_quantity ?? 1}${p.free_product_id ? ` (${productName(p.free_product_id)})` : ''}${scopeParts.length ? ` · ${scopeParts.join(' · ')}` : ''}`;
        }
        if (p.starts_at || p.ends_at) {
            desc += ` · ${fmtDate(p.starts_at)} → ${fmtDate(p.ends_at)}`;
        }
        return desc;
    };

    return (
        <div className="flex min-h-screen w-full flex-col bg-muted/40">
            <header className="sticky top-0 flex h-12 items-center gap-4 border-b border-border/60 bg-background/80 px-4 backdrop-blur-md z-20">
                <Button variant="outline" size="icon" className="shrink-0" asChild>
                    <Link to="#" onClick={() => nav(-1)}>
                        <ArrowLeft className="h-4 w-4" />
                        <span className="sr-only">Kembali</span>
                    </Link>
                </Button>
                <h1 className="text-lg font-semibold tracking-tight flex-1">Promo & Voucher</h1>
                <Button onClick={() => setDraft(emptyDraft('voucher'))}>
                    <Plus className="mr-2 h-4 w-4" /> Tambah Promo
                </Button>
                <div className="flex items-center gap-2">
                    <NotificationBell />
                    <ThemeToggle />
                </div>
            </header>

            <main className="flex-1 p-4 lg:p-6 space-y-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Aturan Promo & Voucher</CardTitle>
                        <CardDescription>
                            Atur promo otomatis (Beli X Gratis Y) dan kode voucher. Promo aktif otomatis diterapkan di kasir.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {promos.length === 0 ? (
                            <div className="py-12 text-center text-muted-foreground">
                                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                                    <Gift className="h-6 w-6" />
                                </div>
                                <p className="font-medium text-foreground/70">Belum ada promo</p>
                                <p className="text-sm">Klik "Tambah Promo" untuk membuat aturan pertama.</p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Promo</TableHead>
                                        <TableHead className="w-40">Tipe</TableHead>
                                        <TableHead>Ketentuan</TableHead>
                                        <TableHead className="text-right">Pemakaian</TableHead>
                                        <TableHead className="w-20 text-center">Aktif</TableHead>
                                        <TableHead className="w-28 text-right">Aksi</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {promos.map(promo => {
                                        const uses = promo.kind === 'voucher' ? (usageByCode[(promo.code || '').toUpperCase()] || 0) + (promo.uses_count || 0) : 0;
                                        return (
                                            <TableRow key={promo.id}>
                                                <TableCell>
                                                    <div className="font-medium">{promo.name}</div>
                                                    <div className="flex items-center gap-2">
                                                        {promo.kind === 'voucher' && (
                                                            <div className="font-mono text-xs text-muted-foreground mt-0.5">{promo.code}</div>
                                                        )}
                                                        {promo.is_active && !isLiveNow(promo) && (
                                                            <Badge variant="outline" className="mt-0.5 text-amber-600 border-amber-500/40">Di luar jadwal</Badge>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={promo.kind === 'bogo' ? 'secondary' : 'outline'} className="gap-1">
                                                        {promo.kind === 'bogo' ? <Gift className="h-3 w-3" /> : <TicketPercent className="h-3 w-3" />}
                                                        {promo.kind === 'bogo' ? 'Beli X Gratis Y' : 'Voucher'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground max-w-md truncate">{describe(promo)}</TableCell>
                                                <TableCell className="text-right text-sm tabular-nums">
                                                    {promo.kind === 'voucher'
                                                        ? (promo.max_uses ? `${Math.min(uses, promo.max_uses)}/${promo.max_uses}` : `${uses}×`)
                                                        : 'Auto'}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Switch
                                                        checked={promo.is_active}
                                                        onCheckedChange={(v) => handleToggle(promo, v)}
                                                    />
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-1">
                                                        <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-foreground" aria-label={`Ubah promo ${promo.name}`} onClick={() => setDraft({ ...promo, applies_to_product_ids: promo.applies_to_product_ids || [], applies_to_category_ids: promo.applies_to_category_ids || [] })}>
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive" aria-label={`Hapus promo ${promo.name}`}>
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent>
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle>Hapus promo "{promo.name}"?</AlertDialogTitle>
                                                                    <AlertDialogDescription>Transaksi lama tetap tersimpan; hanya aturan yang dihapus.</AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel>Batal</AlertDialogCancel>
                                                                    <AlertDialogAction onClick={() => handleDelete(promo)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Hapus</AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </main>

            {draft && (
                <PromoDialog
                    draft={draft}
                    onChange={setDraft}
                    onClose={() => setDraft(null)}
                    onSave={handleSave}
                    isSaving={isSaving}
                    products={products}
                    categories={categories}
                />
            )}
        </div>
    );
}

interface PromoDialogProps {
    draft: Draft;
    onChange: (d: Draft) => void;
    onClose: () => void;
    onSave: () => void;
    isSaving: boolean;
    products: { id: string; name: string }[];
    categories: { id: string; name: string }[];
}

function PromoDialog({ draft, onChange, onClose, onSave, isSaving, products, categories }: PromoDialogProps) {
    const set = (patch: Partial<Draft>) => onChange({ ...draft, ...patch });

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{draft.name ? 'Edit Promo' : 'Tambah Promo'}</DialogTitle>
                    <DialogDescription>Atur aturan diskon yang diterapkan di kasir.</DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                        {(['voucher', 'bogo'] as const).map(kind => (
                            <button
                                key={kind}
                                type="button"
                                onClick={() => set({ kind, code: kind === 'voucher' ? draft.code : undefined, free_product_id: kind === 'bogo' ? draft.free_product_id : undefined })}
                                aria-pressed={draft.kind === kind}
                                className={cn(
                                    'flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors',
                                    draft.kind === kind ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted'
                                )}
                            >
                                {kind === 'voucher' ? <div className="flex items-center justify-center gap-1.5"><TicketPercent className="h-4 w-4" /> Voucher</div> : <div className="flex items-center justify-center gap-1.5"><Gift className="h-4 w-4" /> Beli X Gratis Y</div>}
                            </button>
                        ))}
                    </div>

                    <div className="space-y-2">
                        <Label>Nama Promo</Label>
                        <Input value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="Mis. Promo Ramadhan" />
                    </div>

                    {draft.kind === 'voucher' ? (
                        <>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <Label>Kode Voucher</Label>
                                    <Input value={draft.code || ''} onChange={(e) => set({ code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20) })} placeholder="HEMAT10" className="font-mono uppercase" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Minimal Belanja (0 = tanpa)</Label>
                                    <Input type="number" min={0} value={draft.min_purchase ?? 0} onChange={(e) => set({ min_purchase: parseFloat(e.target.value) || 0 })} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Jenis Diskon</Label>
                                <div className="flex flex-wrap gap-2">
                                    {(['percentage', 'flat'] as const).map(t =>
                                        <button key={t} type="button" onClick={() => set({ discount_type: t })} aria-pressed={draft.discount_type === t} className={cn('rounded-lg border px-3 py-1.5 text-sm font-medium', draft.discount_type === t ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground')}>
                                            {t === 'percentage' ? 'Persen' : 'Nominal (Rp)'}
                                        </button>
                                    )}
                                </div>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">{draft.discount_type === 'percentage' ? '%' : 'Rp'}</span>
                                    <Input type="number" min={0} value={draft.discount_value ?? 0} onChange={(e) => set({ discount_value: parseFloat(e.target.value) || 0 })} className="pl-8" placeholder={draft.discount_type === 'percentage' ? '10' : '10000'} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Batas Pemakaian (0 = tanpa batas)</Label>
                                <Input type="number" min={0} value={draft.max_uses ?? 0} onChange={(e) => set({ max_uses: parseFloat(e.target.value) || 0 })} />
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <Label>Beli Sebanyak (X)</Label>
                                    <Input type="number" min={1} value={draft.buy_quantity ?? 1} onChange={(e) => set({ buy_quantity: Math.max(1, parseInt(e.target.value) || 1) })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Gratis (Y)</Label>
                                    <Input type="number" min={1} value={draft.free_quantity ?? 1} onChange={(e) => set({ free_quantity: Math.max(1, parseInt(e.target.value) || 1) })} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Batasan Produk yang Dibeli</Label>
                                <Multis categoryIds={draft.applies_to_category_ids || []} productIds={draft.applies_to_product_ids || []} categories={categories} products={products} onChangeCat={(ids) => set({ applies_to_category_ids: ids })} onChangeProd={(ids) => set({ applies_to_product_ids: ids })} />
                            </div>
                            <div className="space-y-2">
                                <Label>Produk Gratis (opsional; kosong = produk yang sama)</Label>
                                <SingleSelect items={products} value={draft.free_product_id || ''} onChange={(id) => set({ free_product_id: id })} placeholder="Produk yang sama dengan yang dibeli" />
                            </div>
                            <div className="space-y-2">
                                <Label>Maks Free Per Transaksi (0 = tanpa batas)</Label>
                                <Input type="number" min={0} value={draft.max_total_free_qty ?? 0} onChange={(e) => set({ max_total_free_qty: parseFloat(e.target.value) || 0 })} />
                            </div>
                        </>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label>Mulai Berlaku (opsional)</Label>
                                <Input type="datetime-local" value={toLocalInput(draft.starts_at)} onChange={(e) => set({ starts_at: fromLocalInput(e.target.value) })} />
                            </div>
                            <div className="space-y-2">
                                <Label>Berakhir (opsional)</Label>
                                <Input type="datetime-local" value={toLocalInput(draft.ends_at)} onChange={(e) => set({ ends_at: fromLocalInput(e.target.value) })} />
                            </div>
                        </div>

                        <div className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                            <p className="text-sm font-medium">Aktif</p>
                            <p className="text-xs text-muted-foreground">Diterapkan otomatis di kasir.</p>
                        </div>
                        <Switch checked={draft.is_active} onCheckedChange={(v) => set({ is_active: v })} />
                    </div>
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="ghost" onClick={onClose} disabled={isSaving}>Batal</Button>
                    <Button onClick={onSave} disabled={isSaving}>
                        <Power className="mr-2 h-4 w-4" /> {isSaving ? 'Menyimpan...' : 'Simpan'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function Multis({ categoryIds, productIds, categories, products, onChangeCat, onChangeProd }: {
    categoryIds: string[];
    productIds: string[];
    categories: { id: string; name: string }[];
    products: { id: string; name: string }[];
    onChangeCat: (ids: string[]) => void;
    onChangeProd: (ids: string[]) => void;
}) {
    const [mode, setMode] = useState<'all' | 'cat' | 'prod'>(categoryIds.length === 0 && productIds.length === 0 ? 'all' : categoryIds.length > 0 ? 'cat' : 'prod');

    return (
        <div className="space-y-2">
            <div className="flex gap-1.5">
                {(['all', 'cat', 'prod'] as const).map(m => (
                    <button key={m} type="button" onClick={() => { setMode(m); if (m === 'all') { onChangeCat([]); onChangeProd([]); } }} aria-pressed={mode === m} className={cn('px-2.5 py-1 rounded-md text-xs font-semibold border', mode === m ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground')}>
                        {m === 'all' ? 'Semua' : m === 'cat' ? 'Kategori' : 'Produk'}
                    </button>
                ))}
            </div>
            {mode === 'cat' && <MultiSelect items={categories} selected={categoryIds} onChange={onChangeCat} placeholder="Pilih kategori..." />}
            {mode === 'prod' && <MultiSelect items={products} selected={productIds} onChange={onChangeProd} placeholder="Pilih produk..." />}
            {mode === 'all' && <p className="text-xs text-muted-foreground">Promo berlaku untuk semua produk.</p>}
        </div>
    );
}