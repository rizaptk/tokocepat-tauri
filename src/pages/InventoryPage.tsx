import { useState, useMemo, useEffect, memo, useRef, useTransition } from "react";
import { useStore } from "@/lib/store";
import { Product, StockMovementType, Category, ProductVariant, StockMovement } from "@/lib/types";
import { adjustStock, adjustVariantStock, getStockMovementsByProducts } from "@/services/stockService";
import { useToast } from "@/hooks/use-toast";
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { ScrollArea, ScrollAreaHandle } from "@/components/ui/scroll-area";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ProductSearchBar } from "@/components/ProductSearchBar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PlusCircle, Plus, Minus, Calculator, Package, WarehouseIcon, History, ArrowUp, ArrowDown, ArrowRight } from "lucide-react";
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
import { motion, AnimatePresence } from "framer-motion"; 


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
        { id: 'remove-consignor-return', value: 'correction', label: 'Retur Titipan / Konsinyasi' },
        { id: 'remove-other', value: 'correction', label: 'Lainnya' }
    ],
    count: [
        { id: 'count-correction', value: 'correction', label: 'Koreksi Stok Opname' },
        { id: 'count-consignor', value: 'correction', label: 'Koreksi Retur Konsinyasi' },
        { id: 'count-audit', value: 'correction', label: 'Audit Akhir Bulan' },
        { id: 'count-other', value: 'correction', label: 'Lainnya' }
    ]
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
                    <Card key={firstHistory.product_id} className="overflow-hidden">
                        <CardHeader className="px-4 pb-3 pt-4 border-b flex flex-row justify-between items-center">
                            <CardTitle className="text-sm font-bold">{item?.name || 'Unknown Item'} {group.length > 1 && <Badge variant="success" className="ms-2 py-0.5 px-2 leading-none font-mono">{` ${group.length} ${over50 ? '+' : ''}`}</Badge>}</CardTitle>
                            <Button variant="ghost" size="sm">
                                <Link to="/dashboard/reports/stock-movement" className="flex items-center gap-2">
                                    Laporan <ArrowRight />
                                </Link>
                            </Button>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-border/50">
                                {group.map((history, index) => {
                                    const date = new Date(history.created_at).toLocaleString();
                                    const mapped = reasonMapping.get(history.type);
                                    const hisType = (mapped??history.type).toUpperCase();
                                    const isPositive = history.qty_change > 0;
                                    return (
                                        <div key={history.id} className={cn("px-4 py-3 text-sm hover:bg-muted/30 transition-colors flex gap-3 items-start", index % 2 === 0 ? "bg-muted/40" : "bg-transparent")}>
                                            <div className={cn(
                                                "mt-1 p-1.5 rounded-full shrink-0",
                                                isPositive ? "bg-success/30 text-success-foreground" : "bg-destructive/15 text-destructive"
                                            )}>
                                                {isPositive ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start mb-0.5">
                                                    <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-bold">
                                                        {hisType}
                                                    </span>
                                                    <div className={cn("font-bold text-sm tabular-nums", isPositive ? "text-green-600" : "text-destructive")}>
                                                        {isPositive ? `+${history.qty_change}` : history.qty_change}
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

const StockAdjustmentPanel = memo(({ selectedItem, onSave, onCancel }: { selectedItem: { id: string, type: 'product' | 'variant' } | null; onSave: () => void; onCancel: () => void; }) => {
    const [mode, setMode] = useState<'add' | 'remove' | 'count' | null>(null);
    const [quantity, setQuantity] = useState('');
    const [actualCount, setActualCount] = useState('');
    const [reason, setReason] = useState('');
    const [note, setNote] = useState('');

    const { products, productVariants } = useStore();
    const { toast } = useToast();

    const scrollRef = useRef<ScrollAreaHandle>(null);

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

    // Reset form state when product changes
    useEffect(() => {
        if (selectedItem) {
            setMode(null);
            setQuantity('');
            setActualCount('');
            setReason('');
            setNote('');
        }
    }, [selectedItem]);

    // Calculate change and new stock for the preview
    const { change, newStock, isFormValid } = useMemo(() => {
        if (!item || !mode) return { change: 0, newStock: 0, isFormValid: false };

        const currentStock = item.stock;
        let changeVal = 0;
        let formIsValid = false;

        if (mode === 'add' || mode === 'remove') {
            const qty = parseInt(quantity, 10);
            if (!isNaN(qty) && qty > 0) {
                changeVal = mode === 'add' ? qty : -qty;
                formIsValid = !!reason;
            }
        } else if (mode === 'count') {
            const count = parseInt(actualCount, 10);
            if (!isNaN(count)) {
                changeVal = count - currentStock;
                // Form is valid if reason is selected, OR if there's no change (no action needed).
                formIsValid = changeVal !== 0 ? !!reason : true;
            }
        }

        return {
            change: changeVal,
            newStock: currentStock + changeVal,
            isFormValid: formIsValid
        };
    }, [mode, quantity, actualCount, reason, item]);

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

            if (item.itemType === 'product') {
                await adjustStock({
                    product_id: item.id,
                    type: selectedOption.value,
                    qty_change: change,
                    reason: adjustmentReason,
                });
            } else if (item.itemType === 'variant') {
                await adjustVariantStock(item.id, selectedOption.value, change, adjustmentReason);
            }

            toast({ title: 'Stok Berhasil Diperbarui', description: `Stok ${item.name} telah diperbarui menjadi ${newStock}.` });
            onSave();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        }
    };

    const { icon: ItemIcon, badge: badgeVariant } = typeConfig[selectedItem?.type|| 'product'];

    return (
        <div className="flex flex-col h-full min-h-0">
            <div className="pt-2 pb-1 px-4 flex items-center justify-between">
                <h3 className="font-semibold text-base">Penyesuaian Stok</h3>
                <WarehouseIcon className="size-4" />
            </div>
            <div className="flex-1 min-h-0 flex flex-col relative">
                <ScrollShadow scrollRef={scrollRef} side="both" />
                <ScrollArea ref={scrollRef} className="flex-1 min-h-0 [&>[data-radix-scroll-area-viewport]>div]:block! [&>[data-radix-scroll-area-viewport]>div]:h-full!">
                    <div className="p-4 space-y-4 h-full">
                        {!item ? (
                            <Card className="h-full">
                                <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-full p-8">
                                    <Package className="w-12 h-12 mb-4" />
                                    <p>Tidak ada item dipilih</p>
                                </div>
                            </Card>
                        ) : (
                            <>
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-base">{item.itemType === 'variant' ? `${item.parentName} (${item.name})` : item.name}</CardTitle>
                                        <div className="flex justify-between items-center">
                                            <CardDescription>Stok Tersedia: <span className="font-bold text-foreground">{item.stock}</span></CardDescription>
                                            <Badge variant={badgeVariant as any} className="border border-border capitalize">
                                                <ItemIcon className="h-3 w-3 mr-1.5" />
                                                {itemMapping.get(item.itemType)}
                                            </Badge>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-2">

                                        <div>
                                            <Label>Aksi?</Label>
                                            <ButtonGroup className="w-full mt-2">
                                                <Button variant={mode === 'add' ? 'success' : 'outline'} onClick={() => setMode('add')} className="flex-1 h-10">
                                                    <Plus className="w-4 h-4" />
                                                    <span className="text-xs">Tambah</span>
                                                </Button>
                                                <Button variant={mode === 'remove' ? 'destructive' : 'outline'} onClick={() => setMode('remove')} className="flex-1 h-10">
                                                    <Minus className="w-4 h-4" />
                                                    <span className="text-xs">Kurang</span>
                                                </Button>
                                                <Button variant={mode === 'count' ? 'default' : 'outline'} onClick={() => setMode('count')} className="flex-1 h-10">
                                                    <Calculator className="w-4 h-4" />
                                                    <span className="text-xs">Koreksi</span>
                                                </Button>
                                            </ButtonGroup>
                                        </div>

                                        {mode && (
                                            <div className="space-y-3 pt-2">
                                                {mode === 'add' || mode === 'remove' ? (
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="space-y-2">
                                                            <Label htmlFor="quantity">Jumlah</Label>
                                                            <Input id="quantity" type="number" placeholder="Angka" value={quantity} onChange={(e) => setQuantity(e.target.value)} min="1" />
                                                        </div>
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
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="space-y-2">
                                                            <Label htmlFor="actual-count">Stok Rill (Fisik)</Label>
                                                            <Input id="actual-count" type="number" placeholder="cth. 142" value={actualCount} onChange={(e) => setActualCount(e.target.value)} />
                                                        </div>
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
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-base">Ringkasan</CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Stok Lama</span>
                                                <span>{item.stock}</span>
                                            </div>
                                            <div className={cn("flex justify-between font-semibold", change > 0 ? "text-green-600" : "text-destructive")}>
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

            <div className="p-4 mt-auto flex gap-2">
                {
                    item &&
                    <Button variant="outline" className="flex-1" onClick={onCancel}>
                        Batal
                    </Button>
                }
                <Button className="flex-1" onClick={handleSubmit} disabled={!isFormValid || !item || (mode === 'count' && change === 0)}>Simpan</Button>
            </div>
        </div>
    );
})


const ColumnClass = {
    name: "flex items-center gap-2 flex-1 min-w-0 h-full",
    type: "hidden sm:flex items-center w-28 px-2 border-l border-l-border/50 h-full",
    category: "hidden md:flex items-center text-sm text-muted-foreground truncate max-w-[160px] w-[160px] px-2 border-l border-l-border/50 h-full",
    stock: "flex flex-col items-end justify-center shrink-0 text-right tabular-nums whitespace-nowrap w-24 border-l border-l-border/50 h-full px-2"
}

const InventoryListItem = ({ item, isSelected, onItemClick, categories, isEven }: { item: InventoryItemType; isSelected: boolean; onItemClick: (item: InventoryItemType) => void; categories: Category[], isEven: boolean}) => {
    
    let categoryName = 'N/A';
    if (item.itemType === 'product') {
        categoryName = categories.find(c => c.id === item.category_id)?.name || 'N/A';
    } else if (item.itemType === 'variant') {
        const parent = useStore.getState().products.find(p => p.id === item.product_id);
        categoryName = parent ? categories.find(c => c.id === parent.category_id)?.name || 'N/A' : 'N/A';
    }

    let displayName = item.name;
    if (item.itemType === 'variant') {
        displayName = `${item.parentName} (${item.name})`;
    }

    const { icon: ItemIcon, badge: badgeVariant } = typeConfig[item.itemType];

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
        <div className="bg-card border-x border-b border-b-border/50 p-0 h-12">
            <div
                data-item
                onClick={() => onItemClick(item)}
                className={cn(
                    "group flex items-center px-4 transition-colors cursor-pointer  hover:bg-accent h-12",
                    isSelected ? "bg-success/20 text-success-foreground" : isEven ? 'bg-border/10' : ''
                )}
            >
                <div className={ColumnClass.name}>
                    <p className="font-medium truncate">{displayName}</p>
                    {isConsignment && (
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold truncate">
                            Titipan: {consignorName} ({formattedCommission})
                        </span>
                    )}
                </div>
                <div className={ColumnClass.type}>
                    <Badge variant={badgeVariant as any} className="text-[10px] uppercase px-2 py-0.5 border border-border">
                        <ItemIcon className="h-3 w-3 mr-1" />
                        {/* {item.itemType} */}
                        {itemMapping.get(item.itemType)}
                    </Badge>
                </div>
                <div className={ColumnClass.category}>
                    <span className="truncate">{categoryName}</span>
                </div>
                <div className={ColumnClass.stock} title="Klik untuk menyesuaikan stok" onClick={() => onItemClick(item)} role="button" tabIndex={-1}>
                    <p className="font-bold text-base group-hover:text-primary transition-colors">{item.stock}</p>
                </div>
            </div>
        </div>
    );
}


export default function InventoryPage() {
    const { products, categories, productVariants } = useStore();
    const { toast } = useToast();
    const [selectedItem, setSelectedItem] = useState<{ id: string; type: 'product' | 'variant' } | null>(null);
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const [filter, setFilter] = useState('all');

    const outerRef = useRef<HTMLDivElement>(null);
    const thumbRef = useRef<HTMLDivElement>(null);
    const trackRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<List>(null);
    const [isScrolling, setIsCrolling] = useState(false);

    const { query } = useProductSearch();

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
        return combined.filter(p => {
            const nameToSearch = p.itemType === 'variant' ? `${(p as any).parentName} ${p.name}` : p.name;
            return nameToSearch.toLowerCase().includes(query.toLowerCase());
        });
    }, [products, productVariants, query, filter]);

    const handleBarcodeScan = (barcode: string) => {
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

    const handleKeyNav = (e: React.KeyboardEvent) => {
        if (inventoryItems.length === 0) return;
        const currentIndex = selectedItem
            ? inventoryItems.findIndex(i => i.id === selectedItem.id)
            : -1;
        let next = currentIndex;
        if (e.key === 'ArrowDown') next = Math.min(currentIndex + 1, inventoryItems.length - 1);
        else if (e.key === 'ArrowUp') next = Math.max(currentIndex - 1, 0);
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

    const handleSave = () => {
        setSelectedItem(null);
        if (window.innerWidth < 768) {
            setIsSheetOpen(false);
        }
    }

    const handleCancel = () => {
        setSelectedItem(null);
        setIsSheetOpen(false);
    }

    const Row = memo(({ index, style }: { index: number, style: React.CSSProperties }) => {
        const isEven = index % 2 === 0;
        return (
            <div style={style} className="px-4 pb-4 pt-0">
                <InventoryListItem
                    item={inventoryItems[index]}
                    isSelected={selectedItem?.id === inventoryItems[index].id}
                    onItemClick={handleItemSelect}
                    categories={categories}
                    isEven={isEven}
                />
            </div>
        )
    });

    return (
        <div className="flex flex-col h-full min-h-0">
            <header className="sticky top-0 z-20 flex h-12 items-center gap-4 px-4 justify-between border-b border-border/60 bg-background/80 backdrop-blur-md">
                <Link to="/">
                    <TokoCepatLogo />
                </Link>
                <div className="flex items-center gap-2">
                    <NotificationBell />
                    <ThemeToggle />
                </div>
            </header>
            <div className="w-full h-[calc(100vh-3rem)] md:grid md:grid-cols-10 min-h-0">
                <div className="col-span-10 md:col-span-6 lg:col-span-6 h-full flex flex-col min-h-0">
                    <div className="flex flex-col gap-4 p-4">
                        <div className="flex items-center gap-2 ">
                            <div className="grow">
                                <ProductSearchBar
                                    onBarcodeScan={handleBarcodeScan}
                                />
                            </div>
                            <div className="md:hidden">
                                <Button onClick={handleOpenAdjustmentSheet}>
                                    <PlusCircle className="mr-2 h-4 w-4" /> Penyesuaian
                                </Button>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 overflow-x-auto no-scrollbar">
                            <Button variant={filter === 'all' ? 'secondary' : 'outline'} onClick={() => setFilter('all')} className="rounded-md px-3 shrink-0">All</Button>
                            <Button variant={filter === 'product' ? 'secondary' : 'outline'} onClick={() => setFilter('product')} className="rounded-md px-3 shrink-0">Produk</Button>
                            {/* Consignment inventory filter */}
                            <Button variant={filter === 'consignment' ? 'secondary' : 'outline'} onClick={() => setFilter('consignment')} className="rounded-md px-3 shrink-0">Titipan / Konsinyasi</Button>
                            <Button variant={filter === 'variant' ? 'secondary' : 'outline'} onClick={() => setFilter('variant')} className="rounded-md px-3 shrink-0">Varian</Button>
                            
                            <Separator orientation="vertical" />

                            <Button variant={filter === 'low_stock' ? 'secondary' : 'outline'} onClick={() => setFilter('low_stock')} className="rounded-md px-3 shrink-0">Stok Tipis</Button>
                            <Button variant={filter === 'out_of_stock' ? 'secondary' : 'outline'} onClick={() => setFilter('out_of_stock')} className="rounded-md px-3 shrink-0">Habis</Button>
                        </div>
                    </div>
                    <div className="flex-1 bg-background h-full min-h-0 flex flex-col">
                        {inventoryItems.length > 0 ? (
                            <>
                                <div className="px-4 w-full">
                                    <div className="rounded-t-lg h-10 w-full border bg-card flex items-center px-4">
                                        <div className={ColumnClass.name}>
                                            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nama Item</span>
                                        </div>
                                        <div className={ColumnClass.type}>
                                            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Tipe</span>
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
                                                itemSize={48}
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

                <aside className="hidden md:block col-span-4 lg:col-span-4 h-full min-h-0">
                    <AnimatePresence mode="wait" initial={false}>
                        <motion.div
                            key={selectedItem ? `${selectedItem.type}-${selectedItem.id}` : 'none'}
                            initial={{ opacity: 0, x: 24 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 24 }}
                            transition={{ duration: 0.18, ease: 'easeOut' }}
                            className="h-full min-h-0"
                        >
                            <StockAdjustmentPanel onSave={handleSave} onCancel={handleCancel} selectedItem={selectedItem} />
                        </motion.div>
                    </AnimatePresence>
                </aside>

                <Sheet open={isSheetOpen} onOpenChange={handleSheetOpenChange}>
                    <SheetContent side="right" className="w-full sm:w-125 p-0 flex flex-col h-full min-h-0">
                        <SheetHeader className="sr-only">
                            <SheetTitle>Penyesuaian Stok</SheetTitle>
                        </SheetHeader>
                        <AnimatePresence mode="wait" initial={false}>
                            <motion.div
                                key={selectedItem ? `${selectedItem.type}-${selectedItem.id}` : 'none'}
                                initial={{ opacity: 0, x: 40 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 40 }}
                                transition={{ duration: 0.2, ease: 'easeOut' }}
                                className="h-full min-h-0"
                            >
                                <StockAdjustmentPanel onSave={handleSave} onCancel={handleCancel} selectedItem={selectedItem} />
                            </motion.div>
                        </AnimatePresence>
                    </SheetContent>
                </Sheet>
            </div>
        </div>
    );
}
