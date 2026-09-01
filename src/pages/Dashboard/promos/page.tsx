import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Plus, Trash2, Search, Percent, TicketPercent, Package, Tags } from 'lucide-react';
import { NotificationBell } from '@/components/NotificationBell';
import { ThemeToggle } from '@/components/ThemeButtons';
import { TokoCepatLogo } from '@/components/TokoCepatLogo';
import { useStore } from '@/lib/store';
import { useDbStore } from '@/lib/db-store';
import { toast } from '@/hooks/use-toast';
import { Promotion, PromoKind } from '@/lib/types';
import { savePromo, deletePromo, setPromoActive, generatePromoId } from '@/services/promoManagerService';
import { normalizePromo, isPromoLive } from '@/lib/promo-model';
import { cn } from '@/lib/utils';
import { formatIDR } from "@/lib/format";
import { PromoEditor, PromoEditorTab } from './_components/PromoEditor';
import { KIND_LABEL, KIND_ICON } from './_components/promoMeta';

type LeftTab = 'diskon' | 'voucher' | 'produk' | 'kategori';

const fmtDate = (iso?: string): string => {
    if (!iso) return '-';
    return new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const emptyDraft = (kind: PromoKind): Promotion => {
    const base: Promotion = {
        id: generatePromoId(),
        name: '',
        kind,
        is_active: true,
        created_at: new Date().toISOString(),
        applies_to_product_ids: [],
        applies_to_category_ids: [],
        discount_type: 'percentage',
        discount_value: 10,
        allowWholesale: true,
    };
    switch (kind) {
        case 'flat': return { ...base, reward_type: 'discount' };
        case 'bogo': return { ...base, buy_quantity: 2, free_quantity: 1 };
        case 'criteria': return { ...base, reward_type: 'discount', reward_product_ids: [] };
        case 'conditional': return { ...base, reward_type: 'discount', reward_product_ids: [], min_purchase: 50000, require_scope: true };
        case 'voucher': return { ...base, code: '', max_uses: 100, min_purchase: 0 };
    }
};

function PillButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <Button
            variant="ghost"
            size="sm"
            className={cn(
                "rounded-md px-2.5 h-7 shrink-0 text-xs gap-1.5",
                active ? "bg-background text-foreground ring-1 ring-inset ring-border" : "text-muted-foreground hover:text-foreground"
            )}
            aria-pressed={active}
            onClick={onClick}
        >
            {children}
        </Button>
    );
}

const PromoDiskonColumnClass = {
    name: "flex items-center gap-2 flex-1 min-w-0 h-full",
    type: "hidden sm:flex items-center w-[110px] px-2 border-l border-l-border/50 h-full",
    ketentuan: "hidden lg:flex items-center flex-1 min-w-0 max-w-[260px] px-2 border-l border-l-border/50 h-full",
    aktif: "flex items-center justify-center w-[64px] px-2 border-l border-l-border/50 h-full",
    aksi: "flex items-center justify-end w-[48px] px-2 border-l border-l-border/50 h-full",
};

const PromoVoucherColumnClass = {
    name: "flex items-center gap-2 flex-1 min-w-0 h-full",
    ketentuan: "hidden lg:flex items-center flex-1 min-w-0 max-w-[260px] px-2 border-l border-l-border/50 h-full",
    pemakaian: "hidden sm:flex items-center justify-end w-[96px] px-2 border-l border-l-border/50 h-full tabular-nums",
    aktif: "flex items-center justify-center w-[64px] px-2 border-l border-l-border/50 h-full",
    aksi: "flex items-center justify-end w-[48px] px-2 border-l border-l-border/50 h-full",
};

const PromoProductColumnClass = {
    check: "flex items-center justify-center w-10 shrink-0 h-full",
    name: "flex items-center gap-2 flex-1 min-w-0 h-full",
    brand: "hidden sm:flex items-center text-sm text-muted-foreground truncate max-w-[120px] w-[120px] px-2 border-l border-l-border/50 h-full",
    category: "hidden md:flex items-center text-sm text-muted-foreground truncate max-w-[140px] w-[140px] px-2 border-l border-l-border/50 h-full",
    price: "flex items-center justify-end shrink-0 text-right tabular-nums whitespace-nowrap w-[100px] px-2 border-l border-l-border/50 h-full",
};

