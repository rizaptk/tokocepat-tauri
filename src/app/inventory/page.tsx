
"use client";

import { useState, useMemo, useEffect } from "react";
import { useStore } from "@/lib/store";
import { Product, StockMovementType } from "@/lib/types";
import { adjustStock } from "@/services/stockService";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ProductSearchBar } from "@/components/ProductSearchBar";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { PlusCircle, Plus, Minus, Calculator, Package } from "lucide-react";
import { ProductList } from "@/components/ProductList";
import type { ViewMode } from "@/app/cashier/page";
import { useGlobalBarcodeScanner } from "@/hooks/use-global-barcode-scanner";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useSettingsStore } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";


const reasonOptions: Record<'add' | 'remove' | 'count', { value: StockMovementType, label: string }[]> = {
    add: [
        { value: 'restock', label: 'New Purchase / Restock' },
        { value: 'initial_balance', label: 'Opening Stock' },
        { value: 'correction', label: 'Customer Return' },
        { value: 'correction', label: 'Other' }
    ],
    remove: [
        { value: 'damaged', label: 'Damaged' },
        { value: 'lost', label: 'Lost / Stolen' },
        { value: 'correction', label: 'Internal Use' },
        { value: 'correction', label: 'Other' }
    ],
    count: [
        { value: 'correction', label: 'Stock Count Correction' },
        { value: 'correction', label: 'End of Month Audit' },
        { value: 'correction', label: 'Other' }
    ]
};

const StockAdjustmentPanel = ({ selectedProductId, onSave }: { selectedProductId: string | null; onSave: () => void; }) => {
    const [mode, setMode] = useState<'add' | 'remove' | 'count' | null>(null);
    const [quantity, setQuantity] = useState('');
    const [actualCount, setActualCount] = useState('');
    const [reason, setReason] = useState('');
    const [note, setNote] = useState('');

    const { products } = useStore();
    const { toast } = useToast();

    const product = useMemo(() => {
        if (!selectedProductId) return null;
        return products.find(p => p.id === selectedProductId);
    }, [selectedProductId, products]);

    // Reset form state when product changes
    useEffect(() => {
        if (selectedProductId) {
            setMode(null);
            setQuantity('');
            setActualCount('');
            setReason('');
            setNote('');
        }
    }, [selectedProductId]);

    // Calculate change and new stock for the preview
    const { change, newStock, isFormValid } = useMemo(() => {
        if (!product || !mode) return { change: 0, newStock: 0, isFormValid: false };

        const currentStock = product.stock;
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
    }, [mode, quantity, actualCount, reason, product]);

    const handleSubmit = async () => {
        if (!isFormValid || !product) {
            toast({ variant: 'destructive', title: 'Invalid', description: 'Please complete the form with a valid reason and quantity.' });
            return;
        }

        if (change === 0) {
            toast({ title: "No Changes", description: "Actual count matches system stock. No adjustment needed." });
            onSave();
            return;
        }

        try {
            const finalReason = reasonOptions[mode!]?.find(r => r.value === reason)?.label || 'Adjustment';
            await adjustStock({
                product_id: product.id,
                type: reason as StockMovementType,
                qty_change: change,
                reason: note ? `${finalReason}: ${note}` : finalReason,
            });
            toast({ title: 'Stock Adjusted', description: `${product.name} stock has been updated to ${newStock}.` });
            onSave();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        }
    };
    
    return (
        <div className="flex flex-col h-full">
            <div className="p-4 border-b">
                <h3 className="font-semibold text-lg">Manual Stock Adjustment</h3>
                <p className="text-sm text-muted-foreground">Select a product from the list to begin.</p>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {!product ? (
                    <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-full p-8 border border-dashed rounded-lg">
                        <Package className="w-12 h-12 mb-4" />
                        <p>No product selected</p>
                    </div>
                ) : (
                    <>
                        {/* Product Detail */}
                        <Card>
                             <CardHeader>
                                <CardTitle>{product.name}</CardTitle>
                                <CardDescription>Current Stock: <span className="font-bold text-foreground">{product.stock}</span></CardDescription>
                            </CardHeader>
                        </Card>
                        
                        {/* Actions */}
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

                        {/* Dynamic Form Area */}
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
                                                    {reasonOptions[mode].map(opt => <SelectItem key={opt.label} value={opt.value}>{opt.label}</SelectItem>)}
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
                                                        {reasonOptions.count.map(opt => <SelectItem key={opt.label} value={opt.value}>{opt.label}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        )}
                                    </div>
                                )}
                                 <div className="space-y-2">
                                    <Label htmlFor="note">Note (Optional)</Label>
                                    <Textarea id="note" placeholder="e.g., 'Box was found open'" value={note} onChange={e => setSetNote(e.target.value)} />
                                </div>
                            </div>
                        )}
                        
                        {/* Adjustment Preview */}
                        {mode && change !== 0 && (
                            <Card className="bg-muted/50">
                                <CardHeader>
                                    <CardTitle className="text-base">Adjustment Summary</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Previous Stock</span>
                                        <span>{product.stock}</span>
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
                 <Button className="w-full" onClick={handleSubmit} disabled={!isFormValid || !product || (mode === 'count' && change === 0)}>Save Adjustment</Button>
            </div>
        </div>
    );
}

