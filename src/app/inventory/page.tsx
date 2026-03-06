
"use client";

import { useState, useMemo, useEffect, memo, useRef } from "react";
import { useStore } from "@/lib/store";
import { Product, StockMovementType, RawIngredient, Category } from "@/lib/types";
import { adjustStock, adjustIngredientStock } from "@/services/stockService";
import { useToast } from "@/hooks/use-toast";
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { ScrollArea, ScrollAreaHandle } from "@/components/ui/scroll-area";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ProductSearchBar } from "@/components/ProductSearchBar";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { PlusCircle, Plus, Minus, Calculator, Package, Beaker } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useGlobalBarcodeScanner } from "@/hooks/use-global-barcode-scanner";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useProductSearch } from "@/lib/useProductSearch";
import { ButtonGroup } from "@/components/ui/button-group";
import { ScrollShadow } from "@/components/ui/scrollshadow";
import { useOverlayScrollbar } from "@/hooks/useScrollOverlay";


const reasonOptions: Record<'add' | 'remove' | 'count', { id: string, value: StockMovementType, label: string }[]> = {
    add: [
        { id: 'add-restock', value: 'restock', label: 'New Purchase / Restock' },
        { id: 'add-initial', value: 'initial_balance', label: 'Opening Stock' },
        { id: 'add-return', value: 'correction', label: 'Customer Return' },
        { id: 'add-other', value: 'correction', label: 'Other' }
    ],
    remove: [
        { id: 'remove-damaged', value: 'damaged', label: 'Damaged' },
        { id: 'remove-lost', value: 'lost', label: 'Lost / Stolen' },
        { id: 'remove-internal', value: 'correction', label: 'Internal Use' },
        { id: 'remove-other', value: 'correction', label: 'Other' }
    ],
    count: [
        { id: 'count-correction', value: 'correction', label: 'Stock Count Correction' },
        { id: 'count-audit', value: 'correction', label: 'End of Month Audit' },
        { id: 'count-other', value: 'correction', label: 'Other' }
    ]
};

type InventoryItemType = (Product & { itemType: 'product', stock: number }) | (RawIngredient & { itemType: 'ingredient', stock: number });

