
"use client";

import { useState, useEffect } from "react";
import { useStore } from "@/lib/store";
import { Product } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

// UI Components
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ProductSearchBar } from "@/components/ProductSearchBar";
import { ProductList } from "@/components/ProductList";

// Icons
import { PlusCircle, Menu } from "lucide-react";

// Services
import { useGlobalBarcodeScanner } from "@/hooks/use-global-barcode-scanner";

// Sub-components
import { ProductEditor } from "./_components/ProductEditor";


export default function ProductManagementPage() {
    const { products } = useStore();
    const { toast } = useToast();
    const [viewMode, setViewMode] = useState<"card" | "thumbnail" | "list">('card');
    const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [activeTab, setActiveTab] = useState("product");

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

    return (
        <div className="w-full h-[calc(100vh-64px)] md:grid md:grid-cols-10 min-h-0 flex-1">
            {/* Left Panel: Product List */}
            <div className="col-span-10 md:col-span-5 lg:col-span-6 h-full flex flex-col min-h-0">
                <div className="p-4">
                    <div className="flex items-center gap-2">
                        <ProductSearchBar
                            viewMode={viewMode}
                            onViewModeChange={setViewMode}
                            onBarcodeScan={handleBarcodeScan}
                        />
                        <Button onClick={handleAddNew} variant="outline" size="sm" className="md:hidden inline-flex size-10">
                            <PlusCircle className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
                <div className="flex-grow">
                    <ProductList
                        products={products}
                        viewMode={viewMode}
                        onItemClick={handleSelectProduct}
                        selectedProductId={selectedProductId}
                        context="product"
                    />
                </div>
                <div className="p-4 md:hidden flex gap-2">
                    <Button onClick={handleAddNew} className="w-full">
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Product
                    </Button>
                    <Button variant="outline" onClick={() => setIsDrawerOpen(true)} className="w-full">
                        <Menu className="mr-2 h-4 w-4" /> Manage
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
                <SheetContent side="right" className="w-full sm:w-[500px] p-0">
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
