'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Library } from "lucide-react";
import { ProductForm } from './ProductForm';
import { CategoryManager } from './managers/CategoryManager';
import type { CatalogProduct } from "@/lib/types";

interface ProductEditorProps {
    selectedProductId: string | null;
    onProductUpdate: () => void;
    onClose: () => void;
    activeTab: string;
    onTabChange: (tab: string) => void;
    catalogPrefill?: CatalogProduct | null;
}

export const ProductEditor = ({ selectedProductId, onProductUpdate, onClose, activeTab, onTabChange, catalogPrefill }: ProductEditorProps) => {
    return (
        <Tabs value={activeTab} onValueChange={onTabChange} className="h-full flex flex-col min-h-0">
            <div className="px-3 py-2 grid grid-cols-1 shrink-0 border-b border-border/60">
                <TabsList className="grid w-full grid-cols-2 min-w-96">
                    <TabsTrigger value="product"><Package className="w-3.5 h-3.5 mr-2 text-primary" />Produk</TabsTrigger>
                    <TabsTrigger value="categories"><Library className="w-3.5 h-3.5 mr-2 text-destructive" />Kategori</TabsTrigger>
                </TabsList>
            </div>
            <TabsContent value="product" className="grid grid-cols-1 w-full mt-0 overflow-x-auto min-h-0">
                <ProductForm productId={selectedProductId} onSave={onProductUpdate} onCancel={onClose} catalogPrefill={catalogPrefill} />
            </TabsContent>
            <TabsContent value="categories" className="grid grid-cols-1 w-full mt-0 overflow-x-auto min-h-0">
                <CategoryManager />
            </TabsContent>
        </Tabs>
    );
};