const StockAdjustmentPanel = ({ selectedItem, onSave, onCancel }: { selectedItem: { id: string, type: 'product' | 'ingredient' } | null; onSave: () => void; onCancel: () => void; }) => {
    const [mode, setMode] = useState<'add' | 'remove' | 'count' | null>(null);
    const [quantity, setQuantity] = useState('');
    const [actualCount, setActualCount] = useState('');
    const [reason, setReason] = useState('');
    const [note, setNote] = useState('');

    const { products, rawIngredients } = useStore();
    const { toast } = useToast();

    const scrollRef = useRef<ScrollAreaHandle>(null);

    const item = useMemo((): InventoryItemType | null => {
        if (!selectedItem) return null;

        if (selectedItem.type === 'product') {
            const product = products.find(p => p.id === selectedItem.id);
            return product ? { ...product, itemType: 'product', stock: product.stock } : null;
        } else {
            const ingredient = rawIngredients.find(i => i.id === selectedItem.id);
            return ingredient ? { ...ingredient, itemType: 'ingredient', stock: ingredient.stock_qty } : null;
        }
    }, [selectedItem, products, rawIngredients]);

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
            toast({ variant: 'destructive', title: 'Invalid', description: 'Please complete the form with a valid reason and quantity.' });
            return;
        }

        if (change === 0) {
            toast({ title: "No Changes", description: "Actual count matches system stock. No adjustment needed." });
            onSave();
            return;
        }

        try {
            const selectedOption = reasonOptions[mode].find(opt => opt.id === reason);
            if (!selectedOption) {
                toast({ variant: 'destructive', title: 'Invalid Reason', description: 'Please select a valid reason.' });
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
            } else {
                await adjustIngredientStock(item.id, selectedOption.value, change, adjustmentReason);
            }

            toast({ title: 'Stock Adjusted', description: `${item.name} stock has been updated to ${newStock}.` });
            onSave();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        }
    };

    return (
        <div className="flex flex-col h-full min-h-0">
            <div className="p-4">
                <h3 className="font-semibold text-lg">Manual Stock Adjustment</h3>
                {/* <p className="text-sm text-muted-foreground">Select an item from the list to begin.</p> */}
            </div>
            <div className="flex-1 min-h-0 flex flex-col relative">
                <ScrollShadow scrollRef={scrollRef} side="both" />
                <ScrollArea ref={scrollRef} className="flex-1 min-h-0 [&>[data-radix-scroll-area-viewport]>div]:!block [&>[data-radix-scroll-area-viewport]>div]:!h-full">
                    <div className="p-4 space-y-6 h-full">
                        {!item ? (
                            <Card className="h-full">
                                <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-full p-8">
                                    <Package className="w-12 h-12 mb-4" />
                                    <p>No item selected</p>
                                </div>
                            </Card>
                        ) : (
                            <>
                                <Card>
                                    <CardHeader>
                                        <CardTitle>{item.name}</CardTitle>
                                        <div className="flex justify-between items-center">
                                            <CardDescription>Current Stock: <span className="font-bold text-foreground">{item.stock}</span></CardDescription>
                                            <Badge variant="outline">
                                                {item.itemType === 'product' ? <Package className="h-3 w-3 mr-1.5" /> : <Beaker className="h-3 w-3 mr-1.5" />}
                                                {item.itemType}
                                            </Badge>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-2">

                                        <div>
                                            <Label>What happened?</Label>
                                            <ButtonGroup className="w-full mt-2">
                                                <Button variant={mode === 'add' ? 'success' : 'outline'} onClick={() => setMode('add')} className="flex-1 flex-col h-16">
                                                    <Plus className="w-5 h-5 mb-1" />
                                                    <span className="text-xs">Add Stock</span>
                                                </Button>
                                                <Button variant={mode === 'remove' ? 'destructive' : 'outline'} onClick={() => setMode('remove')} className="flex-1 flex-col h-16">
                                                    <Minus className="w-5 h-5 mb-1" />
                                                    <span className="text-xs">Remove Stock</span>
                                                </Button>
                                                <Button variant={mode === 'count' ? 'default' : 'outline'} onClick={() => setMode('count')} className="flex-1 flex-col h-16">
                                                    <Calculator className="w-5 h-5 mb-1" />
                                                    <span className="text-xs">Count Stock</span>
                                                </Button>
                                            </ButtonGroup>
                                        </div>

                                        {mode && (
                                            <div className="space-y-4 pt-4">
                                                {mode === 'add' || mode === 'remove' ? (
                                                    <div className="space-y-4">
                                                        <div className="space-y-2">
                                                            <Label htmlFor="quantity">Quantity to {mode}</Label>
                                                            <Input id="quantity" type="number" placeholder="Enter a positive number" value={quantity} onChange={(e) => setQuantity(e.target.value)} min="1" />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label htmlFor="reason-select">Reason</Label>
                                                            <Select value={reason} onValueChange={setReason}>
                                                                <SelectTrigger><SelectValue placeholder="Select a reason" /></SelectTrigger>
                                                                <SelectContent>
                                                                    {reasonOptions[mode].map(opt => <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>)}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-4">
                                                        <div className="space-y-2">
                                                            <Label htmlFor="actual-count">Actual Physical Count</Label>
                                                            <Input id="actual-count" type="number" placeholder="e.g. 142" value={actualCount} onChange={(e) => setActualCount(e.target.value)} />
                                                        </div>
                                                        {change !== 0 && (
                                                            <div className="space-y-2">
                                                                <Label htmlFor="reason-count">Reason for Difference</Label>
                                                                <Select value={reason} onValueChange={setReason}>
                                                                    <SelectTrigger><SelectValue placeholder="Select a reason" /></SelectTrigger>
                                                                    <SelectContent>
                                                                        {reasonOptions.count.map(opt => <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>)}
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                <div className="space-y-2">
                                                    <Label htmlFor="note">Note (Optional)</Label>
                                                    <Textarea id="note" placeholder="e.g., 'Box was found open'" value={note} onChange={e => setNote(e.target.value)} />
                                                </div>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>

                                {mode && change !== 0 && (
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-base">Adjustment Summary</CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Previous Stock</span>
                                                <span>{item.stock}</span>
                                            </div>
                                            <div className={cn("flex justify-between font-semibold", change > 0 ? "text-green-600" : "text-destructive")}>
                                                <span className="text-muted-foreground">Change</span>
                                                <span>{change > 0 ? `+${change}` : change}</span>
                                            </div>
                                            <Separator />
                                            <div className="flex justify-between font-bold text-lg">
                                                <span>New Stock</span>
                                                <span>{newStock}</span>
                                            </div>
                                            {newStock < 0 && (
                                                <p className="text-xs text-center pt-2 text-destructive font-semibold">⚠ This will result in negative stock.</p>
                                            )}
                                        </CardContent>
                                    </Card>
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
                        Cancel
                    </Button>
                }
                <Button className="flex-1" onClick={handleSubmit} disabled={!isFormValid || !item || (mode === 'count' && change === 0)}>Save Adjustment</Button>
            </div>
        </div>
    );
}


const ColumnClass = {
    name: "flex items-center gap-2 flex-1 min-w-0 h-full",
    type: "hidden sm:flex items-center w-24 px-2 border-l border-l-border/50 h-full",
    category: "hidden md:flex items-center text-sm text-muted-foreground truncate max-w-[160px] w-[160px] px-2 border-l border-l-border/50 h-full",
    stock: "flex flex-col items-end justify-center shrink-0 text-right tabular-nums whitespace-nowrap w-24 border-l border-l-border/50 h-full px-2"
}

const InventoryListItem = ({ item, isSelected, onItemClick, categories, isEven }: { item: InventoryItemType; isSelected: boolean; onItemClick: (item: InventoryItemType) => void; categories: Category[], isEven: boolean}) => {
    const categoryName = item.itemType === 'product' ? categories.find(c => c.id === item.category_id)?.name || 'N/A' : 'N/A';

    return (
        <div className="bg-card border-x border-b border-b-border/50 p-0 h-[56px]">
            <div
                data-item
                onClick={() => onItemClick(item)}
                className={cn(
                    "flex items-center px-4 transition-colors cursor-pointer  hover:bg-accent h-[56px]",
                    isSelected ? "bg-background" : isEven ? 'bg-border/20' : ''
                )}
            >
                <div className={ColumnClass.name}>
                    <p className="font-medium truncate">{item.name}</p>
                </div>
                <div className={ColumnClass.type}>
                    <Badge variant={item.itemType === 'product' ? 'success' : 'warning'} className="text-[10px] uppercase px-1.5 py-0">
                        {item.itemType}
                    </Badge>
                </div>
                <div className={ColumnClass.category}>
                    <span className="truncate">{categoryName}</span>
                </div>
                <div className={ColumnClass.stock}>
                    <p className="font-bold text-base">{item.stock}</p>
                </div>
            </div>
        </div>
    );
}


export default function InventoryPage() {
    const { products, rawIngredients, categories } = useStore();
    const { toast } = useToast();
    const [selectedItem, setSelectedItem] = useState<{ id: string; type: 'product' | 'ingredient' } | null>(null);
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const [filter, setFilter] = useState('all');

    const outerRef = useRef<HTMLDivElement>(null);
    const thumbRef = useRef<HTMLDivElement>(null);
    const trackRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isScrolling, setIsCrolling] = useState(false);

    const { query } = useProductSearch();

    const inventoryItems: InventoryItemType[] = useMemo(() => {
        const stockTrackedProducts = products.filter(p => p.track_stock).map(p => ({ ...p, itemType: 'product' as const, stock: p.stock }));
        const ingredients = rawIngredients.map(i => ({ ...i, itemType: 'ingredient' as const, stock: i.stock_qty }));

        let combined: InventoryItemType[] = [...stockTrackedProducts, ...ingredients];
        
        switch(filter) {
            case 'product':
                combined = combined.filter(item => item.itemType === 'product');
                break;
            case 'ingredient':
                combined = combined.filter(item => item.itemType === 'ingredient');
                break;
            case 'low_stock':
                combined = combined.filter(item => {
                    if (item.itemType === 'product') {
                        const p = item as Product;
                        return p.track_stock && p.low_stock_alert != null && p.stock > 0 && p.stock <= p.low_stock_alert;
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
        return combined.filter(p => p.name.toLowerCase().includes(query.toLowerCase()));
    }, [products, rawIngredients, query, filter]);

    const handleBarcodeScan = (barcode: string) => {
        const product = products.find(p => p.barcode === barcode);
        if (product) {
            if (!product.track_stock) {
                toast({
                    variant: "destructive",
                    title: "Untracked Product",
                    description: `"${product.name}" does not have stock tracking enabled.`,
                });
                return;
            }
            handleItemSelect({ ...product, itemType: 'product', stock: product.stock });
            toast({
                title: "Product Found",
                description: `Selected "${product.name}" for adjustment.`,
            });
        } else {
            toast({
                variant: "destructive",
                title: "Product Not Found",
                description: `No product found with barcode: ${barcode}`,
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
        <div className="w-full h-[calc(100vh-4rem)] md:grid md:grid-cols-10 min-h-0">
            <div className="col-span-10 md:col-span-6 lg:col-span-6 h-full flex flex-col min-h-0">
                <div className="flex flex-col gap-4 p-4">
                    <div className="flex items-center gap-2 ">
                        <div className="flex-grow">
                            <ProductSearchBar
                                onBarcodeScan={handleBarcodeScan}
                            />
                        </div>
                        <div className="md:hidden">
                            <Button onClick={handleOpenAdjustmentSheet}>
                                <PlusCircle className="mr-2 h-4 w-4" /> Adjustment
                            </Button>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 overflow-x-auto no-scrollbar">
                        <Button variant={filter === 'all' ? 'secondary' : 'outline'} onClick={() => setFilter('all')} className="rounded-full px-4 shrink-0">All</Button>
                        <Button variant={filter === 'product' ? 'secondary' : 'outline'} onClick={() => setFilter('product')} className="rounded-full px-4 shrink-0">Product</Button>
                        <Button variant={filter === 'ingredient' ? 'secondary' : 'outline'} onClick={() => setFilter('ingredient')} className="rounded-full px-4 shrink-0">Ingredient</Button>
                        
                        <Separator orientation="vertical" />

                        <Button variant={filter === 'low_stock' ? 'secondary' : 'outline'} onClick={() => setFilter('low_stock')} className="rounded-full px-4 shrink-0">Low Stock</Button>
                        <Button variant={filter === 'out_of_stock' ? 'secondary' : 'outline'} onClick={() => setFilter('out_of_stock')} className="rounded-full px-4 shrink-0">Out of Stock</Button>
                        <Button variant="outline" className="rounded-full px-4 shrink-0" disabled>New</Button>
                        <Button variant="outline" className="rounded-full px-4 shrink-0" disabled>No Sales</Button>
                    </div>
                </div>
                <div className="flex-1 bg-background h-full min-h-0 flex flex-col">
                    {inventoryItems.length > 0 ? (
                        <>
                            <div className="px-4 w-full">
                                <div className="rounded-t-lg h-12 w-full border bg-card flex items-center px-4">
                                    <div className={ColumnClass.name}>
                                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Item Name</span>
                                    </div>
                                    <div className={ColumnClass.type}>
                                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Type</span>
                                    </div>
                                    <div className={ColumnClass.category}>
                                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Category</span>
                                    </div>
                                    <div className={ColumnClass.stock}>
                                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Stock</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex-1 min-h-0 relative overflow-hidden" ref={containerRef}>
                                <div className={`absolute -top-px h-0 transition-opacity duration-150 pointer-events-none shadow border-b left-3 right-3 z-10 ${isScrolling ? 'opacity-100' : 'opacity-0'}`}></div>
                                <AutoSizer>
                                    {({ height, width }) => (
                                        <List
                                            itemKey={(index) => inventoryItems[index].id}
                                            className='no-scrollbar'
                                            outerRef={outerRef}
                                            height={height}
                                            width={width}
                                            itemCount={inventoryItems.length}
                                            itemSize={56}
                                        >
                                            {Row}
                                        </List>
                                    )}
                                </AutoSizer>
                                {/* Overlay Scrollbar */}
                                <div
                                    ref={trackRef}
                                    className="absolute right-2 top-0 bottom-0 w-2 opacity-0 transition-opacity duration-200 z-20"
                                >
                                    <div
                                        ref={thumbRef}
                                        className="absolute w-full rounded-full bg-border/40 hover:bg-border/70 cursor-pointer"
                                    />
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-full p-8">
                            <Package className="w-12 h-12 mb-4" />
                            <p>No inventory items found.</p>
                        </div>
                    )}
                </div>
            </div>

            <aside className="hidden md:block col-span-4 lg:col-span-4 h-full min-h-0">
                <StockAdjustmentPanel onSave={handleSave} onCancel={handleCancel} selectedItem={selectedItem} />
            </aside>

            <Sheet open={isSheetOpen} onOpenChange={handleSheetOpenChange}>
                <SheetContent side="right" className="w-full sm:w-[500px] p-0 flex flex-col h-full min-h-0">
                    <StockAdjustmentPanel onSave={handleSave} onCancel={handleCancel} selectedItem={selectedItem} />
                </SheetContent>
            </Sheet>
        </div>
    );
}
