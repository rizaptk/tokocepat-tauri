'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Library, SlidersHorizontal, Beaker } from "lucide-react";
import { ProductForm } from './ProductForm';
import { CategoryManager } from './managers/CategoryManager';
import { ModifierManager } from './managers/ModifierManager';
import { IngredientManager } from './managers/IngredientManager';

interface ProductEditorProps {
    selectedProductId: string | null;
    onProductUpdate: () => void;
    onClose: () => void;
    activeTab: string;
    onTabChange: (tab: string) => void;
}

export const ProductEditor = ({ selectedProductId, onProductUpdate, onClose, activeTab, onTabChange }: ProductEditorProps) => {
    return (
        <Tabs value={activeTab} onValueChange={onTabChange} className="h-full flex flex-col min-h-0">
            <div className="px-4 py-4 grid grid-cols-1 w-full overflow-x-auto shrink-0">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="product"><Package className="w-4 h-4 mr-2 text-primary" />Product</TabsTrigger>
                    <TabsTrigger value="categories"><Library className="w-4 h-4 mr-2 text-destructive" />Categories</TabsTrigger>
                    <TabsTrigger value="modifiers"><SlidersHorizontal className="w-4 h-4 mr-2 text-purple-500" />Modifiers</TabsTrigger>
                    <TabsTrigger value="ingredients"><Beaker className="w-4 h-4 mr-2 text-green-600" />Ingredients</TabsTrigger>
                </TabsList>
            </div>
            <TabsContent value="product" className="grid grid-cols-1 w-full mt-0 overflow-x-auto min-h-0">
                <ProductForm productId={selectedProductId} onSave={onProductUpdate} onCancel={onClose} />
            </TabsContent>
            <TabsContent value="categories" className="grid grid-cols-1 w-full mt-0 overflow-x-auto min-h-0">
                <CategoryManager />
            </TabsContent>
            <TabsContent value="modifiers" className="grid grid-cols-1 w-full mt-0 overflow-x-auto min-h-0">
                <ModifierManager />
            </TabsContent>
            <TabsContent value="ingredients" className="grid grid-cols-1 w-full mt-0 overflow-x-auto min-h-0">
                <IngredientManager />
            </TabsContent>
        </Tabs>
    );
};
