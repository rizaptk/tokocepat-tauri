import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea, ScrollAreaHandle } from '@/components/ui/scroll-area';
import { ScrollShadow } from '@/components/ui/scrollshadow';
import { Zap } from 'lucide-react';
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
    const scrollRef = useRef<ScrollAreaHandle>(null);

    return (
        <div className="flex h-full flex-col min-h-0">
            <div className="shrink-0 border-b border-border/60 px-4 py-3">
                <h2 className="text-sm font-semibold">{isNew ? 'Buat Voucher' : 'Ubah Voucher'}</h2>
                <p className="text-xs text-muted-foreground">Kasir memasukkan kode untuk memakai diskon.</p>
            </div>

            <div className="flex-1 min-h-0 relative overflow-hidden">
                <ScrollShadow scrollRef={scrollRef} side="both" />
                <ScrollArea ref={scrollRef} className="px-1 h-full">
                    <div className="space-y-3 p-3">
                        <Card className="border-border/60">
                            <CardHeader className="px-3 py-2 border-b border-border/60"><CardTitle className="text-sm">Informasi Dasar</CardTitle></CardHeader>
                            <CardContent className="space-y-3 px-3 py-3">
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
                            </CardContent>
                        </Card>

                        <Card className="border-border/60">
                            <CardHeader className="px-3 py-2 border-b border-border/60"><CardTitle className="text-sm">Sasaran</CardTitle></CardHeader>
                            <CardContent className="space-y-3 px-3 py-3">
                                <ScopeSummary
                                    selectedProductIds={selectedProductIds}
                                    selectedCategoryIds={selectedCategoryIds}
                                    onClear={onClearScope}
                                    hint="Pilih produk/kategori di panel kiri untuk membatasi voucher."
                                    emptyHint="Berlaku untuk semua produk (opsional pilih di panel kiri)."
                                />
                            </CardContent>
                        </Card>

                        <Card className="border-border/60">
                            <CardHeader className="px-3 py-2 border-b border-border/60"><CardTitle className="text-sm">Penawaran</CardTitle></CardHeader>
                            <CardContent className="space-y-3 px-3 py-3">
                                <DiscountFields type={draft.discount_type} value={draft.discount_value} onChange={(p) => set(p)} />
                            </CardContent>
                        </Card>

                        <Card className="border-border/60">
                            <CardHeader className="px-3 py-2 border-b border-border/60"><CardTitle className="text-sm">Batas</CardTitle></CardHeader>
                            <CardContent className="space-y-3 px-3 py-3">
                                <div className="space-y-2">
                                    <Label>Minimal Belanja (0 = tanpa)</Label>
                                    <Input type="number" min={0} value={draft.min_purchase ?? 0} onChange={(e) => set({ min_purchase: parseFloat(e.target.value) || 0 })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Batas Pemakaian (0 = tanpa batas)</Label>
                                    <Input type="number" min={0} value={draft.max_uses ?? 0} onChange={(e) => set({ max_uses: parseFloat(e.target.value) || 0 })} />
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-border/60">
                            <CardHeader className="px-3 py-2 border-b border-border/60"><CardTitle className="text-sm">Jadwal</CardTitle></CardHeader>
                            <CardContent className="space-y-3 px-3 py-3">
                                <SchedulePicker
                                    label="Masa Berlaku"
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
                                        <p className="text-xs text-muted-foreground">Kode dapat dipakai di kasir.</p>
                                    </div>
                                    <Switch checked={draft.is_active} onCheckedChange={(v) => set({ is_active: v })} />
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