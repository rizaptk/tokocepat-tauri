
"use client";

import { useState, useMemo, useEffect } from "react";
import * as z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useStore } from "@/lib/store";
import { Product, StockMovementType, Category } from "@/lib/types";
import { adjustStock } from "@/services/stockService";
import { useToast } from "@/hooks/use-toast";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ProductSearchBar } from "@/components/ProductSearchBar";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { PlusCircle } from "lucide-react";
import { ProductList } from "@/components/ProductList";
import type { ViewMode } from "@/app/cashier/page";
import { useGlobalBarcodeScanner } from "@/hooks/use-global-barcode-scanner";

// Form for the right panel / sheet content
const adjustmentFormSchema = z.object({
  product_id: z.string().min(1, "Please select a product."),
  type: z.enum(["restock", "correction", "lost", "damaged", "initial_balance"], { required_error: "Please select an adjustment type." }),
  qty_change: z.coerce.number().refine(val => val !== 0, "Quantity cannot be zero."),
  reason: z.string().min(3, "Please provide a reason for the adjustment."),
});
type AdjustmentFormValues = z.infer<typeof adjustmentFormSchema>;

const adjustmentTypes: { value: StockMovementType, label: string }[] = [
    { value: 'initial_balance', label: 'Opening Balance (+)' },
    { value: 'restock', label: 'Purchase / Restock (+)' },
    { value: 'correction', label: 'Correction (+/-)' },
    { value: 'lost', label: 'Lost (-)' },
    { value: 'damaged', label: 'Damaged (-)' },
];

const AdjustmentForm = ({ onSave, selectedProductId }: { onSave?: () => void, selectedProductId: string | null }) => {
    const { products } = useStore();
    const { toast } = useToast();
    const stockTrackedProducts = products.filter(p => p.track_stock);

    const form = useForm<AdjustmentFormValues>({
        resolver: zodResolver(adjustmentFormSchema),
        defaultValues: {
            product_id: "",
            qty_change: 0,
            reason: "",
        },
    });

    useEffect(() => {
        if (selectedProductId) {
            form.setValue('product_id', selectedProductId, { shouldValidate: true });
        } else {
             form.reset({
                product_id: "",
                qty_change: 0,
                reason: "",
            });
        }
    }, [selectedProductId, form]);

    async function onSubmit(data: AdjustmentFormValues) {
        try {
            await adjustStock(data);
            toast({
                title: "Stock Adjusted",
                description: `Inventory has been updated successfully.`,
            });
            form.reset();
            if (onSave) onSave();
        } catch (error) {
            console.error(error);
            toast({
                variant: "destructive",
                title: "Adjustment Failed",
                description: "There was an error saving the stock adjustment.",
            });
        }
    }

    return (
        <Card className="h-full border-0 md:border shadow-none md:shadow-sm bg-transparent md:bg-card">
            <CardHeader>
                <CardTitle>Manual Stock Adjustment</CardTitle>
                <CardDescription>Select a product from the list to begin, or scan its barcode.</CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="product_id"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Product</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value || ""} disabled={!selectedProductId}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a product from the list" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {stockTrackedProducts.map(p => (
                                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="type"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Adjustment Type</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value} disabled={!selectedProductId}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a type" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {adjustmentTypes.map(t => (
                                                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="qty_change"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Quantity Change</FormLabel>
                                    <FormControl>
                                        <Input type="number" placeholder="e.g., 10 or -5" {...field} disabled={!selectedProductId}/>
                                    </FormControl>
                                    <FormDescription>Use a negative number to decrease stock.</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="reason"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Reason</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="e.g., 'End of month stock count correction'" {...field} disabled={!selectedProductId}/>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button type="submit" className="w-full" disabled={!selectedProductId}>Save Adjustment</Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
    )
}

export default function InventoryPage() {
    const { products } = useStore();
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const [viewMode, setViewMode] = useState<ViewMode>('thumbnail');

     useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth < 768;
            setViewMode(mobile ? 'thumbnail' : 'list');
        };
        window.addEventListener('resize', handleResize);
        handleResize(); 
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleBarcodeScan = (barcode: string) => {
        const product = products.find(p => p.barcode === barcode);
        if (product) {
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

    const filteredProducts = useMemo(() => {
        return products
            .filter(p => p.track_stock)
            .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [products, searchTerm]);

    return (
        <div className="w-full h-[calc(100vh-4rem)] md:grid md:grid-cols-10">
            {/* Left Panel: Inventory List */}
            <div className="col-span-10 md:col-span-6 lg:col-span-7 h-full flex flex-col bg-muted/40">
                <div className="p-4 border-b bg-background flex items-center gap-2">
                    <div className="flex-grow">
                        <ProductSearchBar
                            searchTerm={searchTerm}
                            onSearchTermChange={setSearchTerm}
                            viewMode={viewMode}
                            onViewModeChange={setViewMode}
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
                        viewMode={viewMode}
                        context="inventory"
                        isLoading={products.length === 0}
                        onItemClick={handleProductSelect}
                        selectedProductId={selectedProductId}
                    />
                </div>
            </div>

            {/* Right Panel: Adjustment Form (Desktop) */}
            <aside className="hidden md:block col-span-4 lg:col-span-3 h-full p-4 bg-background">
               <AdjustmentForm onSave={() => setSelectedProductId(null)} selectedProductId={selectedProductId} />
            </aside>
            
            {/* Adjustment Form Sheet (Mobile) */}
             <Sheet open={isSheetOpen} onOpenChange={handleSheetOpenChange}>
                <SheetContent side="right" className="w-full sm:w-[500px] p-0">
                    <AdjustmentForm onSave={() => setIsSheetOpen(false)} selectedProductId={selectedProductId} />
                </SheetContent>
            </Sheet>
        </div>
    );
}
