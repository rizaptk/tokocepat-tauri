
"use client";

import { useState, useMemo, useEffect } from "react";
import { useStore } from "@/lib/store";
import { Product, StockMovementType, RawIngredient, Category } from "@/lib/types";
import { adjustStock, adjustIngredientStock } from "@/services/stockService";
import { useToast } from "@/hooks/use-toast";
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ProductSearchBar } from "@/components/ProductSearchBar";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { PlusCircle, Plus, Minus, Calculator, Package, Beaker } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useGlobalBarcodeScanner } from "@/hooks/use-global-barcode-scanner";
import { useSettingsStore } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";


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

const StockAdjustmentPanel = ({ selectedItem, onSave }: { selectedItem: { id: string, type: 'product' | 'ingredient' } | null; onSave: () => void; }) => {
    const [mode, setMode] = useState<'add' | 'remove' | 'count' | null>(null);
    const [quantity, setQuantity] = useState('');
    const [actualCount, setActualCount] = useState('');
    const [reason, setReason] = useState('');
    const [note, setNote] = useState('');

    const { products, rawIngredients } = useStore();
    const { toast } = useToast();

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
        <div className="flex flex-col h-full">
            <div className="p-4 border-b">
                <h3 className="font-semibold text-lg">Manual Stock Adjustment</h3>
                <p className="text-sm text-muted-foreground">Select an item from the list to begin.</p>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {!item ? (
                    <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-full p-8 border border-dashed rounded-lg">
                        <Package className="w-12 h-12 mb-4" />
                        <p>No item selected</p>
                    </div>
                ) : (
                    <>
                        <Card>
                             <CardHeader>
                                <CardTitle>{item.name}</CardTitle>
                                <div className="flex justify-between items-center">
                                    <CardDescription>Current Stock: <span className="font-bold text-foreground">{item.stock}</span></CardDescription>
                                     <Badge variant="outline">
                                        {item.itemType === 'product' ? <Package className="h-3 w-3 mr-1.5"/> : <Beaker className="h-3 w-3 mr-1.5"/>}
                                        {item.itemType}
                                    </Badge>
                                </div>
                            </CardHeader>
                        </Card>
                        
                        <div>
                            <Label>What happened?</Label>
                            <div className="grid grid-cols-3 gap-2 mt-2">
                                <Button variant={mode === 'add' ? 'default' : 'outline'} onClick={() => setMode('add')} className="flex-col h-16 bg-green-500/10 border-green-500 text-green-700 hover:bg-green-500/20 hover:text-green-800 data-[state=active]:bg-green-500 data-[state=active]:text-white">
                                    <Plus className="w-5 h-5 mb-1" />
                                    <span className="text-xs">Add Stock</span>
                                </Button>
                                 <Button variant={mode === 'remove' ? 'destructive' : 'outline'} onClick={() => setMode('remove')} className="flex-col h-16">
                                    <Minus className="w-5 h-5 mb-1" />
                                     <span className="text-xs">Remove Stock</span>
                                </Button>
                                 <Button variant={mode === 'count' ? 'default' : 'outline'} onClick={() => setMode('count')} className="flex-col h-16 bg-blue-500/10 border-blue-500 text-blue-700 hover:bg-blue-500/20 hover:text-blue-800 data-[state=active]:bg-blue-500 data-[state=active]:text-white">
                                    <Calculator className="w-5 h-5 mb-1" />
                                    <span className="text-xs">Count Stock</span>
                                </Button>
                            </div>
                        </div>

                        {mode && (
                            <div className="space-y-4 pt-4 border-t">
                                {mode === 'add' || mode === 'remove' ? (
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="quantity">Quantity to {mode}</Label>
                                            <Input id="quantity" type="number" placeholder="Enter a positive number" value={quantity} onChange={(e) => setQuantity(e.target.value)} min="1"/>
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
                        
                        {mode && change !== 0 && (
                            <Card className="bg-muted/50">
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
            
            <div className="p-4 border-t mt-auto">
                 <Button className="w-full" onClick={handleSubmit} disabled={!isFormValid || !item || (mode === 'count' && change === 0)}>Save Adjustment</Button>
            </div>
        </div>
    );
}

const InventoryListItem = ({ item, isSelected, onItemClick, categories }: { item: InventoryItemType; isSelected: boolean; onItemClick: (item: InventoryItemType) => void; categories: Category[] }) => {
    const categoryName = item.itemType === 'product' ? categories.find(c => c.id === item.category_id)?.name || 'N/A' : 'N/A';
    
    return (
        <div
            onClick={() => onItemClick(item)}
            className={cn(
                "flex items-center p-4 border-b transition-colors cursor-pointer",
                isSelected ? "bg-primary/10 border-l-4 border-l-primary" : "hover:bg-accent"
            )}
        >
            <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{item.name}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant={item.itemType === 'product' ? 'secondary' : 'outline'} className="text-xs">{item.itemType}</Badge>
                    {item.itemType === 'product' && <span>{categoryName}</span>}
                </div>
            </div>
            <div className="w-24 text-right">
                <p className="font-bold text-lg">{item.stock}</p>
                <p className="text-xs text-muted-foreground">in stock</p>
            </div>
        </div>
    );
}


export default function InventoryPage() {
    const { products, rawIngredients, categories } = useStore();
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedItem, setSelectedItem] = useState<{ id: string; type: 'product' | 'ingredient' } | null>(null);
    const [isSheetOpen, setIsSheetOpen] = useState(false);

    const inventoryItems: InventoryItemType[] = useMemo(() => {
        const stockTrackedProducts = products.filter(p => p.track_stock).map(p => ({ ...p, itemType: 'product' as const, stock: p.stock }));
        const ingredients = rawIngredients.map(i => ({ ...i, itemType: 'ingredient' as const, stock: i.stock_qty }));
        
        const combined = [...stockTrackedProducts, ...ingredients];
        
        if (!searchTerm.trim()) return combined;
        return combined.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [products, rawIngredients, searchTerm]);

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
    
    const Row = ({ index, style }: { index: number, style: React.CSSProperties }) => (
        <div style={style}>
            <InventoryListItem 
                item={inventoryItems[index]}
                isSelected={selectedItem?.id === inventoryItems[index].id}
                onItemClick={handleItemSelect}
                categories={categories}
            />
        </div>
    );

    return (
        <div className="w-full h-[calc(100vh-4rem)] md:grid md:grid-cols-10 min-h-0">
            <div className="col-span-10 md:col-span-6 lg:col-span-6 h-full flex flex-col bg-muted/40">
                <div className="p-4 border-b bg-muted/40 flex items-center gap-2 ">
                    <div className="flex-grow">
                        <ProductSearchBar
                            searchTerm={searchTerm}
                            onSearchTermChange={setSearchTerm}
                            onBarcodeScan={handleBarcodeScan}
                        />
                    </div>
                     <div className="md:hidden">
                        <Button onClick={handleOpenAdjustmentSheet}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Adjustment
                        </Button>
                    </div>
                </div>
                <div className="flex-grow bg-background h-full">
                    {inventoryItems.length > 0 ? (
                        <AutoSizer>
                            {({ height, width }) => (
                                <List
                                    height={height}
                                    width={width}
                                    itemCount={inventoryItems.length}
                                    itemSize={73} // Height of InventoryListItem (p-4 + border-b)
                                >
                                    {Row}
                                </List>
                            )}
                        </AutoSizer>
                    ) : (
                         <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-full p-8">
                            <Package className="w-12 h-12 mb-4" />
                            <p>No inventory items found.</p>
                        </div>
                    )}
                </div>
            </div>

            <aside className="hidden md:block col-span-4 lg:col-span-4 h-full bg-background min-h-0 border-l">
               <StockAdjustmentPanel onSave={handleSave} selectedItem={selectedItem} />
            </aside>
            
             <Sheet open={isSheetOpen} onOpenChange={handleSheetOpenChange}>
                <SheetContent side="right" className="w-full sm:w-[500px] p-0 flex flex-col h-full min-h-0">
                    <StockAdjustmentPanel onSave={handleSave} selectedItem={selectedItem} />
                </SheetContent>
            </Sheet>
        </div>
    );
}
