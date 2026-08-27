import { useState, useMemo, useEffect, memo, useRef, useTransition } from "react";
import { useStore } from "@/lib/store";
import { Product, StockMovementType, Category, ProductVariant, StockMovement } from "@/lib/types";
import { adjustStock, adjustVariantStock, getStockMovementsByProducts } from "@/services/stockService";
import { normalizeProductUoms } from "@/lib/uom";
import { useToast } from "@/hooks/use-toast";
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { ScrollArea, ScrollAreaHandle } from "@/components/ui/scroll-area";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ProductSearchBar, type ProductSearchBarHandle } from "@/components/ProductSearchBar";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PlusCircle, Plus, Minus, Calculator, Package, WarehouseIcon, History, ArrowUp, ArrowDown, ArrowRight, Zap, ClipboardList, RotateCcw, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useGlobalBarcodeScanner } from "@/hooks/use-global-barcode-scanner";
import { cn, reasonMapping, typeConfig } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useProductSearch } from "@/lib/useProductSearch";
import { ButtonGroup } from "@/components/ui/button-group";
import { ScrollShadow } from "@/components/ui/scrollshadow";
import { useOverlayScrollbar } from "@/hooks/useScrollOverlay";
import { Link } from "react-router-dom";
import { TokoCepatLogo } from "@/components/TokoCepatLogo";
import { NotificationBell } from "@/components/NotificationBell";
import { ThemeToggle } from "@/components/ThemeButtons";
import { itemMapping } from "@/lib/utils"; 
import { useSettingsStore } from "@/lib/settings";
import { motion, AnimatePresence } from "framer-motion";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ProductForm } from "@/pages/Product/_components/ProductForm"; 


const reasonOptions: Record<'add' | 'remove' | 'count', { id: string, value: StockMovementType, label: string }[]> = {
    add: [
        { id: 'add-restock', value: 'restock', label: 'Stok Masuk / Restok' },
        { id: 'add-initial', value: 'initial_balance', label: 'Saldo Awal' },
        { id: 'add-return', value: 'correction', label: 'Retur Pelanggan' },
        { id: 'add-other', value: 'correction', label: 'Lainnya' }
    ],
    remove: [
        { id: 'remove-damaged', value: 'damaged', label: 'Barang Rusak' },
        { id: 'remove-lost', value: 'lost', label: 'Barang Hilang' },
        { id: 'remove-internal', value: 'correction', label: 'Pemakaian Internal' },
        { id: 'remove-consignor-return', value: 'correction', label: 'Retur Konsinyasi' },
        { id: 'remove-other', value: 'correction', label: 'Lainnya' }
    ],
    count: [
        { id: 'count-correction', value: 'correction', label: 'Koreksi Stok Opname' },
        { id: 'count-consignor', value: 'correction', label: 'Koreksi Retur Konsinyasi' },
        { id: 'count-audit', value: 'correction', label: 'Audit Akhir Bulan' },
        { id: 'count-other', value: 'correction', label: 'Lainnya' }
    ]
};

// Remembers the last reason picked per mode so rapid entry doesn't re-pick it each time.
const lastReasonByMode: Record<'add' | 'remove' | 'count', string> = {
    add: 'add-restock',
    remove: 'remove-damaged',
    count: 'count-correction',
};

type InventoryItemType = (Product & { itemType: 'product', stock: number }) 
    | (ProductVariant & { itemType: 'variant', stock: number, parentName: string });


