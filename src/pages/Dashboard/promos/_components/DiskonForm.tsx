import { useRef, useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { X } from 'lucide-react';
import { ScrollArea, ScrollAreaHandle } from '@/components/ui/scroll-area';
import { ScrollShadow } from '@/components/ui/scrollshadow';
import { cn } from '@/lib/utils';
import { SearchDropdown } from '@/components/SearchDropdown';
import { Badge } from '@/components/ui/badge';
import { DiscountFields } from './DiscountFields';
import { SchedulePicker } from './SchedulePicker';
import { ScopeSummary } from './ScopeSummary';
import { KIND_META, REWARD_META } from './promoMeta';
import { Promotion, PromoKind } from '@/lib/types';

const DISKON_KINDS: PromoKind[] = ['flat', 'bogo', 'criteria', 'conditional'];

export interface DiskonFormProps {
    draft: Promotion;
    isNew: boolean;
    onChange: (d: Promotion) => void;
    onCancel: () => void;
    onSave: () => void;
    isSaving: boolean;
    products: { id: string; name: string }[];
    categories: { id: string; name: string }[];
    selectedProductIds: Set<string>;
    selectedCategoryIds: Set<string>;
    onClearScope: () => void;
}

export function DiskonForm({ draft, isNew, onChange, onCancel, onSave, isSaving, products, selectedProductIds, selectedCategoryIds, onClearScope }: DiskonFormProps) {
    const set = (patch: Partial<Promotion>) => onChange({ ...draft, ...patch });
    const scrollRef = useRef<ScrollAreaHandle>(null);
    const reward = draft.reward_type || 'discount';
    const [bogoQuery, setBogoQuery] = useState('');
    const [criteriaQuery, setCriteriaQuery] = useState('');
    const [conditionalQuery, setConditionalQuery] = useState('');

    const handleKindChange = (kind: PromoKind) => {
        if (kind === draft.kind) return;
        const patch: Partial<Promotion> = { kind };
        if (kind === 'flat') patch.reward_type = 'discount';
        else if (kind === 'bogo') patch.reward_type = undefined;
        else if (kind === 'criteria') patch.reward_type = draft.reward_type === 'bonus_product' ? 'bonus_product' : 'discount';
        else patch.reward_type = draft.reward_type === 'bonus_product' ? 'bonus_product' : 'discount';
        onChange({ ...draft, ...patch });
    };

    const rewardChips = (allowed: typeof REWARD_META) => (
        <div className="flex flex-wrap gap-2">
            {allowed.map(({ value, label, hint, icon: Icon }) => (
                <button
                    key={value}
                    type="button"
                    onClick={() => set({ reward_type: value })}
                    aria-pressed={reward === value}
                    title={hint}
                    className={cn(
                        'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium',
                        reward === value ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'
                    )}
                >
                    <Icon className="size-3.5" /> {label}
                </button>
            ))}
        </div>
    );

    return (
        <div className="flex h-full flex-col min-h-0">
            <div className="shrink-0 border-b border-border/60 px-4 py-3">
                <h2 className="text-sm font-semibold">{isNew ? 'Buat Diskon' : 'Ubah Diskon'}</h2>
                <p className="text-xs text-muted-foreground">Diterapkan otomatis di kasir.</p>
            </div>

            <div className="flex-1 min-h-0 relative overflow-hidden">
                <ScrollShadow scrollRef={scrollRef} side="both" />
                <ScrollArea ref={scrollRef} className="px-1 h-full">
                    <div className="space-y-3 p-3">
                        <Card className="border-border/60">
                            <CardHeader className="px-3 py-2 border-b border-border/60"><CardTitle className="text-sm">Informasi Dasar</CardTitle></CardHeader>
                            <CardContent className="space-y-3 px-3 py-3">
                                <div className="space-y-2">
                                    <Label>Nama Diskon</Label>
                                    <Input value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="Mis. Promo Ramadhan" />
                                </div>

                                <div className="space-y-2">
                                    <Label>Jenis Diskon</Label>
                                    <div className="grid grid-cols-2 gap-1.5">
                                        {KIND_META.filter(k => DISKON_KINDS.includes(k.kind)).map(({ kind, label, hint, icon: Icon }) => (
                                            <button
                                                key={kind}
                                                type="button"
                                                onClick={() => handleKindChange(kind)}
                                                aria-pressed={draft.kind === kind}
                                                title={hint}
                                                className={cn(
                                                    'flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs font-semibold transition-colors',
                                                    draft.kind === kind ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted'
                                                )}
                                            >
                                                <Icon className="size-4 shrink-0" /> {label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-border/60">
                            <CardHeader className="px-3 py-2 border-b border-border/60"><CardTitle className="text-sm">Sasaran</CardTitle></CardHeader>
                            <CardContent className="space-y-3 px-3 py-3">
                                <ScopeSummary
                                    selectedProductIds={selectedProductIds}
                                    selectedCategoryIds={selectedCategoryIds}
                                    onClear={onClearScope}
                                    hint="Pilih produk/kategori di panel kiri — sasaran diskon."
                                    emptyHint="Wajib pilih produk/kategori di panel kiri."
                                />
                            </CardContent>
                        </Card>

                        <Card className="border-border/60">
                            <CardHeader className="px-3 py-2 border-b border-border/60"><CardTitle className="text-sm">Penawaran</CardTitle></CardHeader>
                            <CardContent className="space-y-3 px-3 py-3">
                                {draft.kind === 'flat' && (
                                    <>
                                        <DiscountFields type={draft.discount_type} value={draft.discount_value} onChange={(p) => set(p)} />
                                        <p className="text-xs text-muted-foreground">Nominal Rp per Pcs satuan dasar (× qtyBase). Jika diizinkan grosir, berlaku retail & grosir.</p>
                                        <div className="space-y-2">
                                            <Label>Maksimal Diskon (Rp, 0 = tanpa batas)</Label>
                                            <Input type="number" min={0} value={draft.max_discount_amount ?? 0} onChange={(e) => set({ max_discount_amount: parseFloat(e.target.value) || 0 })} placeholder="0 = mengikuti jumlah transaksi" />
                                        </div>
                                    </>
                                )}

                                {draft.kind === 'bogo' && (
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
                                            <Label>Produk Gratis (opsional; kosong = produk yang sama)</Label>
                                            {draft.free_product_id && (
                                                <div className="flex flex-wrap gap-1.5">
                                                    <Badge variant="secondary" className="font-normal">{products.find(p=>p.id===draft.free_product_id)?.name || draft.free_product_id}</Badge>
                                                    <Button variant="ghost" size="sm" className="h-5 px-2 text-xs" onClick={()=>set({ free_product_id: '' })}>Hapus</Button>
                                                </div>
                                            )}
                                            <SearchDropdown
                                                value={bogoQuery}
                                                onChange={setBogoQuery}
                                                options={products.map(p=>({ id:p.id, label:p.name }))}
                                                onSelect={opt=>{ set({ free_product_id: opt.id }); setBogoQuery(''); }}
                                                placeholder="Cari produk gratis..."
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Maks Free Per Transaksi (0 = tanpa batas)</Label>
                                            <Input type="number" min={0} value={draft.max_total_free_qty ?? 0} onChange={(e) => set({ max_total_free_qty: parseFloat(e.target.value) || 0 })} />
                                        </div>
                                    </>
                                )}

                                {draft.kind === 'criteria' && (
                                    <>
                                        <div className="space-y-2">
                                            <Label>Hadiah Saat Syarat Terpenuhi</Label>
                                            {rewardChips(REWARD_META)}
                                            <p className="text-xs text-muted-foreground">Aktif saat SEMUA produk/kategori terpilih ada di keranjang.</p>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Syarat Jumlah Minimal Sasaran (Pcs, 0 = 1 produk)</Label>
                                            <Input type="number" min={0} value={draft.min_scope_qty ?? 0} onChange={(e) => set({ min_scope_qty: parseInt(e.target.value) || 0 })} placeholder="0 = minimal 1 produk sasaran ada" />
                                        </div>
                                        {reward === 'discount' && (
                                            <>
                                                <DiscountFields type={draft.discount_type} value={draft.discount_value} onChange={(p) => set(p)} />
                                                <p className="text-xs text-muted-foreground">Diskon diterapkan ke total transaksi.</p>
                                                <div className="space-y-2">
                                                    <Label>Maksimal Flat Diskon (Rp, 0 = tanpa batas)</Label>
                                                    <Input type="number" min={0} value={draft.max_flat_amount ?? 0} onChange={(e) => set({ max_flat_amount: parseFloat(e.target.value) || 0 })} />
                                                </div>
                                            </>
                                        )}
                                        {reward === 'bonus_product' && (
                                            <>
                                                <div className="space-y-2">
                                                    <Label>Produk Bonus</Label>
                                                    {draft.reward_product_ids?.[0] && (
                                                        <div className="flex flex-wrap gap-1.5">
                                                            <Badge variant="secondary" className="font-normal">{products.find(p=>p.id===draft.reward_product_ids![0])?.name || draft.reward_product_ids![0]}</Badge>
                                                            <Button variant="ghost" size="sm" className="h-5 px-2 text-xs" onClick={()=>set({ reward_product_ids: [] })}>Hapus</Button>
                                                        </div>
                                                    )}
                                                    <SearchDropdown
                                                        value={criteriaQuery}
                                                        onChange={setCriteriaQuery}
                                                        options={products.map(p=>({ id:p.id, label:p.name }))}
                                                        onSelect={opt=>{ set({ reward_product_ids: [opt.id] }); setCriteriaQuery(''); }}
                                                        placeholder="Cari produk bonus..."
                                                    />
                                                    <p className="text-xs text-muted-foreground">Bonus akan auto-ditambah ke cart 1 baris jika syarat terpenuhi.</p>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Maksimal Bonus Per Transaksi (0 = tanpa batas, beli x gratis x)</Label>
                                                    <Input type="number" min={0} value={draft.max_bonus_qty ?? 0} onChange={(e) => set({ max_bonus_qty: parseInt(e.target.value) || 0 })} placeholder="0 = tanpa batas" />
                                                </div>
                                            </>
                                        )}
                                    </>
                                )}

                                {draft.kind === 'conditional' && (
                                    <>
                                        <div className="space-y-2">
                                            <Label>Minimal Belanja (Rp)</Label>
                                            <Input type="number" min={0} value={draft.min_purchase ?? 0} onChange={(e) => set({ min_purchase: parseFloat(e.target.value) || 0 })} />
                                        </div>
                                        <div className="flex items-center justify-between rounded-lg border p-3">
                                            <div>
                                                <p className="text-sm font-medium">Wajib beli produk terpilih</p>
                                                <p className="text-xs text-muted-foreground">Diskon hanya aktif jika produk/kategori terpilih ada di keranjang.</p>
                                            </div>
                                            <Switch checked={draft.require_scope ?? true} onCheckedChange={(v) => set({ require_scope: v })} />
                                        </div>
                                        {(draft.require_scope ?? true) && (
                                            <div className="space-y-2">
                                                <Label>Syarat Jumlah Minimal Sasaran (Pcs, 0 = 1 produk)</Label>
                                                <Input type="number" min={0} value={draft.min_scope_qty ?? 0} onChange={(e) => set({ min_scope_qty: parseInt(e.target.value) || 0 })} />
                                            </div>
                                        )}
                                        <div className="space-y-2">
                                            <Label>Hadiah Saat Syarat Terpenuhi</Label>
                                            {rewardChips(REWARD_META)}
                                        </div>
                                        {reward === 'discount' && (
                                            <>
                                                <DiscountFields type={draft.discount_type} value={draft.discount_value} onChange={(p) => set(p)} />
                                                <p className="text-xs text-muted-foreground">Diskon diterapkan ke total transaksi.</p>
                                                <div className="space-y-2">
                                                    <Label>Maksimal Flat Diskon (Rp, 0 = tanpa batas)</Label>
                                                    <Input type="number" min={0} value={draft.max_flat_amount ?? 0} onChange={(e) => set({ max_flat_amount: parseFloat(e.target.value) || 0 })} />
                                                </div>
                                            </>
                                        )}
                                        {reward === 'bonus_product' && (
                                            <>
                                                <div className="space-y-2">
                                                    <Label>Produk Bonus (bisa lebih dari satu)</Label>
                                                    {(draft.reward_product_ids?.length || 0) > 0 && (
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {draft.reward_product_ids!.map(id=> {
                                                                const item = products.find(p=>p.id===id);
                                                                return <Badge key={id} variant="secondary" className="font-normal gap-1">{item?.name || id} <button type="button" onClick={()=>set({ reward_product_ids: draft.reward_product_ids!.filter(x=>x!==id) })} className="ml-1 rounded-full hover:bg-muted p-0.5"><X className="size-3" /></button></Badge>;
                                                            })}
                                                        </div>
                                                    )}
                                                    <SearchDropdown
                                                        value={conditionalQuery}
                                                        onChange={setConditionalQuery}
                                                        options={products.map(p=>({ id:p.id, label:p.name }))}
                                                        onSelect={opt=>{ const cur = draft.reward_product_ids || []; const next = cur.includes(opt.id) ? cur.filter(x=>x!==opt.id) : [...cur, opt.id]; set({ reward_product_ids: next }); setConditionalQuery(''); }}
                                                        placeholder="Cari produk bonus..."
                                                        multiple
                                                        selectedIds={draft.reward_product_ids || []}
                                                    />
                                                    <p className="text-xs text-muted-foreground">Bonus akan auto-ditambah 1 baris saat syarat terpenuhi.</p>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Maksimal Bonus Per Transaksi (0 = tanpa batas, beli x gratis x)</Label>
                                                    <Input type="number" min={0} value={draft.max_bonus_qty ?? 0} onChange={(e) => set({ max_bonus_qty: parseInt(e.target.value) || 0 })} />
                                                </div>
                                            </>
                                        )}
                                    </>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="border-border/60">
                            <CardHeader className="px-3 py-2 border-b border-border/60"><CardTitle className="text-sm">Jadwal</CardTitle></CardHeader>
                            <CardContent className="space-y-3 px-3 py-3">
                                <SchedulePicker
                                    value={{ starts_at: draft.starts_at, ends_at: draft.ends_at }}
                                    onChange={(patch) => set(patch)}
                                />
                            </CardContent>
                        </Card>

                        <Card className="border-border/60">
                            <CardHeader className="px-3 py-2 border-b border-border/60"><CardTitle className="text-sm">Status</CardTitle></CardHeader>
                            <CardContent className="space-y-3 px-3 py-3">
                                <div className="flex items-center justify-between rounded-lg border p-3">
                                    <div>
                                        <p className="text-sm font-medium">Aktif</p>
                                        <p className="text-xs text-muted-foreground">Diterapkan otomatis di kasir.</p>
                                    </div>
                                    <Switch checked={draft.is_active} onCheckedChange={(v) => set({ is_active: v })} />
                                </div>
                                <div className="flex items-center justify-between rounded-lg border p-3">
                                    <div>
                                        <p className="text-sm font-medium">Izinkan untuk Grosir</p>
                                        <p className="text-xs text-muted-foreground">Jika aktif, diskon dapat dipakai di transaksi grosir.</p>
                                    </div>
                                    <Switch checked={!!draft.allowWholesale} onCheckedChange={(v) => set({ allowWholesale: v })} />
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </ScrollArea>
            </div>

            <div className="p-4 mt-auto shrink-0 flex items-center gap-4">
                <Button variant="outline" className="flex-1" onClick={onCancel} disabled={isSaving}>Batal</Button>
                <Button className="flex-1" onClick={onSave} disabled={isSaving}>
                    {isSaving ? 'Menyimpan...' : 'Simpan'}
                </Button>
            </div>
        </div>
    );
}