import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Power, Zap } from 'lucide-react';
import { DiscountFields } from './DiscountFields';
import { SchedulePicker } from './SchedulePicker';
import { ScopeSummary } from './ScopeSummary';
import { generateUniqueVoucherCode } from '@/lib/promo-model';
import { Promotion } from '@/lib/types';

export interface VoucherFormProps {
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
    existingCodes: string[];
}

export function VoucherForm({ draft, isNew, onChange, onCancel, onSave, isSaving, selectedProductIds, selectedCategoryIds, onClearScope, existingCodes }: VoucherFormProps) {
    const set = (patch: Partial<Promotion>) => onChange({ ...draft, ...patch });

    return (
        <div className="flex h-full flex-col min-h-0">
            <div className="shrink-0 border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold">{isNew ? 'Buat Voucher' : 'Ubah Voucher'}</h2>
                <p className="text-xs text-muted-foreground">Kasir memasukkan kode untuk memakai diskon.</p>
            </div>

            <div className="min-h-0 flex-1">
                <ScrollArea className="h-full">
                    <div className="space-y-5 p-4">
                        <div className="space-y-2">
                            <Label>Nama Voucher</Label>
                            <Input value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="Mis. Diskon Pelanggan Baru" />
                        </div>

                        <div className="space-y-2">
                            <Label>Kode Voucher</Label>
                            <div className="flex gap-2">
                                <Input
                                    value={draft.code || ''}
                                    onChange={(e) => set({ code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20) })}
                                    placeholder="HEMAT10"
                                    className="font-mono uppercase"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="shrink-0 border-primary/50 bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary"
                                    onClick={() => set({ code: generateUniqueVoucherCode(existingCodes) })}
                                >
                                    <Zap className="h-3.5 w-3.5" /> Acak
                                </Button>
                            </div>
                        </div>

                        <ScopeSummary
                            selectedProductIds={selectedProductIds}
                            selectedCategoryIds={selectedCategoryIds}
                            onClear={onClearScope}
                            hint="Pilih produk/kategori di panel kiri untuk membatasi voucher."
                            emptyHint="Berlaku untuk semua produk (opsional pilih di panel kiri)."
                        />

                        <DiscountFields type={draft.discount_type} value={draft.discount_value} onChange={(p) => set(p)} />

                        <div className="space-y-2">
                            <Label>Minimal Belanja (0 = tanpa)</Label>
                            <Input type="number" min={0} value={draft.min_purchase ?? 0} onChange={(e) => set({ min_purchase: parseFloat(e.target.value) || 0 })} />
                        </div>

                        <div className="space-y-2">
                            <Label>Batas Pemakaian (0 = tanpa batas)</Label>
                            <Input type="number" min={0} value={draft.max_uses ?? 0} onChange={(e) => set({ max_uses: parseFloat(e.target.value) || 0 })} />
                        </div>

                        <SchedulePicker
                            label="Masa Berlaku"
                            value={{ starts_at: draft.starts_at, ends_at: draft.ends_at }}
                            onChange={(patch) => set(patch)}
                        />

                        <div className="flex items-center justify-between rounded-lg border p-3">
                            <div>
                                <p className="text-sm font-medium">Aktif</p>
                                <p className="text-xs text-muted-foreground">Kode dapat dipakai di kasir.</p>
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