export default function InventoryPage() {
    const { products } = useStore();
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
    const [isSheetOpen, setIsSheetOpen] = useState(false);

    const { showMode, setShowMode } = useSettingsStore();

     useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth < 768;
            setShowMode({inventory: mobile ? 'thumbnail' : 'list'});
        };
        window.addEventListener('resize', handleResize);
        handleResize(); 
        return () => window.removeEventListener('resize', handleResize);
    }, [setShowMode]);

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
            setSelectedProductId(product.id);
             toast({
                title: "Product Found",
                description: `Selected "${product.name}" for adjustment.`,
            });
            if (window.innerWidth < 768) {
                setIsSheetOpen(true);
            }
        } else {
            toast({
                variant: "destructive",
                title: "Product Not Found",
                description: `No product found with barcode: ${barcode}`,
            });
        }
    };

    useGlobalBarcodeScanner({ onScan: handleBarcodeScan });

    const handleProductSelect = (product: Product) => {
        setSelectedProductId(product.id);
        if (window.innerWidth < 768) {
            setIsSheetOpen(true);
        }
    };

    const handleOpenAdjustmentSheet = () => {
        setSelectedProductId(null);
        setIsSheetOpen(true);
    };

    const handleSheetOpenChange = (isOpen: boolean) => {
        setIsSheetOpen(isOpen);
        if (!isOpen) {
            setSelectedProductId(null);
        }
    }
    
    const handleSave = () => {
        setSelectedProductId(null);
        if (window.innerWidth < 768) {
            setIsSheetOpen(false);
        }
    }

    const filteredProducts = useMemo(() => {
        return products
            .filter(p => p.track_stock)
            .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [products, searchTerm]);

    return (
        <div className="w-full h-[calc(100vh-4rem)] md:grid md:grid-cols-10 min-h-0">
            {/* Left Panel: Inventory List */}
            <div className="col-span-10 md:col-span-6 lg:col-span-6 h-full flex flex-col bg-muted/40">
                <div className="p-4 border-b bg-muted/40 flex items-center gap-2 ">
                    <div className="flex-grow">
                        <ProductSearchBar
                            searchTerm={searchTerm}
                            onSearchTermChange={setSearchTerm}
                            viewMode={showMode.inventory}
                            onViewModeChange={(view) => setShowMode({inventory: view})}
                            onBarcodeScan={handleBarcodeScan}
                        />
                    </div>
                     <div className="md:hidden">
                        <Button onClick={handleOpenAdjustmentSheet}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Adjustment
                        </Button>
                    </div>
                </div>
                <div className="flex-grow bg-background">
                    <ProductList 
                        products={filteredProducts}
                        viewMode={showMode.inventory}
                        context="inventory"
                        isLoading={products.length === 0}
                        onItemClick={handleProductSelect}
                        selectedProductId={selectedProductId}
                    />
                </div>
            </div>

            {/* Right Panel: Adjustment Form (Desktop) */}
            <aside className="hidden md:block col-span-4 lg:col-span-4 h-full bg-background min-h-0 border-l">
               <StockAdjustmentPanel onSave={handleSave} selectedProductId={selectedProductId} />
            </aside>
            
            {/* Adjustment Form Sheet (Mobile) */}
             <Sheet open={isSheetOpen} onOpenChange={handleSheetOpenChange}>
                <SheetContent side="right" className="w-full sm:w-[500px] p-0 flex flex-col h-full min-h-0">
                    <StockAdjustmentPanel onSave={handleSave} selectedProductId={selectedProductId} />
                </SheetContent>
            </Sheet>
        </div>
    );
}
