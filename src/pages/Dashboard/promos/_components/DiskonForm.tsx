import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Power } from 'lucide-react';
import { MultiSelect, SingleSelect } from './SelectCombobox';
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
    const reward = draft.reward_type || 'discount';

    const handleKindChange = (kind: PromoKind) => {
        if (kind === draft.kind) return;
        const patch: Partial<Promotion> = { kind };
        if (kind === 'flat') patch.reward_type = 'discount';
        else if (kind === 'bogo') patch.reward_type = undefined;
        else if (kind === 'criteria') patch.reward_type = draft.reward_type && draft.reward_type !== 'discount_product' ? draft.reward_type : 'discount';
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
            <div className="shrink-0 border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold">{isNew ? 'Buat Diskon' : 'Ubah Diskon'}</h2>
                <p className="text-xs text-muted-foreground">Diterapkan otomatis di kasir.</p>
            </div>

            <div className="min-h-0 flex-1">
                <ScrollArea className="h-full">
                    <div className="space-y-5 p-4">
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

                        <ScopeSummary
                            selectedProductIds={selectedProductIds}
                            selectedCategoryIds={selectedCategoryIds}
                            onClear={onClearScope}
                            hint="Pilih produk/kategori di panel kiri — sasaran diskon."
                            emptyHint="Wajib pilih produk/kategori di panel kiri."
                        />

                        {draft.kind === 'flat' && (
                            <>
                                <DiscountFields type={draft.discount_type} value={draft.discount_value} onChange={(p) => set(p)} />
                                <p className="text-xs text-muted-foreground">Diskon diterapkan pada produk/kategori terpilih (paling menguntungkan per produk).</p>
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
                                    <SingleSelect items={products} value={draft.free_product_id || ''} onChange={(id) => set({ free_product_id: id })} placeholder="Produk yang sama dengan yang dibeli" />
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
                                {reward === 'discount' && (
                                    <>
                                        <DiscountFields type={draft.discount_type} value={draft.discount_value} onChange={(p) => set(p)} />
                                        <p className="text-xs text-muted-foreground">Diskon diterapkan ke total transaksi.</p>
                                    </>
                                )}
                                {reward === 'discount_product' && (
                                    <>
                                        <div className="space-y-2">
                                            <Label>Produk yang Didiskon</Label>
                                            <SingleSelect items={products} value={draft.reward_product_ids?.[0] || ''} onChange={(id) => set({ reward_product_ids: [id] })} placeholder="Pilih produk..." />
                                        </div>
                                        <DiscountFields type={draft.discount_type} value={draft.discount_value} onChange={(p) => set(p)} />
                                        <p className="text-xs text-muted-foreground">Diskon diterapkan ke produk tersebut saat sisanya dibeli.</p>
                                    </>
                                )}
                                {reward === 'bonus_product' && (
                                    <div className="space-y-2">
                                        <Label>Produk Bonus</Label>
                                        <SingleSelect items={products} value={draft.reward_product_ids?.[0] || ''} onChange={(id) => set({ reward_product_ids: [id] })} placeholder="Pilih produk..." />
                                        <p className="text-xs text-muted-foreground">1 unit gratis saat syarat terpenuhi (jika produknya ada di keranjang).</p>
                                    </div>
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
                                <div className="space-y-2">
                                    <Label>Hadiah Saat Syarat Terpenuhi</Label>
                                    {rewardChips(REWARD_META.filter(r => r.value !== 'discount_product'))}
                                </div>
                                {reward === 'discount' && (
                                    <>
                                        <DiscountFields type={draft.discount_type} value={draft.discount_value} onChange={(p) => set(p)} />
                                        <p className="text-xs text-muted-foreground">Diskon diterapkan ke total transaksi.</p>
                                    </>
                                )}
                                {reward === 'bonus_product' && (
                                    <div className="space-y-2">
                                        <Label>Produk Bonus (bisa lebih dari satu)</Label>
                                        <MultiSelect items={products} selected={draft.reward_product_ids || []} onChange={(ids) => set({ reward_product_ids: ids })} placeholder="Pilih produk bonus..." />
                                        <p className="text-xs text-muted-foreground">1 unit gratis per produk saat syarat terpenuhi.</p>
                                    </div>
                                )}
                            </>
                        )}

                        <SchedulePicker
                            value={{ starts_at: draft.starts_at, ends_at: draft.ends_at }}
                            onChange={(patch) => set(patch)}
                        />

                        <div className="flex items-center justify-between rounded-lg border p-3">
                            <div>
                                <p className="text-sm font-medium">Aktif</p>
                                <p className="text-xs text-muted-foreground">Diterapkan otomatis di kasir.</p>
                            </div>
                            <Switch checked={draft.is_active} onCheckedChange={(v) => set({ is_active: v })} />
                        </div>
                    </div>
                </ScrollArea>
            </div>

            <div className="flex shrink-0 gap-2 border-t border-border p-4">
                <Button variant="outline" className="flex-1" onClick={onCancel} disabled={isSaving}>Batal</Button>
                <Button className="flex-1" onClick={onSave} disabled={isSaving}>
                    <Power className="mr-2 h-4 w-4" /> {isSaving ? 'Menyimpan...' : 'Simpan'}
                </Button>
            </div>
        </div>
    );
}