export default function PromosPage() {
    const { promos, products, categories } = useStore();

    const [leftTab, setLeftTab] = useState<LeftTab>('diskon');
    const [query, setQuery] = useState('');
    const [promoProductFilter, setPromoProductFilter] = useState<'all' | 'wholesale'>('all');
    const [draft, setDraft] = useState<Promotion>(() => emptyDraft('flat'));
    const [isNew, setIsNew] = useState(true);
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<PromoEditorTab>('diskon');

    // Shared scope: the left-panel checkbox selection feeds BOTH Diskon & Voucher.
    const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
    const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set());

    const normalizedPromos = promos.map(normalizePromo);
    const diskons = normalizedPromos.filter(p => p.kind !== 'voucher');
    const vouchers = normalizedPromos.filter(p => p.kind === 'voucher');

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

    const toggleProduct = (id: string) =>
        setSelectedProductIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    const toggleCategory = (id: string) =>
        setSelectedCategoryIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    const clearScope = () => {
        setSelectedProductIds(new Set());
        setSelectedCategoryIds(new Set());
    };

    const handleSelect = (promo: Promotion) => {
        setDraft({
            ...promo,
            applies_to_product_ids: promo.applies_to_product_ids || [],
            applies_to_category_ids: promo.applies_to_category_ids || [],
        });
        setIsNew(false);
        setActiveTab(promo.kind === 'voucher' ? 'voucher' : 'diskon');
        setSelectedProductIds(new Set(promo.applies_to_product_ids || []));
        setSelectedCategoryIds(new Set(promo.applies_to_category_ids || []));
        if (window.innerWidth < 768) setIsSheetOpen(true);
    };

    const handleEditorTab = (tab: PromoEditorTab) => {
        setActiveTab(tab);
        const kind: PromoKind = tab === 'voucher' ? 'voucher' : 'flat';
        const mismatch = tab === 'voucher' ? draft.kind !== 'voucher' : draft.kind === 'voucher';
        if (mismatch) {
            setDraft(emptyDraft(kind));
            setIsNew(true);
        }
    };

    const resetToNewDiskon = () => {
        setDraft(emptyDraft('flat'));
        setIsNew(true);
        setActiveTab('diskon');
    };

    const handleCancel = () => {
        resetToNewDiskon();
        setIsSheetOpen(false);
    };

    const buildClean = (d: Promotion): Promotion => {
        const scopeProducts = (d.applies_to_product_ids || []).length ? d.applies_to_product_ids : undefined;
        const scopeCategories = (d.applies_to_category_ids || []).length ? d.applies_to_category_ids : undefined;
        const base: Promotion = {
            ...d,
            name: d.name.trim(),
            applies_to_product_ids: scopeProducts,
            applies_to_category_ids: scopeCategories,
        };
        switch (d.kind) {
            case 'voucher':
                return {
                    ...base,
                    code: (d.code || '').trim().toUpperCase(),
                    discount_type: d.discount_type,
                    discount_value: d.discount_value,
                    min_purchase: (d.min_purchase || 0) > 0 ? d.min_purchase : undefined,
                    max_uses: d.max_uses,
                    reward_type: undefined, reward_product_ids: undefined, require_scope: undefined,
                    buy_quantity: undefined, free_quantity: undefined, free_product_id: undefined, max_total_free_qty: undefined,
                };
            case 'flat':
                return {
                    ...base,
                    discount_type: d.discount_type,
                    discount_value: d.discount_value,
                    max_discount_amount: (d as any).max_discount_amount && (d as any).max_discount_amount > 0 ? (d as any).max_discount_amount : undefined,
                    reward_type: undefined, reward_product_ids: undefined, require_scope: undefined,
                    code: undefined, min_purchase: undefined, max_uses: undefined,
                    buy_quantity: undefined, free_quantity: undefined, free_product_id: undefined, max_total_free_qty: undefined,
                    min_scope_qty: undefined, max_flat_amount: undefined, max_bonus_qty: undefined,
                };
            case 'bogo':
                return {
                    ...base,
                    buy_quantity: d.buy_quantity,
                    free_quantity: d.free_quantity,
                    free_product_id: d.free_product_id || undefined,
                    max_total_free_qty: (d.max_total_free_qty || 0) > 0 ? d.max_total_free_qty : undefined,
                    discount_type: undefined, discount_value: undefined, reward_type: undefined, reward_product_ids: undefined,
                    require_scope: undefined, code: undefined, min_purchase: undefined, max_uses: undefined,
                };
            case 'criteria': {
                const r = (d.reward_type === 'bonus_product' ? 'bonus_product' : 'discount') as any;
                const needsDiscount = r === 'discount';
                return {
                    ...base,
                    reward_type: r,
                    reward_product_ids: (d.reward_product_ids || []).length ? d.reward_product_ids : undefined,
                    discount_type: needsDiscount ? d.discount_type : undefined,
                    discount_value: needsDiscount ? d.discount_value : undefined,
                    min_scope_qty: (d as any).min_scope_qty && (d as any).min_scope_qty > 0 ? (d as any).min_scope_qty : undefined,
                    max_flat_amount: needsDiscount && (d as any).max_flat_amount && (d as any).max_flat_amount > 0 ? (d as any).max_flat_amount : undefined,
                    max_bonus_qty: !needsDiscount && (d as any).max_bonus_qty && (d as any).max_bonus_qty > 0 ? (d as any).max_bonus_qty : undefined,
                    require_scope: undefined, code: undefined, min_purchase: undefined, max_uses: undefined,
                    buy_quantity: undefined, free_quantity: undefined, free_product_id: undefined, max_total_free_qty: undefined,
                    max_discount_amount: undefined,
                };
            }
            case 'conditional': {
                const r = (d.reward_type === 'bonus_product' ? 'bonus_product' : 'discount') as any;
                return {
                    ...base,
                    min_purchase: d.min_purchase,
                    require_scope: d.require_scope,
                    reward_type: r,
                    reward_product_ids: (d.reward_product_ids || []).length ? d.reward_product_ids : undefined,
                    discount_type: r === 'discount' ? d.discount_type : undefined,
                    discount_value: r === 'discount' ? d.discount_value : undefined,
                    min_scope_qty: (d as any).min_scope_qty && (d as any).min_scope_qty > 0 ? (d as any).min_scope_qty : undefined,
                    max_flat_amount: r === 'discount' && (d as any).max_flat_amount && (d as any).max_flat_amount > 0 ? (d as any).max_flat_amount : undefined,
                    max_bonus_qty: r === 'bonus_product' && (d as any).max_bonus_qty && (d as any).max_bonus_qty > 0 ? (d as any).max_bonus_qty : undefined,
                    code: undefined, max_uses: undefined,
                    buy_quantity: undefined, free_quantity: undefined, free_product_id: undefined, max_total_free_qty: undefined,
                    max_discount_amount: undefined,
                };
            }
        }
    };

    const handleSave = async () => {
        if (!draft) return;
        // The shared left-panel selection is the scope the user sees and edits —
        // sync it into the draft so validation and the saved rule match the UI.
        const effectiveDraft: Promotion = {
            ...draft,
            applies_to_product_ids: [...selectedProductIds],
            applies_to_category_ids: [...selectedCategoryIds],
        };
        if (!effectiveDraft.name.trim()) {
            toast({ variant: 'destructive', title: 'Nama wajib diisi' });
            return;
        }
        if (!effectiveDraft.starts_at || !effectiveDraft.ends_at) {
            toast({ variant: 'destructive', title: 'Rentang berlaku wajib diisi' });
            return;
        }
        if (new Date(effectiveDraft.ends_at) <= new Date(effectiveDraft.starts_at)) {
            toast({ variant: 'destructive', title: 'Jadwal salah', description: 'Tanggal berakhir harus setelah tanggal mulai.' });
            return;
        }

        if (effectiveDraft.kind === 'voucher') {
            if (!effectiveDraft.code?.trim()) {
                toast({ variant: 'destructive', title: 'Kode voucher wajib diisi' });
                return;
            }
            const clash = vouchers.find(p =>
                p.id !== effectiveDraft.id && (p.code || '').toUpperCase() === (effectiveDraft.code || '').toUpperCase()
            );
            if (clash) {
                toast({ variant: 'destructive', title: 'Kode sudah dipakai', description: `Kode "${effectiveDraft.code}" sudah digunakan pada voucher ${clash.name}.` });
                return;
            }
            if ((effectiveDraft.discount_value || 0) <= 0) {
                toast({ variant: 'destructive', title: 'Besar diskon wajib diisi' });
                return;
            }
        } else {
            if ((effectiveDraft.applies_to_product_ids?.length || 0) === 0 && (effectiveDraft.applies_to_category_ids?.length || 0) === 0) {
                toast({ variant: 'destructive', title: 'Pilih produk/kategori dulu', description: 'Diskon butuh minimal satu produk atau kategori di panel kiri.' });
                return;
            }
            if (effectiveDraft.kind === 'flat' && (effectiveDraft.discount_value || 0) <= 0) {
                toast({ variant: 'destructive', title: 'Besar diskon wajib diisi' });
                return;
            }
            if (effectiveDraft.kind === 'bogo' && (!effectiveDraft.buy_quantity || effectiveDraft.buy_quantity < 1)) {
                toast({ variant: 'destructive', title: 'Jumlah beli (X) wajib diisi' });
                return;
            }
            if (effectiveDraft.kind === 'criteria') {
                const r = effectiveDraft.reward_type || 'discount';
                if (r === 'discount' && (effectiveDraft.discount_value || 0) <= 0) {
                    toast({ variant: 'destructive', title: 'Besar diskon wajib diisi' });
                    return;
                }
                if (r === 'bonus_product' && !(effectiveDraft.reward_product_ids?.length)) {
                    toast({ variant: 'destructive', title: 'Pilih produk hadiah' });
                    return;
                }
            }
            if (effectiveDraft.kind === 'conditional') {
                if (!effectiveDraft.min_purchase || effectiveDraft.min_purchase <= 0) {
                    toast({ variant: 'destructive', title: 'Minimal belanja wajib diisi' });
                    return;
                }
                const r = effectiveDraft.reward_type || 'discount';
                if (r === 'discount' && (effectiveDraft.discount_value || 0) <= 0) {
                    toast({ variant: 'destructive', title: 'Besar diskon wajib diisi' });
                    return;
                }
                if (r === 'bonus_product' && !(effectiveDraft.reward_product_ids?.length)) {
                    toast({ variant: 'destructive', title: 'Pilih produk bonus' });
                    return;
                }
            }
        }

        const clean = buildClean(effectiveDraft);
        setIsSaving(true);
        try {
            await savePromo(clean);
            toast({ title: 'Promo Disimpan', description: `"${clean.name}" berhasil disimpan.` });
            resetToNewDiskon();
            clearScope();
            setIsSheetOpen(false);
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
            if (draft?.id === promo.id) handleCancel();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Gagal Hapus', description: error.message });
        }
    };

    const handleToggle = async (promo: Promotion, active: boolean) => {
        await setPromoActive(promo.id, active);
        toast({ title: active ? 'Promo Diaktifkan' : 'Promo Dinonaktifkan', description: promo.name });
    };

    const scopeSummary = (p: Promotion): string => {
        const pids = p.applies_to_product_ids || [];
        const cids = p.applies_to_category_ids || [];
        if (pids.length === 0 && cids.length === 0) return 'Semua produk';
        const parts: string[] = [];
        if (pids.length) parts.push(`${pids.length} produk`);
        if (cids.length) parts.push(`${cids.length} kategori`);
        return parts.join(' · ');
    };

    const rewardName = (p: Promotion): string => {
        const names = (p.reward_product_ids || []).map(productName);
        return names.length ? names.join(', ') : '-';
    };

    const discText = (p: Promotion) => p.discount_type === 'percentage' ? `${p.discount_value}%` : formatIDR(p.discount_value || 0);

    const describe = (p: Promotion): string => {
        let desc: string;
        switch (p.kind) {
            case 'flat':
                desc = `Diskon ${discText(p)} · ${scopeSummary(p)}`;
                break;
            case 'bogo':
                desc = `Beli ${p.buy_quantity ?? 2} → gratis ${p.free_quantity ?? 1}${p.free_product_id ? ` (${productName(p.free_product_id)})` : ''} · ${scopeSummary(p)}`;
                break;
            case 'criteria': {
                const scope = scopeSummary(p);
                if (p.reward_type === 'discount') desc = `Beli semua ${scope} → diskon ${discText(p)}`;
                else if ((p.reward_type as any) === 'discount_product') desc = `Beli semua ${scope} → diskon ${discText(p)} untuk ${rewardName(p)}`;
                else desc = `Beli semua ${scope} → gratis ${rewardName(p)}`;
                break;
            }
            case 'conditional': {
                const min = p.min_purchase ? `Belanja ≥ ${formatIDR(p.min_purchase)}` : 'Belanja';
                const scope = p.require_scope ? ` + beli ${scopeSummary(p)}` : '';
                desc = p.reward_type === 'bonus_product'
                    ? `${min}${scope} → gratis ${rewardName(p)}`
                    : `${min}${scope} → diskon ${discText(p)}`;
                break;
            }
            case 'voucher': {
                const scope = scopeSummary(p) !== 'Semua produk' ? ` · ${scopeSummary(p)}` : '';
                const min = p.min_purchase ? `, min ${formatIDR(p.min_purchase)}` : '';
                desc = `Diskon ${discText(p)}${min}${scope}`;
                break;
            }
        }
        if (p.starts_at || p.ends_at) {
            desc += ` · ${fmtDate(p.starts_at)} → ${fmtDate(p.ends_at)}`;
        }
        return desc;
    };

    const overlaps = (a: Promotion, b: Promotion): boolean => {
        const aP = new Set(a.applies_to_product_ids || []);
        const bP = new Set(b.applies_to_product_ids || []);
        const aC = new Set(a.applies_to_category_ids || []);
        const bC = new Set(b.applies_to_category_ids || []);
        return [...aP].some(id => bP.has(id)) || [...aC].some(id => bC.has(id));
    };

    const conflictFor = (p: Promotion): boolean =>
        diskons.some(o => o.id !== p.id && o.is_active && isPromoLive(o) && overlaps(p, o));

    const q = query.trim().toLowerCase();
    const filteredDiskons = diskons.filter(p => !q || p.name.toLowerCase().includes(q) || describe(p).toLowerCase().includes(q));
    const filteredVouchers = vouchers.filter(p => !q || p.name.toLowerCase().includes(q) || (p.code || '').toLowerCase().includes(q));
    let filteredProducts = products.filter(p => !q || p.name.toLowerCase().includes(q) || (p.barcode || '').toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q));
    if (leftTab === 'produk' && promoProductFilter === 'wholesale') filteredProducts = filteredProducts.filter(p => !!(p as any).isWholesaleEnabled);
    const filteredCategories = categories.filter(c => !q || c.name.toLowerCase().includes(q));

    const searchPlaceholder: Record<LeftTab, string> = {
        diskon: 'Cari diskon...',
        voucher: 'Cari kode/nama voucher...',
        produk: 'Cari produk (nama/barcode)...',
        kategori: 'Cari kategori...',
    };

    const selectedId = draft.id;

    const scopePickerFooter = (count: number, label: string) => (
        <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-muted-foreground">
            <span>{count} {label} dipilih</span>
            {count > 0 && (
                <button type="button" className="font-medium text-primary hover:underline" onClick={clearScope}>Bersihkan</button>
            )}
        </div>
    );

    return (
        <div className="flex h-screen w-full flex-col overflow-hidden bg-muted/40">
            <header className="sticky top-0 z-20 flex h-10 items-center gap-4 border-b border-border/60 bg-background/80 px-4 justify-between shrink-0 backdrop-blur-md">
                <Link to="/">
                    <TokoCepatLogo />
                </Link>
                <div className="flex items-center gap-2">
                    <Button onClick={() => { resetToNewDiskon(); setIsSheetOpen(true); }} className="md:hidden" size="sm">
                        <Plus className="mr-1 h-4 w-4" /> Tambah
                    </Button>
                    <NotificationBell />
                    <ThemeToggle />
                </div>
            </header>

            <div className="w-full min-h-0 flex-1 md:grid md:grid-cols-10">
                {/* LEFT: 4-tab panel */}
                <div className="col-span-10 md:col-span-6 lg:col-span-6 flex h-full flex-col min-h-0 bg-background">
                    <div className="px-3 pt-3 pb-2 flex flex-col w-full gap-2 shrink-0">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
                            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={searchPlaceholder[leftTab]} className="pl-9 h-8 bg-card" />
                        </div>
                        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                            <div className="flex items-center gap-1.5 bg-muted/60 rounded-md p-1 shrink-0">
                                <PillButton active={leftTab === 'diskon'} onClick={() => setLeftTab('diskon')}><Percent className="size-3.5" /> Diskon</PillButton>
                                <PillButton active={leftTab === 'voucher'} onClick={() => setLeftTab('voucher')}><TicketPercent className="size-3.5" /> Voucher</PillButton>
                                <PillButton active={leftTab === 'produk'} onClick={() => setLeftTab('produk')}><Package className="size-3.5" /> Produk</PillButton>
                                <PillButton active={leftTab === 'kategori'} onClick={() => setLeftTab('kategori')}><Tags className="size-3.5" /> Kategori</PillButton>
                            </div>
                        </div>
                    </div>

                    <div className="min-h-0 flex-1 overflow-auto">
                        {leftTab === 'diskon' && (
                            filteredDiskons.length === 0 ? (
                                <div className="py-16 text-center text-muted-foreground">
                                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                                        <Percent className="h-6 w-6" />
                                    </div>
                                    <p className="font-medium text-foreground/70">{diskons.length === 0 ? 'Belum ada diskon' : 'Diskon tidak ditemukan'}</p>
                                    <p className="text-sm">Isi form diskon di panel kanan untuk aturan pertama.</p>
                                </div>
                            ) : (
                                <>
                                    <div className="px-4 w-full">
                                        <div className="rounded-t-lg h-8 w-full border bg-card flex items-center px-4">
                                            <div className={PromoDiskonColumnClass.name}>
                                                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Promo</span>
                                            </div>
                                            <div className={PromoDiskonColumnClass.type}>
                                                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Tipe</span>
                                            </div>
                                            <div className={PromoDiskonColumnClass.ketentuan}>
                                                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Ketentuan</span>
                                            </div>
                                            <div className={PromoDiskonColumnClass.aktif}>
                                                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Aktif</span>
                                            </div>
                                            <div className={PromoDiskonColumnClass.aksi}>
                                                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Aksi</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="px-4 pb-4">
                                        {filteredDiskons.map(promo => {
                                            const Icon = KIND_ICON[promo.kind];
                                            const isSelected = selectedId === promo.id;
                                            return (
                                                <div key={promo.id} className="bg-card border-x border-b border-b-border/50 p-0 h-9">
                                                    <div
                                                        role="button"
                                                        tabIndex={0}
                                                        onClick={() => handleSelect(promo)}
                                                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelect(promo); }}}
                                                        className={cn(
                                                            "group flex items-center px-4 transition-colors cursor-pointer hover:bg-accent h-9 focus:outline-none focus-visible:bg-accent",
                                                            isSelected ? "bg-primary/10 text-primary ring-1 ring-inset ring-primary" : ''
                                                        )}
                                                    >
                                                        <div className={PromoDiskonColumnClass.name}>
                                                            <div className="min-w-0">
                                                                <p className="text-sm font-medium truncate">{promo.name}</p>
                                                                {(promo.is_active && !isPromoLive(promo) || conflictFor(promo)) && (
                                                                    <div className="flex items-center gap-1 mt-0.5">
                                                                        {promo.is_active && !isPromoLive(promo) && (
                                                                            <Badge variant="outline" className="text-[10px] leading-none py-0.5 px-1.5 text-warning dark:text-warning-foreground border-warning/40">Di luar jadwal</Badge>
                                                                        )}
                                                                        {conflictFor(promo) && (
                                                                            <Badge variant="outline" className="text-[10px] leading-none py-0.5 px-1.5 border-warning/50 text-warning dark:text-warning-foreground">Bentrok</Badge>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className={PromoDiskonColumnClass.type}>
                                                            <Badge variant="secondary" className="gap-1 font-medium text-xs max-w-[100px] truncate">
                                                                <Icon className="h-3 w-3 shrink-0" /> {KIND_LABEL[promo.kind]}
                                                            </Badge>
                                                        </div>
                                                        <div className={PromoDiskonColumnClass.ketentuan}>
                                                            <span className="truncate text-sm text-muted-foreground">{describe(promo)}</span>
                                                        </div>
                                                        <div className={PromoDiskonColumnClass.aktif} onClick={e => e.stopPropagation()}>
                                                            <Switch checked={promo.is_active} onCheckedChange={v => handleToggle(promo, v)} />
                                                        </div>
                                                        <div className={PromoDiskonColumnClass.aksi} onClick={e => e.stopPropagation()}>
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive" aria-label={`Hapus promo ${promo.name}`}>
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                </AlertDialogTrigger>
                                                                <AlertDialogContent>
                                                                    <AlertDialogHeader>
                                                                        <AlertDialogTitle>Hapus diskon "{promo.name}"?</AlertDialogTitle>
                                                                        <AlertDialogDescription>Transaksi lama tetap tersimpan; hanya aturan yang dihapus.</AlertDialogDescription>
                                                                    </AlertDialogHeader>
                                                                    <AlertDialogFooter>
                                                                        <AlertDialogCancel>Batal</AlertDialogCancel>
                                                                        <AlertDialogAction onClick={() => handleDelete(promo)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Hapus</AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            )
                        )}

                        {leftTab === 'voucher' && (
                            filteredVouchers.length === 0 ? (
                                <div className="py-16 text-center text-muted-foreground">
                                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                                        <TicketPercent className="h-6 w-6" />
                                    </div>
                                    <p className="font-medium text-foreground/70">{vouchers.length === 0 ? 'Belum ada voucher' : 'Voucher tidak ditemukan'}</p>
                                    <p className="text-sm">Buka tab Voucher di panel kanan untuk kode diskon.</p>
                                </div>
                            ) : (
                                <>
                                    <div className="px-4 w-full">
                                        <div className="rounded-t-lg h-8 w-full border bg-card flex items-center px-4">
                                            <div className={PromoVoucherColumnClass.name}>
                                                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Promo</span>
                                            </div>
                                            <div className={PromoVoucherColumnClass.ketentuan}>
                                                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Ketentuan</span>
                                            </div>
                                            <div className={PromoVoucherColumnClass.pemakaian}>
                                                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Pemakaian</span>
                                            </div>
                                            <div className={PromoVoucherColumnClass.aktif}>
                                                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Aktif</span>
                                            </div>
                                            <div className={PromoVoucherColumnClass.aksi}>
                                                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Aksi</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="px-4 pb-4">
                                        {filteredVouchers.map(promo => {
                                            const uses = (usageByCode[(promo.code || '').toUpperCase()] || 0) + (promo.uses_count || 0);
                                            const isSelected = selectedId === promo.id;
                                            return (
                                                <div key={promo.id} className="bg-card border-x border-b border-b-border/50 p-0 h-9">
                                                    <div
                                                        role="button"
                                                        tabIndex={0}
                                                        onClick={() => handleSelect(promo)}
                                                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelect(promo); }}}
                                                        className={cn(
                                                            "group flex items-center px-4 transition-colors cursor-pointer hover:bg-accent h-9 focus:outline-none focus-visible:bg-accent",
                                                            isSelected ? "bg-primary/10 text-primary ring-1 ring-inset ring-primary" : ''
                                                        )}
                                                    >
                                                        <div className={PromoVoucherColumnClass.name}>
                                                            <div className="min-w-0">
                                                                <p className="text-sm font-medium truncate">{promo.name}</p>
                                                                <p className="font-mono text-xs text-muted-foreground truncate">{promo.code}</p>
                                                            </div>
                                                        </div>
                                                        <div className={PromoVoucherColumnClass.ketentuan}>
                                                            <span className="truncate text-sm text-muted-foreground">{describe(promo)}</span>
                                                        </div>
                                                        <div className={PromoVoucherColumnClass.pemakaian}>
                                                            <span className="text-sm tabular-nums">{promo.max_uses ? `${Math.min(uses, promo.max_uses)}/${promo.max_uses}` : `${uses}×`}</span>
                                                        </div>
                                                        <div className={PromoVoucherColumnClass.aktif} onClick={e => e.stopPropagation()}>
                                                            <Switch checked={promo.is_active} onCheckedChange={v => handleToggle(promo, v)} />
                                                        </div>
                                                        <div className={PromoVoucherColumnClass.aksi} onClick={e => e.stopPropagation()}>
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive" aria-label={`Hapus voucher ${promo.name}`}>
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                </AlertDialogTrigger>
                                                                <AlertDialogContent>
                                                                    <AlertDialogHeader>
                                                                        <AlertDialogTitle>Hapus voucher "{promo.name}"?</AlertDialogTitle>
                                                                        <AlertDialogDescription>Transaksi lama tetap tersimpan; hanya aturan yang dihapus.</AlertDialogDescription>
                                                                    </AlertDialogHeader>
                                                                    <AlertDialogFooter>
                                                                        <AlertDialogCancel>Batal</AlertDialogCancel>
                                                                        <AlertDialogAction onClick={() => handleDelete(promo)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Hapus</AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            )
                        )}

                        {leftTab === 'produk' && (
                            <div className="flex h-full flex-col">
                                <div className="px-3 py-1 flex gap-1.5">
                                    <PillButton active={promoProductFilter === 'all'} onClick={() => setPromoProductFilter('all')}>Semua</PillButton>
                                    <PillButton active={promoProductFilter === 'wholesale'} onClick={() => setPromoProductFilter('wholesale')}>Grosir</PillButton>
                                </div>
                                {filteredProducts.length === 0 ? (
                                <div className="py-16 text-center text-muted-foreground">
                                    <p className="font-medium text-foreground/70">{products.length === 0 ? 'Belum ada produk' : 'Produk tidak ditemukan'}</p>
                                </div>
                            ) : (
                                <div className="flex h-full flex-col min-h-0">
                                    <div className="px-4 w-full">
                                        <div className="rounded-t-lg h-8 w-full border bg-card flex items-center px-4">
                                            <div className={PromoProductColumnClass.check}>
                                                <span className="sr-only">Pilih</span>
                                            </div>
                                            <div className={PromoProductColumnClass.name}>
                                                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Produk</span>
                                            </div>
                                            <div className={PromoProductColumnClass.brand}>
                                                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Brand</span>
                                            </div>
                                            <div className={PromoProductColumnClass.category}>
                                                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Kategori</span>
                                            </div>
                                            <div className={PromoProductColumnClass.price}>
                                                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Harga</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="min-h-0 flex-1 overflow-auto px-4 pb-4">
                                        {filteredProducts.map(p => {
                                            const isChecked = selectedProductIds.has(p.id);
                                            return (
                                                <div key={p.id} className="bg-card border-x border-b border-b-border/50 p-0 h-9">
                                                    <div
                                                        role="button"
                                                        tabIndex={0}
                                                        onClick={() => toggleProduct(p.id)}
                                                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleProduct(p.id); }}}
                                                        className={cn(
                                                            "group flex items-center px-4 transition-colors cursor-pointer hover:bg-accent h-9 focus:outline-none focus-visible:bg-accent",
                                                            isChecked ? "bg-primary/10 ring-1 ring-inset ring-primary" : ''
                                                        )}
                                                    >
                                                        <div className={PromoProductColumnClass.check}>
                                                            <Checkbox checked={isChecked} className="pointer-events-none" tabIndex={-1} />
                                                        </div>
                                                        <div className={PromoProductColumnClass.name}>
                                                            <p className="text-sm font-medium truncate">{p.name}</p>
                                                        </div>
                                                        <div className={PromoProductColumnClass.brand}>
                                                            <span className={cn("truncate text-sm", !p.brand && "text-muted-foreground/40")}>{p.brand || '—'}</span>
                                                        </div>
                                                        <div className={PromoProductColumnClass.category}>
                                                            <span className="truncate text-sm text-muted-foreground">{p.category_id ? categoryName(p.category_id) : '—'}</span>
                                                        </div>
                                                        <div className={PromoProductColumnClass.price}>
                                                            <span className="text-sm font-bold tabular-nums">{formatIDR(p.price)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {scopePickerFooter(selectedProductIds.size, 'produk')}
                                </div>
                            )}
                            </div>
                        )}

                        {leftTab === 'kategori' && (
                            filteredCategories.length === 0 ? (
                                <div className="py-16 text-center text-muted-foreground">
                                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                                        <Tags className="h-6 w-6" />
                                    </div>
                                    <p className="font-medium text-foreground/70">{categories.length === 0 ? 'Belum ada kategori' : 'Kategori tidak ditemukan'}</p>
                                </div>
                            ) : (
                                <div className="flex h-full flex-col min-h-0">
                                    <div className="px-4 w-full">
                                        <div className="rounded-t-lg h-8 w-full border bg-card flex items-center px-4">
                                            <div className="flex items-center justify-center w-10 shrink-0 h-full">
                                                <span className="sr-only">Pilih</span>
                                            </div>
                                            <div className="flex items-center gap-2 flex-1 min-w-0 h-full">
                                                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Kategori</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="min-h-0 flex-1 overflow-auto px-4 pb-4">
                                        {filteredCategories.map(c => {
                                            const isChecked = selectedCategoryIds.has(c.id);
                                            return (
                                                <div key={c.id} className="bg-card border-x border-b border-b-border/50 p-0 h-9">
                                                    <div
                                                        role="button"
                                                        tabIndex={0}
                                                        onClick={() => toggleCategory(c.id)}
                                                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleCategory(c.id); }}}
                                                        className={cn(
                                                            "group flex items-center px-4 transition-colors cursor-pointer hover:bg-accent h-9 focus:outline-none focus-visible:bg-accent",
                                                            isChecked ? "bg-primary/10 ring-1 ring-inset ring-primary" : ''
                                                        )}
                                                    >
                                                        <div className="flex items-center justify-center w-10 shrink-0 h-full">
                                                            <Checkbox checked={isChecked} className="pointer-events-none" tabIndex={-1} />
                                                        </div>
                                                        <div className="flex items-center gap-2 flex-1 min-w-0 h-full">
                                                            <span className="text-sm font-medium truncate">{c.name}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {scopePickerFooter(selectedCategoryIds.size, 'kategori')}
                                </div>
                            )
                        )}
                    </div>
                </div>

                {/* RIGHT: editor (desktop) */}
                <aside className="hidden h-full min-h-0 border-l border-border bg-background md:col-span-4 md:block lg:col-span-4">
                    <PromoEditor
                        draft={draft}
                        isNew={isNew}
                        onChange={setDraft}
                        onCancel={handleCancel}
                        onSave={handleSave}
                        isSaving={isSaving}
                        products={products}
                        categories={categories}
                        selectedProductIds={selectedProductIds}
                        selectedCategoryIds={selectedCategoryIds}
                        onClearScope={clearScope}
                        activeTab={activeTab}
                        onTabChange={handleEditorTab}
                        existingCodes={vouchers.map(v => v.code || '')}
                    />
                </aside>
            </div>

            {/* Editor drawer (mobile) */}
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                <SheetContent side="right" className="flex w-full flex-col p-0 sm:w-125">
                    <SheetHeader className="sr-only">
                        <SheetTitle>Promo & Voucher</SheetTitle>
                    </SheetHeader>
                    <div className="flex h-full min-h-0 flex-col">
                        <PromoEditor
                            draft={draft}
                            isNew={isNew}
                            onChange={setDraft}
                            onCancel={handleCancel}
                            onSave={handleSave}
                            isSaving={isSaving}
                            products={products}
                            categories={categories}
                            selectedProductIds={selectedProductIds}
                            selectedCategoryIds={selectedCategoryIds}
                            onClearScope={clearScope}
                            activeTab={activeTab}
                            onTabChange={handleEditorTab}
                            existingCodes={vouchers.map(v => v.code || '')}
                        />
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    );
}