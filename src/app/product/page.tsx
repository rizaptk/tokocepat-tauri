
"use client";

import { useState, useEffect, useMemo } from "react";
import { useStore } from "@/lib/store";
import { Product } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { useProductSearch } from "@/lib/useProductSearch";

// UI Components
import { Button } from "@/components/ui/button";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { ProductSearchBar } from "@/components/ProductSearchBar";
import { ProductList } from "@/components/ProductList";
import { exportBarcodeStickersToPdf } from "@/lib/export";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"


// Icons
import { PlusCircle, Printer } from "lucide-react";

// Services
import { useGlobalBarcodeScanner } from "@/hooks/use-global-barcode-scanner";

// Sub-components
import { ProductEditor } from "./_components/ProductEditor";
import { useSelectedProduct } from "@/lib/product-select-store";
import { Separator } from "@/components/ui/separator";


export default function ProductManagementPage() {
    const { products } = useStore();
    const { toast } = useToast();
    const [viewMode, setViewMode] = useState<"card" | "thumbnail" | "list">('card');
    const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [activeTab, setActiveTab] = useState("product");
    const { selectedIds: selectedProductIds } = useSelectedProduct();
    const [printOptions, setPrintOptions] = useState({
        repeat: 1,
        labelWidthMm: 38,
        labelHeightMm: 13,
        pageSizeName: 'A4',
    });
    const [filter, setFilter] = useState('all');
    const { query } = useProductSearch();

    const paperSizeMap: Record<string, [number, number] | undefined> = {
        'A4': [595.28, 841.89],
        'Letter': [612, 792],
    };
    
    const displayedProducts = useMemo(() => {
        let items = [...products];

        // Apply primary filter
        if (filter === 'all') {
            return items.filter(p => p.is_active);
        }
        if (filter === 'retail') {
            return items.filter(p => p.product_type === 'retail' && p.is_active);
        }
        if (filter === 'f&b') {
            return items.filter(p => p.product_type === 'food_and_beverage' && p.is_active);
        }
        if (filter === 'variants') {
            return items.filter(p => p.has_variant && p.is_active);
        }
        if (filter === 'modifiers') {
            return items.filter(p => p.has_modifier && p.is_active);
        }
        if (filter === 'inactive') {
            return items.filter(p => !p.is_active);
        }
        return items;

    }, [products, filter]);

    useEffect(() => {
        setViewMode(window.innerWidth < 768 ? 'thumbnail' : 'card');
    }, []);

    const handleSelectProduct = (product: Product) => {
        setSelectedProductId(product.id);
        setActiveTab("product");
        if (window.innerWidth < 768) {
            setIsDrawerOpen(true);
        }
    };
    
    const handlePrintLabels = () => {
        const selectedProducts = products.filter(p => selectedProductIds.has(p.id) && p.barcode);
        if (selectedProducts.length > 0) {
            exportBarcodeStickersToPdf(selectedProducts, {
                repeat: printOptions.repeat,
                labelWidthMm: printOptions.labelWidthMm,
                labelHeightMm: printOptions.labelHeightMm,
                pageSize: paperSizeMap[printOptions.pageSizeName],
            });
        } else {
            toast({
                variant: "destructive",
                title: "No Products Selected",
                description: "Please select products with barcodes to print labels for.",
            });
        }
    };


    const handleBarcodeScan = (barcode: string) => {
        const product = products.find(p => p.barcode === barcode || p.sku === barcode);
        if (product) {
            handleSelectProduct(product);
            toast({
                title: "Product Found",
                description: `Now editing "${product.name}".`,
            });
        } else {
            toast({
                variant: "destructive",
                title: "Product Not Found",
                description: `No product found with barcode/SKU: ${barcode}`,
            });
        }
    };

    useGlobalBarcodeScanner({ onScan: handleBarcodeScan });

    const handleAddNew = () => {
        setSelectedProductId(null);
        setActiveTab("product");
        setIsDrawerOpen(true);
    }

    const handleSaveChanges = () => {
        setSelectedProductId(null);
        // data will refetch via zustand listener, no need for manual refresh
        if (window.innerWidth < 768) {
            setIsDrawerOpen(false);
        }
    }
    
    const handleCloseEditor = () => {
        setSelectedProductId(null);
         if (window.innerWidth < 768) {
            setIsDrawerOpen(false);
        }
    }

    const popoverContent = (
        <PopoverContent className="w-80">
            <div className="grid gap-4">
                <div className="space-y-2">
                    <h4 className="font-medium leading-none">Print Labels</h4>
                    <p className="text-sm text-muted-foreground">
                        Set the options for printing labels.
                    </p>
                </div>
                <div className="grid gap-2">
                    <div className="grid grid-cols-3 items-center gap-4">
                        <Label htmlFor="repeat">Repeat</Label>
                        <Input
                            id="repeat"
                            type="number"
                            defaultValue={printOptions.repeat}
                            onChange={(e) => setPrintOptions(o => ({ ...o, repeat: parseInt(e.target.value) || 1 }))}
                            className="col-span-2 h-8"
                        />
                    </div>
                    <div className="grid grid-cols-3 items-center gap-4">
                        <Label>Label Size</Label>
                        <div className="col-span-2 flex gap-1">
                            <Input
                                id="labelWidth"
                                type="number"
                                placeholder="W"
                                defaultValue={printOptions.labelWidthMm}
                                onChange={(e) => setPrintOptions(o => ({ ...o, labelWidthMm: parseInt(e.target.value) || 38 }))}
                                className="h-8"
                            />
                             <Input
                                id="labelHeight"
                                type="number"
                                placeholder="H"
                                defaultValue={printOptions.labelHeightMm}
                                onChange={(e) => setPrintOptions(o => ({ ...o, labelHeightMm: parseInt(e.target.value) || 13 }))}
                                className="h-8"
                            />
                        </div>
                    </div>
                     <div className="grid grid-cols-3 items-center gap-4">
                        <Label htmlFor="pageSize">Paper Size</Label>
                        <Select
                            defaultValue={printOptions.pageSizeName}
                            onValueChange={(value) => setPrintOptions(o => ({...o, pageSizeName: value}))}
                        >
                            <SelectTrigger className="col-span-2 h-8">
                                <SelectValue placeholder="Select paper size" />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.keys(paperSizeMap).map(name => (
                                    <SelectItem key={name} value={name}>{name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <Button onClick={handlePrintLabels} className="w-full">
                    <Printer className="mr-2 h-4 w-4" /> Print ({selectedProductIds.size})
                </Button>
            </div>
        </PopoverContent>
    );

    return (
        <div className="w-full h-[calc(100vh-64px)] md:grid md:grid-cols-10 min-h-0 flex-1">
            {/* Left Panel: Product List */}
            <div className="col-span-10 md:col-span-5 lg:col-span-6 h-full flex flex-col min-h-0">
                <div className="p-4 flex flex-col w-full gap-4">
                    <div className="flex items-center gap-2">
                        <ProductSearchBar
                            viewMode={viewMode}
                            onViewModeChange={setViewMode}
                            onBarcodeScan={handleBarcodeScan}
                        />
                        {
                            selectedProductIds.size > 0 && (
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" size="sm" className="hidden md:flex relative rounded-full size-10">
                                            <Printer className="h-5 w-5" />
                                            <div className="text-[10px] grid place-items-center leading-none absolute -top-0.5 -right-0.5 bg-destructive rounded-full text-destructive-foreground size-4">
                                            {selectedProductIds.size}
                                            </div>
                                        </Button>
                                    </PopoverTrigger>
                                    {popoverContent}
                                </Popover>
                            )
                        }
                        <Button onClick={handleAddNew} variant="outline" size="sm" className="md:hidden inline-flex size-10">
                            <PlusCircle className="h-4 w-4" />
                        </Button>
                    </div>

                    <div className="flex items-center gap-4 overflow-x-auto no-scrollbar">
                        <Button variant={filter === 'all' ? 'secondary' : 'outline'} className="rounded-full px-4 shrink-0" onClick={() => setFilter('all')}>All Active</Button>
                        <Button variant={filter === 'retail' ? 'secondary' : 'outline'} className="rounded-full px-4 shrink-0" onClick={() => setFilter('retail')}>Retail</Button>
                        <Button variant={filter === 'f&b' ? 'secondary' : 'outline'} className="rounded-full px-4 shrink-0" onClick={() => setFilter('f&b')}>F&B</Button>
                        <Separator orientation="vertical" />
                        <Button variant={filter === 'variants' ? 'secondary' : 'outline'} className="rounded-full px-4 shrink-0" onClick={() => setFilter('variants')}>Variants</Button>
                        <Button variant={filter === 'modifiers' ? 'secondary' : 'outline'} className="rounded-full px-4 shrink-0" onClick={() => setFilter('modifiers')}>Modifiers</Button>
                        <Button variant={filter === 'inactive' ? 'secondary' : 'outline'} className="rounded-full px-4 shrink-0" onClick={() => setFilter('inactive')}>Inactive</Button>
                    </div>

                </div>
                <div className="flex-grow">
                    <ProductList
                        products={displayedProducts}
                        viewMode={viewMode}
                        onItemClick={handleSelectProduct}
                        selectedProductId={selectedProductId}
                        context="product"
                    />
                </div>
                <div className="p-4 md:hidden flex gap-2">
                     <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full" disabled={selectedProductIds.size === 0}>
                                <Printer className="mr-2 h-4 w-4" />
                                Print ({selectedProductIds.size})
                            </Button>
                        </PopoverTrigger>
                        {popoverContent}
                     </Popover>
                    <Button onClick={handleAddNew} className="w-full">
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Product
                    </Button>
                </div>
            </div>

            {/* Right Panel: Editor (Desktop) */}
            <aside className="hidden md:block col-span-4 lg:col-span-4 md:col-span-5 h-full min-h-0">
                <ProductEditor
                    selectedProductId={selectedProductId}
                    onProductUpdate={handleSaveChanges}
                    onClose={handleCloseEditor}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                />
            </aside>

            {/* Editor Drawer (Mobile) */}
            <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
                <SheetContent side="right" className="w-full sm:w-[500px] p-0 flex flex-col">
                    <SheetHeader className="p-4 border-b shrink-0">
                        <SheetTitle>{selectedProductId ? 'Edit Product' : 'Add New Product'}</SheetTitle>
                    </SheetHeader>
                    <ProductEditor
                        selectedProductId={selectedProductId}
                        onProductUpdate={handleSaveChanges}
                        onClose={handleCloseEditor}
                        activeTab={activeTab}
                        onTabChange={setActiveTab}
                    />
                </SheetContent>
            </Sheet>
        </div>
    );
}