const StockHistoryCards = memo(({selectedItem}: {selectedItem: { id: string, type: 'product' | 'variant' }[]}) => {
    const { products, productVariants } = useStore();
    const [histories, setHistory] = useState<StockMovement[]>([]);
    const [loading, setTransition] = useTransition();

    // const ids = useMemo(() => selectedItem.map(item => item.id), [selectedItem]);
    const ids = useMemo(() => 
        selectedItem.map(item => item.id).join(','), // Ubah jadi string untuk perbandingan primitif
        [selectedItem]
    );

    // const histories = use(getStockMovementsByProducts(ids));
    useEffect(() => {
        if (ids.length === 0) {
            setHistory([]);
            return;
        }
        
        const idArray = ids.split(',');
        
        setTransition(() => {
            getStockMovementsByProducts(idArray).then((result) => {
                setHistory(result);
            });
        });

        return () => {
            setHistory([]);
        };
    }, [ids]);

    const mapedByIds = useMemo(() => {
        const map: Record<string, StockMovement[]> = {};
        histories.forEach(h => {
            if (!map[h.product_id]) {
                map[h.product_id] = [];
            }
            map[h.product_id].push(h);
        });
        return Object.values(map);
    }, [histories]);
    
    if (histories.length === 0 || loading) return null;

    return (
        <div className="space-y-4">
            <h4 className="font-medium px-1 flex items-center gap-2">
                <History className="size-4" />
                Riwayat Stok
            </h4>
            {mapedByIds.map((group) => {
                const firstHistory = group[0];
                const item = [...products, ...productVariants].find(i => i.id === firstHistory.product_id);
                const over50 = group.length >= 50;
                return (
                    <Card key={firstHistory.product_id} className="overflow-hidden border-border/60">
                        <CardHeader className="px-3 py-2 border-b border-border/60 flex flex-row justify-between items-center">
                            <CardTitle className="text-sm font-bold">{item?.name || 'Unknown Item'} {group.length > 1 && <Badge variant="success" className="ms-2 py-0.5 px-2 leading-none font-mono">{` ${group.length} ${over50 ? '+' : ''}`}</Badge>}</CardTitle>
                            <Button variant="ghost" size="sm">
                                <Link to="/dashboard/reports/stock-movement" className="flex items-center gap-2">
                                    Laporan <ArrowRight />
                                </Link>
                            </Button>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-border/50">
                                {group.map((history) => {
                                    const date = new Date(history.created_at).toLocaleString();
                                    const mapped = reasonMapping.get(history.type);
                                    const hisType = (mapped??history.type).toUpperCase();
                                    const isPositive = history.qty_change > 0;
                                    return (
                                        <div key={history.id} className={cn("px-4 py-3 text-sm hover:bg-muted/30 transition-colors flex gap-3 items-start")}>
                                            <div className={cn(
                                                "mt-1 p-1.5 rounded-full shrink-0",
                                                isPositive ? "bg-success/30 text-success-foreground" : "bg-destructive/15 text-destructive"
                                            )}>
                                                {isPositive ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start mb-0.5">
                                                    <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-bold">
                                                        {hisType} {history.uom_name ? `· ${history.uom_name}` : ''}
                                                    </span>
                                                    <div className={cn("font-bold text-sm tabular-nums", isPositive ? "text-success dark:text-success-foreground" : "text-destructive")}>
                                                        <span>{isPositive ? `+${history.qty_change}` : history.qty_change}</span>
                                                        {history.uom_name && history.qty_change_uom != null && history.uom_factor !== 1 && (
                                                            <span className="ml-1 text-xs font-normal">({history.qty_change_uom > 0 ? `+${history.qty_change_uom}` : history.qty_change_uom} {history.uom_name})</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex justify-between items-end gap-2 truncate">
                                                    <span className="text-xs text-foreground/80 italic truncate flex-1">
                                                        {hisType === 'SALE' ? `Ref: ${history.reference_id}` : (history.reason || 'Tanpa keterangan')}
                                                    </span>
                                                    <span className="text-[11px] text-muted-foreground shrink-0">
                                                        {date}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    )
})

export type AdjustmentResult = { itemId: string; itemType: 'product' | 'variant'; change: number; name: string };

const StockAdjustmentPanel = memo(({ selectedItem, onSave, onCancel, rapidMode, lastAdjustment, onUndo, physicalCounts, onPhysicalCountChange }: {
    selectedItem: { id: string, type: 'product' | 'variant' } | null;
    onSave: (adjustment?: AdjustmentResult) => void;
    onCancel: () => void;
    rapidMode?: boolean;
    lastAdjustment?: AdjustmentResult | null;
    onUndo?: () => void;
    physicalCounts?: Record<string, string>;
    onPhysicalCountChange?: (itemId: string, value: string) => void;
}) => {
    const [mode, setMode] = useState<'add' | 'remove' | 'count' | null>(rapidMode ? 'count' : null);
    const [quantity, setQuantity] = useState('');
    const [actualCount, setActualCount] = useState('');
    const [reason, setReason] = useState(rapidMode ? lastReasonByMode.count : '');
    const [note, setNote] = useState('');
    const [selectedUomId, setSelectedUomId] = useState<string | null>(null);

    const { products, productVariants } = useStore();
    const { toast } = useToast();

    const scrollRef = useRef<ScrollAreaHandle>(null);
    const countInputRef = useRef<HTMLInputElement>(null);

    const item = useMemo((): InventoryItemType | null => {
        if (!selectedItem) return null;

        if (selectedItem.type === 'product') {
            const product = products.find(p => p.id === selectedItem.id);
            return product ? { ...product, itemType: 'product', stock: product.stock } : null;
        } else { // variant
            const variant = productVariants.find(v => v.id === selectedItem.id);
            if (!variant) return null;
            const parent = products.find(p => p.id === variant.product_id);
            return { ...variant, itemType: 'variant', stock: variant.stock, parentName: parent?.name || 'Unknown' };
        }
    }, [selectedItem, products, productVariants]);

    const productForUom: Product | null = useMemo(() => {
        if (!item) return null;
        if (item.itemType === 'product') return item as unknown as Product;
        return products.find(p => p.id === (item as ProductVariant).product_id) || null;
    }, [item, products]);
    const normUoms = useMemo(() => productForUom ? normalizeProductUoms(productForUom).uoms! : [], [productForUom]);
    const selectedUom = useMemo(() => normUoms.find(u => u.id === selectedUomId) || normUoms.find(u => u.isBase) || normUoms[0], [normUoms, selectedUomId]);
    const uomFactor = selectedUom?.factor || 1;
    const uomName = selectedUom?.name || productForUom?.baseUom || 'Pcs';

    // Reset form state when product changes. Pre-fill the physical count from the
    // shared record so values persist across Mode Cepat / normal / Worksheet.
    useEffect(() => {
        if (selectedItem) {
            setMode(rapidMode ? 'count' : null);
            setQuantity('');
            setActualCount(physicalCounts?.[selectedItem.id] ?? '');
            setReason(rapidMode ? lastReasonByMode.count : '');
            setNote('');
            setSelectedUomId(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedItem]);

    // In rapid mode, focus the physical-count input when the item changes so the
    // operator can type the count immediately after scanning/picking an item.
    useEffect(() => {
        if (rapidMode && selectedItem && mode === 'count') {
            const t = requestAnimationFrame(() => countInputRef.current?.focus());
            return () => cancelAnimationFrame(t);
        }
    }, [rapidMode, selectedItem, mode]);

    // Calculate change and new stock for the preview — UOM-aware (qty in selected UOM → base Pcs)
    const { change, newStock, isFormValid } = useMemo(() => {
        if (!item || !mode) return { change: 0, newStock: 0, isFormValid: false };

        const currentStock = item.stock;
        let changeVal = 0;
        let formIsValid = false;

        if (mode === 'add' || mode === 'remove') {
            const qty = parseFloat(quantity);
            if (!isNaN(qty) && qty > 0) {
                const base = Math.round(qty * uomFactor);
                changeVal = mode === 'add' ? base : -base;
                formIsValid = !!reason;
            }
        } else if (mode === 'count') {
            const count = parseFloat(actualCount);
            if (!isNaN(count)) {
                const baseCount = Math.round(count * uomFactor);
                changeVal = baseCount - currentStock;
                // Form is valid if reason is selected, OR if there's no change (no action needed).
                formIsValid = changeVal !== 0 ? !!reason : true;
            }
        }

        return {
            change: changeVal,
            newStock: currentStock + changeVal,
            isFormValid: formIsValid
        };
    }, [mode, quantity, actualCount, reason, item, uomFactor]);

    const handleSubmit = async () => {
        if (!isFormValid || !item || !mode) {
            toast({ variant: 'destructive', title: 'Tidak Valid', description: 'Mohon lengkapi formulir dengan alasan dan jumlah yang benar.' });
            return;
        }

        if (change === 0) {
            toast({ title: "Tidak Ada Perubahan", description: "Jumlah fisik sesuai dengan stok sistem. Penyesuaian tidak diperlukan." });
            onSave();
            return;
        }

        try {
            const selectedOption = reasonOptions[mode].find(opt => opt.id === reason);
            if (!selectedOption) {
                toast({ variant: 'destructive', title: 'Alasan Tidak Valid', description: 'Silakan pilih alasan yang valid.' });
                return;
            }

            const adjustmentReason = note ? `${selectedOption.label}: ${note}` : selectedOption.label;

            const qtyChangeUom = mode === 'count' ? (change / uomFactor) : (parseFloat(quantity) || 0) * (mode === 'remove' ? -1 : 1);
            if (item.itemType === 'product') {
                await adjustStock({
                    product_id: item.id,
                    type: selectedOption.value,
                    qty_change: change,
                    reason: adjustmentReason,
                    qty_change_uom: qtyChangeUom,
                    uom_id: selectedUom?.id,
                    uom_name: uomName,
                    uom_factor: uomFactor,
                });
            } else if (item.itemType === 'variant') {
                await adjustVariantStock(item.id, selectedOption.value, change, adjustmentReason, {
                    qty_change_uom: qtyChangeUom,
                    uom_id: selectedUom?.id,
                    uom_name: uomName,
                    uom_factor: uomFactor,
                });
            }

            // Remember the chosen reason so the next item can default to it.
            if (mode) lastReasonByMode[mode] = reason;

            toast({ title: 'Stok Berhasil Diperbarui', description: `Stok ${item.name} telah diperbarui menjadi ${newStock}.` });

            // Reset the form, keeping the item selected (selection lifecycle is
            // handled by the parent: normal mode keeps it, rapid mode advances).
            setQuantity('');
            setActualCount('');
            setNote('');
            setMode(rapidMode ? 'count' : null);
            setReason(rapidMode ? lastReasonByMode.count : '');
            // Clear the shared physical-count record so the worksheet doesn't re-apply it.
            onPhysicalCountChange?.(item.id, '');
            onSave({ itemId: item.id, itemType: item.itemType, change, name: item.name });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        }
    };

    const { icon: ItemIcon, badge: badgeVariant } = typeConfig[selectedItem?.type|| 'product'];

    return (
        <div
            className="flex flex-col h-full min-h-0"
            tabIndex={-1}
            onKeyDown={(e) => {
                if (rapidMode || mode === null) return;
                const t = e.target as HTMLElement;
                if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable) return;
                if (e.key === '+') { e.preventDefault(); setMode('add'); }
                else if (e.key === '-') { e.preventDefault(); setMode('remove'); }
            }}
        >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
                <h3 className="text-sm font-semibold">Penyesuaian Stok</h3>
                <WarehouseIcon className="size-4" />
            </div>
            <div className="flex-1 min-h-0 flex flex-col relative">
                <ScrollShadow scrollRef={scrollRef} side="both" />
                <ScrollArea ref={scrollRef} className="flex-1 min-h-0 [&>[data-radix-scroll-area-viewport]>div]:block! [&>[data-radix-scroll-area-viewport]>div]:h-full!">
                    <div className="p-3 space-y-3 h-full">
                        {!item ? (
                            <Card className="h-full border-border/60">
                                <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-full p-8">
                                    <Package className="w-12 h-12 mb-4" />
                                    <p>Tidak ada item dipilih</p>
                                </div>
                            </Card>
                        ) : (
                            <>
                                <Card className="border-border/60">
                                    <CardHeader className="px-3 py-2 border-b border-border/60">
                                        <CardTitle className="text-sm">{item.itemType === 'variant' ? `${item.parentName} (${item.name})` : item.name}</CardTitle>
                                        <div className="flex justify-between items-center">
                                            <CardDescription>Stok Tersedia: <span className="font-bold text-foreground">{item.stock}</span></CardDescription>
                                            <Badge variant={badgeVariant as any} className="border border-border capitalize">
                                                <ItemIcon className="h-3 w-3 mr-1.5" />
                                                {itemMapping.get(item.itemType)}
                                            </Badge>
                                        </div>
                                        {rapidMode && (item.itemType === 'product' ? (item as Product).barcode : (item as ProductVariant).sku) && (
                                            <p className="font-mono text-[11px] text-muted-foreground truncate">
                                                Barcode: {(item.itemType === 'product' ? (item as Product).barcode : (item as ProductVariant).sku)}
                                            </p>
                                        )}
                                    </CardHeader>
                                    <CardContent className="space-y-3 px-3 py-3">

                                        {!rapidMode && (
                                            <div>
                                                <Label>Aksi?</Label>
                                                <ButtonGroup className="w-full mt-2">
                                                    <Button variant={mode === 'add' ? 'success' : 'outline'} aria-pressed={mode === 'add'} onClick={() => setMode('add')} className="flex-1 h-10">
                                                        <Plus className="w-4 h-4" />
                                                        <span className="text-xs">Tambah</span>
                                                    </Button>
                                                    <Button variant={mode === 'remove' ? 'destructive' : 'outline'} aria-pressed={mode === 'remove'} onClick={() => setMode('remove')} className="flex-1 h-10">
                                                        <Minus className="w-4 h-4" />
                                                        <span className="text-xs">Kurang</span>
                                                    </Button>
                                                    <Button variant={mode === 'count' ? 'default' : 'outline'} aria-pressed={mode === 'count'} onClick={() => setMode('count')} className="flex-1 h-10">
                                                        <Calculator className="w-4 h-4" />
                                                        <span className="text-xs">Koreksi</span>
                                                    </Button>
                                                </ButtonGroup>
                                            </div>
                                        )}

                                        {mode && (
                                            <div className="space-y-3 pt-2">
                                                {mode === 'add' || mode === 'remove' ? (
                                                    <div className="grid grid-cols-3 gap-3">
                                                        <div className="space-y-2">
                                                            <Label htmlFor="quantity">Jumlah</Label>
                                                            <Input id="quantity" type="number" placeholder="Angka" value={quantity} onChange={(e) => setQuantity(e.target.value)} min="1" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); } }} />
                                                        </div>
                                                        {normUoms.length > 1 ? (
                                                            <div className="space-y-2">
                                                                <Label>Satuan</Label>
                                                                <Select value={selectedUom?.id} onValueChange={setSelectedUomId}>
                                                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                                                    <SelectContent>{normUoms.map(u => <SelectItem key={u.id} value={u.id}>{u.name} ×{u.factor}</SelectItem>)}</SelectContent>
                                                                </Select>
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-2">
                                                                <Label>Satuan</Label>
                                                                <div className="h-9 flex items-center px-3 border rounded-md bg-muted text-sm">{uomName}</div>
                                                            </div>
                                                        )}
                                                        <div className="space-y-2">
                                                            <Label htmlFor="reason-select">Alasan</Label>
                                                            <Select value={reason} onValueChange={setReason}>
                                                                <SelectTrigger><SelectValue placeholder="Pilih" /></SelectTrigger>
                                                                <SelectContent>
                                                                    {reasonOptions[mode].map(opt => <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>)}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="grid grid-cols-3 gap-3">
                                                        <div className="space-y-2">
                                                            <Label htmlFor="actual-count">Stok Rill (Fisik)</Label>
                                                            <Input ref={countInputRef} id="actual-count" type="number" placeholder="cth. 142" value={actualCount} onChange={(e) => { setActualCount(e.target.value); onPhysicalCountChange?.(item?.id ?? '', e.target.value); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); } }} />
                                                        </div>
                                                        {normUoms.length > 1 ? (
                                                            <div className="space-y-2">
                                                                <Label>Satuan</Label>
                                                                <Select value={selectedUom?.id} onValueChange={setSelectedUomId}>
                                                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                                                    <SelectContent>{normUoms.map(u => <SelectItem key={u.id} value={u.id}>{u.name} ×{u.factor}</SelectItem>)}</SelectContent>
                                                                </Select>
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-2">
                                                                <Label>Satuan</Label>
                                                                <div className="h-9 flex items-center px-3 border rounded-md bg-muted text-sm">{uomName}</div>
                                                            </div>
                                                        )}
                                                        {change !== 0 && (
                                                            <div className="space-y-2">
                                                                <Label htmlFor="reason-count">Alasan Selisih</Label>
                                                                <Select value={reason} onValueChange={setReason}>
                                                                    <SelectTrigger><SelectValue placeholder="Pilih Alasan" /></SelectTrigger>
                                                                    <SelectContent>
                                                                        {reasonOptions.count.map(opt => <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>)}
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                <div className="space-y-2">
                                                    <Label htmlFor="note">Catatan (Optional)</Label>
                                                    <Textarea id="note" placeholder="cth, 'Box telah terbuka'" value={note} onChange={e => setNote(e.target.value)} />
                                                </div>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>

                                {mode && change !== 0 && (
                                    <Card className="border-border/60">
                                        <CardHeader className="px-3 py-2 border-b border-border/60">
                                            <CardTitle className="text-sm">Ringkasan</CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-3 px-3 py-3 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Stok Lama</span>
                                                <span>{item.stock}</span>
                                            </div>
                                            <div className={cn("flex justify-between font-semibold", change > 0 ? "text-success dark:text-success-foreground" : "text-destructive")}>
                                                <span className="text-muted-foreground">Perubahan</span>
                                                <span>{change > 0 ? `+${change}` : change}</span>
                                            </div>
                                            <Separator />
                                            <div className="flex justify-between font-bold text-lg">
                                                <span>Stok Baru</span>
                                                <span>{newStock}</span>
                                            </div>
                                            {newStock < 0 && (
                                                <p className="text-xs text-center pt-2 text-destructive font-semibold">⚠ Peringatan: Stok akan negatif.</p>
                                            )}
                                        </CardContent>
                                    </Card>
                                )}

                                {selectedItem && (
                                    <StockHistoryCards selectedItem={[selectedItem]} />
                                )}
                            </>
                        )}
                    </div>
                </ScrollArea>
            </div>

            <div className="p-4 mt-auto shrink-0 flex items-center gap-4">
                {
                    item && !rapidMode &&
                    <Button variant="outline" className="flex-1" onClick={onCancel}>
                        Batal
                    </Button>
                }
                {lastAdjustment && onUndo && (
                    <Button variant="outline" className="flex-1" onClick={onUndo} title="Batalkan penyesuaian terakhir">
                        <RotateCcw className="w-4 h-4 mr-1.5" />
                        Undo Terakhir
                    </Button>
                )}
                <Button className="flex-1" onClick={handleSubmit} disabled={!isFormValid || !item || (mode === 'count' && change === 0)}>
                    {rapidMode ? 'Simpan & Lanjut' : 'Simpan'}
                </Button>
            </div>
        </div>
    );
})


const ColumnClass = {
    name: "flex items-center gap-2 flex-1 min-w-0 h-full",
    brand: "hidden sm:flex items-center text-sm text-muted-foreground truncate max-w-[150px] w-[150px] px-2 border-l border-l-border/50 h-full",
    category: "hidden md:flex items-center text-sm text-muted-foreground truncate max-w-[160px] w-[160px] px-2 border-l border-l-border/50 h-full",
    stock: "flex flex-col items-end justify-center shrink-0 text-right tabular-nums whitespace-nowrap w-24 border-l border-l-border/50 h-full px-2"
}

const InventoryListItem = ({ item, isSelected, onItemClick, onShowDetail, categories }: { item: InventoryItemType; isSelected: boolean; onItemClick: (item: InventoryItemType) => void; onShowDetail: (item: InventoryItemType) => void; categories: Category[]}) => {
    
    let categoryName = 'N/A';
    if (item.itemType === 'product') {
        categoryName = categories.find(c => c.id === item.category_id)?.name || 'N/A';
    } else if (item.itemType === 'variant') {
        const parent = useStore.getState().products.find(p => p.id === item.product_id);
        categoryName = parent ? categories.find(c => c.id === parent.category_id)?.name || 'N/A' : 'N/A';
    }

    let brand = '';
    if (item.itemType === 'product') {
        brand = (item as Product).brand || '';
    } else {
        const parent = useStore.getState().products.find(p => p.id === (item as ProductVariant).product_id);
        brand = parent?.brand || '';
    }

    let displayName = item.name;
    if (item.itemType === 'variant') {
        displayName = `${item.parentName} (${item.name})`;
    }

    const isConsignment = item.itemType === 'product' && (item as Product).is_consignment;
    const consignorName = item.itemType === 'product' && (item as Product).consignor_name;
    const commissionType = item.itemType === 'product' && (item as Product).consignment_commission_type;
    const commissionValue = item.itemType === 'product' && (item as Product).consignment_commission_value;
    const formattedCommission = isConsignment && commissionValue !== undefined
        ? (commissionType === 'flat' 
            ? `Rp ${commissionValue.toLocaleString('id-ID')}` 
            : `${commissionValue}%`)
        : '';

    return (
        <div className="bg-card border-x border-b border-b-border/50 p-0 h-9">
            <div
                data-item
                onClick={() => onItemClick(item)}
                onDoubleClick={() => onShowDetail(item)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onItemClick(item); } }}
                role="button"
                tabIndex={0}
                className={cn(
                    "group flex items-center px-4 transition-colors cursor-pointer  hover:bg-accent h-9 focus:outline-none focus-visible:bg-accent",
                    isSelected ? "bg-primary/10 text-primary ring-1 ring-inset ring-primary" : ''
                )}
            >
                <div className={ColumnClass.name}>
                    <p className="text-sm font-normal truncate">{displayName}</p>
                    {isConsignment && (
                        <span className="text-[10px] text-warning dark:text-warning-foreground font-semibold truncate">
                            Konsinyasi: {consignorName} ({formattedCommission})
                        </span>
                    )}
                </div>
                <div className={ColumnClass.brand}>
                    <span className={cn("truncate", !brand && "text-muted-foreground/40")}>{brand || '—'}</span>
                </div>
                <div className={ColumnClass.category}>
                    <span className="truncate">{categoryName}</span>
                </div>
                <div className={ColumnClass.stock} title="Klik untuk menyesuaikan stok">
                    <p className="font-bold text-sm group-hover:text-primary transition-colors">{item.stock}</p>
                </div>
            </div>
        </div>
    );
}


function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <Button
            variant="ghost"
            size="sm"
            className={cn(
                "rounded-md px-2.5 h-7 shrink-0 text-xs",
                active ? "bg-background text-foreground ring-1 ring-inset ring-border" : "text-muted-foreground hover:text-foreground"
            )}
            aria-pressed={active}
            onClick={onClick}
        >
            {children}
        </Button>
    );
}

const WorksheetColumnClass = {
    no: "flex items-center justify-center shrink-0 w-10 text-xs text-muted-foreground",
    name: "flex items-center gap-2 flex-1 min-w-0",
    brand: "hidden sm:flex items-center text-sm text-muted-foreground truncate w-28 shrink-0 px-2 border-l border-l-border/50",
    category: "hidden md:flex items-center text-sm text-muted-foreground truncate w-28 shrink-0 px-2 border-l border-l-border/50",
    systemStock: "flex items-center justify-end shrink-0 text-right tabular-nums w-20 border-l border-l-border/50 px-2",
    physicalStock: "flex items-center justify-center shrink-0 w-44 border-l border-l-border/50 px-2",
    reason: "flex items-center justify-center shrink-0 w-44 border-l border-l-border/50 px-2",
    notes: "flex items-center justify-center shrink-0 w-40 border-l border-l-border/50 px-2",
    diff: "flex items-center justify-end shrink-0 text-right tabular-nums font-semibold w-16 border-l border-l-border/50 px-2",
};

type WorksheetRowData = {
    items: InventoryItemType[];
    categories: Category[];
    products: Product[];
    physicalCounts: Record<string, string>;
    rowReasons: Record<string, string>;
    rowNotes: Record<string, string>;
    rowUoms: Record<string, string>;
    defaultReason: string;
    focusedId: string | null;
    onChange: (itemId: string, value: string) => void;
    onReasonChange: (itemId: string, value: string) => void;
    onNotesChange: (itemId: string, value: string) => void;
    onUomChange: (itemId: string, value: string) => void;
    onFocus: (itemId: string | null) => void;
};

// Stable row component (react-window render prop) so the Stok Fisik input keeps
// focus across keystrokes — an inline row function would remount rows each render.
const WorksheetRow = memo(({ index, style, data }: { index: number; style: React.CSSProperties; data: WorksheetRowData }) => {
    const { items, categories, products, physicalCounts, rowReasons, rowNotes, rowUoms, defaultReason, focusedId, onChange, onReasonChange, onNotesChange, onUomChange, onFocus } = data;
    const item = items[index];
    const raw = physicalCounts[item.id] ?? '';
    const physicalUom = raw.trim() === '' ? NaN : parseFloat(raw);
    const hasInput = raw.trim() !== '' && !isNaN(physicalUom);
    const productForUom: Product | null = item.itemType === 'product' ? (item as unknown as Product) : products.find(p => p.id === (item as ProductVariant).product_id) || null;
    const normUoms = productForUom ? normalizeProductUoms(productForUom).uoms! : [];
    const selectedUomId = rowUoms[item.id] || normUoms.find(u => u.isBase)?.id || normUoms[0]?.id;
    const selectedUom = normUoms.find(u => u.id === selectedUomId) || normUoms.find(u => u.isBase) || normUoms[0];
    const factor = selectedUom?.factor || 1;
    const physicalBase = hasInput ? Math.round(physicalUom * factor) : NaN;
    const diff = hasInput ? physicalBase - item.stock : null;
    const invalid = raw.trim() !== '' && (isNaN(physicalUom) || physicalUom < 0);
    const isFocused = focusedId === item.id;
    const rowReason = rowReasons[item.id] ?? defaultReason;

    const itemLabel = item.itemType === 'variant' ? `${item.parentName} (${item.name})` : item.name;

    let categoryName = 'N/A';
    let brand = '';
    if (item.itemType === 'product') {
        categoryName = categories.find(c => c.id === item.category_id)?.name || 'N/A';
        brand = (item as Product).brand || '';
    } else {
        const parent = products.find(p => p.id === (item as ProductVariant).product_id);
        if (parent) {
            categoryName = categories.find(c => c.id === parent.category_id)?.name || 'N/A';
            brand = parent.brand || '';
        }
    }

    return (
        <div style={style} className="px-4 pb-1">
            <div
                className={cn(
                    "group flex items-center h-9 border border-border/50 rounded-md bg-card px-2 transition-colors",
                    isFocused ? "border-primary/60 ring-1 ring-inset ring-primary/30" : "hover:border-border",
                    invalid && "border-destructive/60"
                )}
            >
                <span className={WorksheetColumnClass.no}>{index + 1}</span>
                <span className={WorksheetColumnClass.name}>
                    <span className="text-sm font-normal truncate">{itemLabel}</span>
                </span>
                <span className={WorksheetColumnClass.brand}>
                    <span className="truncate">{brand || '—'}</span>
                </span>
                <span className={WorksheetColumnClass.category}>
                    <span className="truncate">{categoryName}</span>
                </span>
                <span className={WorksheetColumnClass.systemStock}>
                    <span className="font-bold text-sm tabular-nums">{item.stock}</span>
                </span>
                <span className={cn(WorksheetColumnClass.physicalStock, "gap-1")}>
                    <Input
                        type="number"
                        min="0"
                        placeholder="Stok fisik"
                        className="h-7 flex-1 text-sm tabular-nums px-2"
                        value={raw}
                        onChange={(e) => onChange(item.id, e.target.value)}
                        onFocus={() => onFocus(item.id)}
                        onBlur={() => onFocus(null)}
                    />
                    {normUoms.length > 1 && (
                        <Select value={selectedUom?.id} onValueChange={v => onUomChange(item.id, v)}>
                            <SelectTrigger className="h-7 w-20 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>{normUoms.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
                        </Select>
                    )}
                </span>
                <span className={WorksheetColumnClass.reason}>
                    <Select value={rowReason} onValueChange={(v) => onReasonChange(item.id, v)}>
                        <SelectTrigger className="h-7 w-full text-xs">
                            <SelectValue placeholder="Alasan" />
                        </SelectTrigger>
                        <SelectContent>
                            {reasonOptions.count.map(opt => <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </span>
                <span className={WorksheetColumnClass.notes}>
                    <Input
                        type="text"
                        placeholder="Catatan"
                        className="h-7 w-full text-xs px-2"
                        value={rowNotes[item.id] ?? ''}
                        onChange={(e) => onNotesChange(item.id, e.target.value)}
                    />
                </span>
                <span className={cn(
                    WorksheetColumnClass.diff,
                    invalid ? "text-destructive" : diff === null ? "text-muted-foreground/40" : diff === 0 ? "text-muted-foreground" : diff > 0 ? "text-success dark:text-success-foreground" : "text-destructive"
                )}>
                    {invalid ? '⚠' : diff === null ? '·' : diff > 0 ? `+${diff}` : diff}
                </span>
            </div>
        </div>
    );
});
WorksheetRow.displayName = "WorksheetRow";

const WorksheetGrid = memo(({ items, categories, physicalCounts, rowReasons, rowNotes, rowUoms, onChange, onReasonChange, onNotesChange, onUomChange }: {
    items: InventoryItemType[];
    categories: Category[];
    physicalCounts: Record<string, string>;
    rowReasons: Record<string, string>;
    rowNotes: Record<string, string>;
    rowUoms: Record<string, string>;
    onChange: (itemId: string, value: string) => void;
    onReasonChange: (itemId: string, value: string) => void;
    onNotesChange: (itemId: string, value: string) => void;
    onUomChange: (itemId: string, value: string) => void;
}) => {
    const { products } = useStore();
    const [focusedId, setFocusedId] = useState<string | null>(null);

    const itemData: WorksheetRowData = {
        items, categories, products, physicalCounts, rowReasons, rowNotes, rowUoms,
        defaultReason: reasonOptions.count[0].id, focusedId,
        onChange, onReasonChange, onNotesChange, onUomChange, onFocus: setFocusedId,
    };

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <div className="px-4 w-full">
                <div className="rounded-t-lg h-8 w-full border bg-card flex items-center px-2">
                    <span className={WorksheetColumnClass.no}>No</span>
                    <span className={WorksheetColumnClass.name}>
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nama Item</span>
                    </span>
                    <span className={WorksheetColumnClass.brand}>
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Merek</span>
                    </span>
                    <span className={WorksheetColumnClass.category}>
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Kategori</span>
                    </span>
                    <span className={WorksheetColumnClass.systemStock}>
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Stok</span>
                    </span>
                    <span className={WorksheetColumnClass.physicalStock}>
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Stok Fisik</span>
                    </span>
                    <span className={WorksheetColumnClass.reason}>
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Alasan</span>
                    </span>
                    <span className={WorksheetColumnClass.notes}>
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Catatan</span>
                    </span>
                    <span className={WorksheetColumnClass.diff}>
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Selisih</span>
                    </span>
                </div>
            </div>
            <div className="flex-1 min-h-0 relative overflow-hidden">
                {items.length > 0 ? (
                    <AutoSizer>
                        {({ height, width }) => (
                            <List
                                className="no-scrollbar"
                                height={height}
                                width={width}
                                itemCount={items.length}
                                itemSize={40}
                                itemKey={(index) => items[index].id}
                                itemData={itemData}
                            >
                                {WorksheetRow}
                            </List>
                        )}
                    </AutoSizer>
                ) : (
                    <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-full p-8">
                        <Package className="w-12 h-12 mb-4" />
                        <p>Tidak ada item yang ditemukan</p>
                    </div>
                )}
            </div>
        </div>
    );
});
WorksheetGrid.displayName = "WorksheetGrid";

export default function InventoryPage() {
    const reducedMotion = usePrefersReducedMotion();
    const { products, categories, productVariants } = useStore();
    const { toast } = useToast();
    const { rapidInventoryMode, setRapidInventoryMode, worksheetInventoryMode, setWorksheetInventoryMode } = useSettingsStore();
    const [selectedItem, setSelectedItem] = useState<{ id: string; type: 'product' | 'variant' } | null>(null);
    const [detailProductId, setDetailProductId] = useState<string | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const [filter, setFilter] = useState('all');
    const [lastAdjustment, setLastAdjustment] = useState<AdjustmentResult | null>(null);

    // Worksheet (batch opname) state
    const [physicalCounts, setPhysicalCounts] = useState<Record<string, string>>({});
    const [worksheetRowReasons, setWorksheetRowReasons] = useState<Record<string, string>>({});
    const [worksheetRowNotes, setWorksheetRowNotes] = useState<Record<string, string>>({});
    const [worksheetRowUoms, setWorksheetRowUoms] = useState<Record<string, string>>({});
    const [worksheetBusy, setWorksheetBusy] = useState(false);

    // Multi-search (worksheet only): scan/enter comma-separated terms to filter many items at once.
    const [multiSearch, setMultiSearch] = useState(false);
    const searchBarRef = useRef<ProductSearchBarHandle>(null);

    const outerRef = useRef<HTMLDivElement>(null);
    const thumbRef = useRef<HTMLDivElement>(null);
    const trackRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<List>(null);
    const [isScrolling, setIsCrolling] = useState(false);

    const { query, setQuery } = useProductSearch();

    const inventoryItems: InventoryItemType[] = useMemo(() => {
        const stockTrackedProducts = products.filter(p => p.track_stock).map(p => ({ ...p, itemType: 'product' as const, stock: p.stock }));
        const variants = productVariants.filter(v => v.track_stock).map(v => {
            const parent = products.find(p => p.id === v.product_id);
            return { ...v, itemType: 'variant' as const, stock: v.stock, parentName: parent?.name || 'Unknown' };
        });

        let combined: InventoryItemType[] = [...stockTrackedProducts, ...variants];
        
        switch(filter) {
            case 'product':
                combined = combined.filter(item => item.itemType === 'product');
                break;
            case 'variant':
                 combined = combined.filter(item => item.itemType === 'variant');
                break;
            case 'wholesale':
                combined = combined.filter(item => {
                    if (item.itemType === 'product') return (item as Product).isWholesaleEnabled;
                    const parent = products.find(p => p.id === (item as ProductVariant).product_id);
                    return !!parent?.isWholesaleEnabled;
                });
                break;
            case 'consignment':
                combined = combined.filter(item => {
                    if (item.itemType === 'product') {
                        return (item as Product).is_consignment === true;
                    }
                    if (item.itemType === 'variant') {
                        const parent = products.find(p => p.id === (item as ProductVariant).product_id);
                        return parent?.is_consignment === true;
                    }
                    return false;
                });
                break;
            case 'low_stock':
                combined = combined.filter(item => {
                    const isProduct = item.itemType === 'product';
                    const isVariant = item.itemType === 'variant';

                    if (isProduct) {
                        const p = item as Product;
                        return p.track_stock && p.low_stock_alert != null && p.stock > 0 && p.stock <= p.low_stock_alert;
                    }
                    if (isVariant) {
                        const v = item as ProductVariant;
                        return v.track_stock && v.low_stock_alert != null && v.stock > 0 && v.stock <= v.low_stock_alert;
                    }
                    return false;
                });
                break;
            case 'out_of_stock':
                 combined = combined.filter(item => item.stock <= 0);
                break;
            default: // 'all'
                break;
        }

        if (!query.trim()) return combined;

        if (multiSearch) {
            // Multi-search: match ANY comma-separated term (keyword or barcode).
            const terms = query.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
            if (terms.length === 0) return combined;
            return combined.filter(p => {
                const nameToSearch = p.itemType === 'variant' ? `${(p as any).parentName} ${p.name}` : p.name;
                const barcode = p.itemType === 'product' ? ((p as Product).barcode || '') : '';
                const haystack = `${nameToSearch.toLowerCase()} ${barcode.toLowerCase()}`;
                return terms.some(term => haystack.includes(term));
            });
        }

        return combined.filter(p => {
            const nameToSearch = p.itemType === 'variant' ? `${(p as any).parentName} ${p.name}` : p.name;
            return nameToSearch.toLowerCase().includes(query.toLowerCase());
        });
    }, [products, productVariants, query, filter, multiSearch]);

    const handleBarcodeScan = (barcode: string) => {
        // In worksheet multi-search, a scan just appends the barcode to the search
        // bar (comma-separated) so the grid filters to all scanned items at once.
        if (multiSearch) {
            searchBarRef.current?.appendTerm(barcode);
            return;
        }
        const product = products.find(p => p.barcode === barcode);
        if (product) {
            if (!product.track_stock) {
                toast({
                    variant: "destructive",
                    title: "Stok tidak terlacak",
                    description: `"${product.name}" tidak diatur untuk melacak stok.`,
                });
                return;
            }
            handleItemSelect({ ...product, itemType: 'product', stock: product.stock });
        } else {
            toast({
                variant: "destructive",
                title: "Produk tidak ditemukan",
                description: `Tidak ada produk yang ditemukan dengan barcode: ${barcode}`,
            });
        }
    };

    useGlobalBarcodeScanner({ onScan: handleBarcodeScan });

    const { subscribe, getScrollTop } = useOverlayScrollbar({
        outerRef, thumbRef, trackRef, containerRef, options: {
            autoHideDelay: 800,
            minThumbHeight: 24,
        }
    })

    useEffect(() => {
        const unsubscribe = subscribe(() => {
            const scrolltop = getScrollTop();
            setIsCrolling(scrolltop > 0);
        });
        return () => {
            unsubscribe();
        };
    }, []);

    const handleItemSelect = (item: InventoryItemType) => {
        setSelectedItem({ id: item.id, type: item.itemType });
        if (window.innerWidth < 768) {
            setIsSheetOpen(true);
        }
    };

    const openProductDetail = (item: InventoryItemType) => {
        const productId = item.itemType === 'variant' ? (item as ProductVariant).product_id : item.id;
        if (!productId) return;
        setDetailProductId(productId);
        setIsDetailOpen(true);
    };

    const handleKeyNav = (e: React.KeyboardEvent) => {
        if (inventoryItems.length === 0) return;
        const currentIndex = selectedItem
            ? inventoryItems.findIndex(i => i.id === selectedItem.id)
            : -1;
        let next = currentIndex;
        if (e.key === 'ArrowDown') next = Math.min(currentIndex + 1, inventoryItems.length - 1);
        else if (e.key === 'ArrowUp') next = Math.max(currentIndex - 1, 0);
        else if (e.key === 'F2' && currentIndex >= 0) {
            openProductDetail(inventoryItems[currentIndex]);
            return;
        }
        else if ((e.key === 'Enter' || e.key === ' ') && currentIndex >= 0) {
            handleItemSelect(inventoryItems[currentIndex]);
            return;
        } else return;

        e.preventDefault();
        if (next >= 0 && next !== currentIndex) {
            const item = inventoryItems[next];
            handleItemSelect(item);
            listRef.current?.scrollToItem(next);
        }
    };

    // Jump keyboard focus from the search bar into the inventory table.
    const handleInventoryArrowNav = (dir: 'down' | 'up') => {
        if (inventoryItems.length === 0) return;
        const targetIdx = dir === 'down' ? 0 : inventoryItems.length - 1;
        if (!selectedItem) {
            handleItemSelect(inventoryItems[targetIdx]);
        }
        listRef.current?.scrollToItem(targetIdx);
        containerRef.current?.focus();
    };

    const handleOpenAdjustmentSheet = () => {
        setSelectedItem(null);
        setIsSheetOpen(true);
    };

    const handleSheetOpenChange = (isOpen: boolean) => {
        setIsSheetOpen(isOpen);
        if (!isOpen) {
            setSelectedItem(null);
        }
    }

    const handleSave = (adjustment?: AdjustmentResult) => {
        if (adjustment) setLastAdjustment(adjustment);

        // Rapid mode: keep the panel open and advance to the next row so the
        // operator can keep counting. Barcode-driven flows just scan the next item.
        if (rapidInventoryMode) {
            if (selectedItem) {
                const idx = inventoryItems.findIndex(i => i.id === selectedItem.id);
                if (idx >= 0 && idx + 1 < inventoryItems.length) {
                    const next = inventoryItems[idx + 1];
                    setSelectedItem({ id: next.id, type: next.itemType });
                    listRef.current?.scrollToItem(idx + 1);
                }
            }
            return;
        }

        // Normal mode: keep the item selected on desktop so the updated stock +
        // history stay visible; close the sheet on small screens.
        if (window.innerWidth < 768) {
            setIsSheetOpen(false);
        }
    }

    const handleUndo = async () => {
        if (!lastAdjustment) return;
        try {
            if (lastAdjustment.itemType === 'product') {
                await adjustStock({
                    product_id: lastAdjustment.itemId,
                    type: 'correction',
                    qty_change: -lastAdjustment.change,
                    reason: 'Koreksi: Pembatalan',
                });
            } else {
                await adjustVariantStock(lastAdjustment.itemId, 'correction', -lastAdjustment.change, 'Koreksi: Pembatalan');
            }
            toast({ title: 'Penyesuaian Dibatalkan', description: `Perubahan stok ${lastAdjustment.name} telah dibatalkan.` });
            setLastAdjustment(null);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        }
    }

    const handleCancel = () => {
        setSelectedItem(null);
        setIsSheetOpen(false);
    }

    // ---- Worksheet (batch opname) ----

    const worksheetDirtyRows = useMemo(() => inventoryItems.filter(it => {
        const raw = physicalCounts[it.id];
        if (raw === undefined || raw.trim() === '') return false;
        const physical = parseInt(raw, 10);
        return !isNaN(physical) && physical >= 0 && physical !== it.stock;
    }), [inventoryItems, physicalCounts]);

    const worksheetInvalidRows = useMemo(() => inventoryItems.filter(it => {
        const raw = physicalCounts[it.id];
        if (raw === undefined || raw.trim() === '') return false;
        const physical = parseInt(raw, 10);
        return isNaN(physical) || physical < 0;
    }), [inventoryItems, physicalCounts]);

    const handleWorksheetChange = (itemId: string, value: string) => {
        setPhysicalCounts(prev => ({ ...prev, [itemId]: value }));
    };

    const handleWorksheetReasonChange = (itemId: string, value: string) => {
        setWorksheetRowReasons(prev => ({ ...prev, [itemId]: value }));
    };

    const handleWorksheetNoteChange = (itemId: string, value: string) => {
        setWorksheetRowNotes(prev => ({ ...prev, [itemId]: value }));
    };

    const handleApplyWorksheet = async () => {
        if (worksheetInvalidRows.length > 0) {
            toast({ variant: 'destructive', title: 'Input Tidak Valid', description: `${worksheetInvalidRows.length} baris memiliki jumlah yang tidak valid (harus angka >= 0).` });
            return;
        }
        if (worksheetDirtyRows.length === 0) {
            toast({ title: 'Tidak Ada Perubahan', description: 'Tidak ada selisih yang perlu diperbarui.' });
            return;
        }

        setWorksheetBusy(true);
        let ok = 0, unchanged = 0, failed = 0;
        const appliedIds = new Set<string>();
        const rows = [...worksheetDirtyRows];

        try {
            for (let i = 0; i < rows.length; i += 10) {
                const chunk = rows.slice(i, i + 10);
                const results = await Promise.all(chunk.map(async it => {
                    const physical = parseInt(physicalCounts[it.id], 10);
                    const change = physical - it.stock;
                    if (change === 0) return 'unchanged' as const;
                    const reasonId = worksheetRowReasons[it.id] ?? reasonOptions.count[0].id;
                    const reasonOption = reasonOptions.count.find(o => o.id === reasonId) || reasonOptions.count[0];
                    const note = worksheetRowNotes[it.id]?.trim();
                    const reason = note ? `${reasonOption.label}: ${note}` : reasonOption.label;
                    try {
                        if (it.itemType === 'product') {
                            await adjustStock({ product_id: it.id, type: reasonOption.value, qty_change: change, reason });
                        } else {
                            await adjustVariantStock(it.id, reasonOption.value, change, reason);
                        }
                        appliedIds.add(it.id);
                        return 'ok' as const;
                    } catch {
                        return 'failed' as const;
                    }
                }));
                results.forEach(r => {
                    if (r === 'ok') ok++;
                    else if (r === 'unchanged') unchanged++;
                    else failed++;
                });
            }
        } finally {
            setWorksheetBusy(false);
        }

        toast({
            title: 'Opname Selesai',
            description: `${ok} item diperbarui${unchanged ? `, ${unchanged} tanpa perubahan` : ''}${failed ? `, ${failed} gagal` : ''}.`,
            variant: failed > 0 ? 'destructive' : undefined,
        });

        if (appliedIds.size > 0) {
            setPhysicalCounts(prev => {
                const next = { ...prev };
                appliedIds.forEach(id => delete next[id]);
                return next;
            });
        }
    };

    const handleToggleRapid = () => {
        const next = !rapidInventoryMode;
        setRapidInventoryMode(next);
        // Only one of "Mode Cepat" / "Worksheet" can be active at a time.
        if (next) setWorksheetInventoryMode(false);
        setSelectedItem(null);
    };

    const handleToggleWorksheet = () => {
        const next = !worksheetInventoryMode;
        setWorksheetInventoryMode(next);
        // Only one of "Mode Cepat" / "Worksheet" can be active at a time.
        if (next) setRapidInventoryMode(false);
        setSelectedItem(null);
        // Leaving worksheet mode resets multi-search and clears the search bar.
        if (!next) {
            setMultiSearch(false);
            setQuery('');
            searchBarRef.current?.clear();
        }
        // Keep physicalCounts so stok fisik values persist across mode switches.
    };

    const Row = memo(({ index, style }: { index: number, style: React.CSSProperties }) => {
        return (
            <div style={style} className="px-4 pb-4 pt-0">
                <InventoryListItem
                    item={inventoryItems[index]}
                    isSelected={selectedItem?.id === inventoryItems[index].id}
                    onItemClick={handleItemSelect}
                    onShowDetail={openProductDetail}
                    categories={categories}
                />
            </div>
        )
    });

    return (
        <div className="flex flex-col h-full min-h-0">
            <header className="sticky top-0 z-20 flex h-10 items-center gap-4 px-4 justify-between border-b border-border/60 bg-background/80 backdrop-blur-md">
                <Link to="/">
                    <TokoCepatLogo />
                </Link>
                <div className="flex items-center gap-2">
                    <NotificationBell />
                    <ThemeToggle />
                </div>
            </header>
            <div className="w-full h-[calc(100vh-3rem)] md:grid md:grid-cols-10 min-h-0">
                <div className={`h-full flex flex-col min-h-0 ${worksheetInventoryMode ? 'col-span-10' : 'col-span-10 md:col-span-6 lg:col-span-6'}`}>
                    <div className="flex flex-col gap-4 p-4">
                        <div className="flex items-center gap-2 ">
                            <div className="grow">
                                <ProductSearchBar
                                    ref={searchBarRef}
                                    onBarcodeScan={handleBarcodeScan}
                                    onArrowNav={handleInventoryArrowNav}
                                    multiSearch={multiSearch && worksheetInventoryMode}
                                    placeholder={multiSearch ? "Multi: pisahkan kata kunci/barcode dengan koma..." : undefined}
                                />
                            </div>
                            {worksheetInventoryMode && (
                                <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none" title="Aktifkan pencarian banyak item sekaligus (pisahkan dengan koma, scan barcode menambah otomatis)">
                                    <Checkbox id="multi-search" checked={multiSearch} onCheckedChange={(v) => setMultiSearch(!!v)} />
                                    Multi
                                </label>
                            )}
                            <div className="md:hidden">
                                <Button onClick={handleOpenAdjustmentSheet}>
                                    <PlusCircle className="mr-2 h-4 w-4" /> Penyesuaian
                                </Button>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                            <FilterPill active={filter === 'all'} onClick={() => setFilter('all')}>All</FilterPill>
                            <FilterPill active={filter === 'product'} onClick={() => setFilter('product')}>Produk</FilterPill>
                            <FilterPill active={filter === 'consignment'} onClick={() => setFilter('consignment')}>Konsinyasi</FilterPill>
                            <FilterPill active={filter === 'variant'} onClick={() => setFilter('variant')}>Varian</FilterPill>

                            <Separator orientation="vertical" className="h-4 my-auto" />

                            <FilterPill active={filter === 'low_stock'} onClick={() => setFilter('low_stock')}>Stok Tipis</FilterPill>
                            <FilterPill active={filter === 'out_of_stock'} onClick={() => setFilter('out_of_stock')}>Habis</FilterPill>

                            <Separator orientation="vertical" className="h-4 my-auto" />

                            <Button
                                variant="ghost"
                                size="sm"
                                className={cn(
                                    "rounded-md px-2.5 h-7 shrink-0 text-xs",
                                    rapidInventoryMode ? "bg-primary text-primary-foreground hover:bg-primary/90" : "text-muted-foreground hover:text-foreground"
                                )}
                                aria-pressed={rapidInventoryMode}
                                onClick={handleToggleRapid}
                                title="Mode Cepat: scan/pilih item lalu ketik stok fisik dan Enter untuk lanjut"
                            >
                                <Zap className="size-3.5 mr-1" /> Mode Cepat
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className={cn(
                                    "rounded-md px-2.5 h-7 shrink-0 text-xs",
                                    worksheetInventoryMode ? "bg-primary text-primary-foreground hover:bg-primary/90" : "text-muted-foreground hover:text-foreground"
                                )}
                                aria-pressed={worksheetInventoryMode}
                                onClick={handleToggleWorksheet}
                                title="Worksheet Opname: isi stok fisik banyak item sekaligus lalu terapkan"
                            >
                                <ClipboardList className="size-3.5 mr-1" /> Worksheet
                            </Button>

                            <div className="ml-auto flex shrink-0 items-center gap-2">
                                {worksheetInventoryMode && (
                                    <Button
                                        size="sm"
                                        onClick={handleApplyWorksheet}
                                        disabled={worksheetBusy || worksheetDirtyRows.length === 0 || worksheetInvalidRows.length > 0}
                                        className="h-7 shrink-0"
                                    >
                                        {worksheetBusy ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : <ClipboardList className="size-3.5 mr-1.5" />}
                                        Terapkan {worksheetDirtyRows.length > 0 ? `(${worksheetDirtyRows.length})` : ''}
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 bg-background h-full min-h-0 flex flex-col">
                        {worksheetInventoryMode ? (
                            <WorksheetGrid
                                items={inventoryItems}
                                categories={categories}
                                physicalCounts={physicalCounts}
                                rowReasons={worksheetRowReasons}
                                rowNotes={worksheetRowNotes}
                                rowUoms={worksheetRowUoms}
                                onChange={handleWorksheetChange}
                                onReasonChange={handleWorksheetReasonChange}
                                onNotesChange={handleWorksheetNoteChange}
                                onUomChange={(id, v) => setWorksheetRowUoms(prev => ({ ...prev, [id]: v }))}
                            />
                        ) : inventoryItems.length > 0 ? (
                            <>
                                <div className="px-4 w-full">
                                    <div className="rounded-t-lg h-8 w-full border bg-card flex items-center px-4">
                                        <div className={ColumnClass.name}>
                                            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nama Item</span>
                                        </div>
                                        <div className={ColumnClass.brand}>
                                            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Merek</span>
                                        </div>
                                        <div className={ColumnClass.category}>
                                            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Kategori</span>
                                        </div>
                                        <div className={ColumnClass.stock}>
                                            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Stok</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex-1 min-h-0 relative overflow-hidden outline-none" ref={containerRef} tabIndex={0} onKeyDown={handleKeyNav}>
                                    <div className={`absolute -top-px h-0 transition-opacity duration-150 pointer-events-none shadow border-b left-3 right-3 z-10 ${isScrolling ? 'opacity-100' : 'opacity-0'}`}></div>
                                    <AutoSizer>
                                        {({ height, width }) => (
                                            <List
                                                ref={listRef as any}
                                                itemKey={(index) => inventoryItems[index].id}
                                                className='no-scrollbar'
                                                outerRef={outerRef}
                                                height={height}
                                                width={width}
                                                itemCount={inventoryItems.length}
                                                itemSize={36}
                                            >
                                                {Row}
                                            </List>
                                        )}
                                    </AutoSizer>
                                    {/* Overlay Scrollbar */}
                                    <div ref={trackRef} className="absolute right-2 top-0 bottom-0 w-2 opacity-0 transition-opacity duration-200 z-20" >
                                        <div ref={thumbRef} className="absolute w-full rounded-full bg-border/40 hover:bg-border/70 cursor-pointer" />
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-full p-8">
                                <Package className="w-12 h-12 mb-4" />
                                <p>Tidak ada item yang ditemukan</p>
                            </div>
                        )}
                    </div>
                </div>

                {!worksheetInventoryMode && (
                <aside className="hidden md:block col-span-4 lg:col-span-4 h-full min-h-0">
                    <AnimatePresence mode="wait" initial={false}>
                        <motion.div
                            key={selectedItem ? `${selectedItem.type}-${selectedItem.id}` : 'none'}
                            initial={{ opacity: 0, x: reducedMotion ? 0 : 24 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: reducedMotion ? 0 : 24 }}
                            transition={reducedMotion ? { duration: 0 } : { duration: 0.18, ease: 'easeOut' }}
                            className="h-full min-h-0"
                        >
                            <StockAdjustmentPanel
                                onSave={handleSave}
                                onCancel={handleCancel}
                                selectedItem={selectedItem}
                                rapidMode={rapidInventoryMode}
                                lastAdjustment={lastAdjustment}
                                onUndo={handleUndo}
                                physicalCounts={physicalCounts}
                                onPhysicalCountChange={handleWorksheetChange}
                            />
                        </motion.div>
                    </AnimatePresence>
                </aside>
            )}

                <Sheet open={isSheetOpen} onOpenChange={handleSheetOpenChange}>
                    <SheetContent side="right" className="w-full sm:w-125 p-0 flex flex-col h-full min-h-0">
                        <SheetHeader className="sr-only">
                            <SheetTitle>Penyesuaian Stok</SheetTitle>
                        </SheetHeader>
                        <AnimatePresence mode="wait" initial={false}>
                            <motion.div
                                key={selectedItem ? `${selectedItem.type}-${selectedItem.id}` : 'none'}
                                initial={{ opacity: 0, x: reducedMotion ? 0 : 40 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: reducedMotion ? 0 : 40 }}
                                transition={reducedMotion ? { duration: 0 } : { duration: 0.2, ease: 'easeOut' }}
                                className="h-full min-h-0"
                            >
                                <StockAdjustmentPanel
                                    onSave={handleSave}
                                    onCancel={handleCancel}
                                    selectedItem={selectedItem}
                                    rapidMode={rapidInventoryMode}
                                    lastAdjustment={lastAdjustment}
                                    onUndo={handleUndo}
                                    physicalCounts={physicalCounts}
                                    onPhysicalCountChange={handleWorksheetChange}
                                />
                            </motion.div>
                        </AnimatePresence>
                    </SheetContent>
                </Sheet>

                <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                    <DialogContent className="max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Detail Produk</DialogTitle>
                        </DialogHeader>
                        {detailProductId && (
                            <ProductForm
                                productId={detailProductId}
                                onSave={() => setIsDetailOpen(false)}
                                onCancel={() => setIsDetailOpen(false)}
                            />
                        )}
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}
