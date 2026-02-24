
"use client";

import { useState, useMemo } from "react";
import * as z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useStore } from "@/lib/store";
import { Product, StockMovementType, Category } from "@/lib/types";
import { adjustStock } from "@/services/stockService";
import { useToast } from "@/hooks/use-toast";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ProductSearchBar } from "@/components/ProductSearchBar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { SlidersHorizontal, PlusCircle } from "lucide-react";

// Form for the right panel / sheet content
const adjustmentFormSchema = z.object({
  product_id: z.string().min(1, "Please select a product."),
  type: z.enum(["restock", "correction", "lost", "damaged"], { required_error: "Please select an adjustment type." }),
  qty_change: z.coerce.number().refine(val => val !== 0, "Quantity cannot be zero."),
  reason: z.string().min(3, "Please provide a reason for the adjustment."),
});
type AdjustmentFormValues = z.infer<typeof adjustmentFormSchema>;

const adjustmentTypes: { value: StockMovementType, label: string }[] = [
    { value: 'restock', label: 'Restock (+)' },
    { value: 'correction', label: 'Correction (+/-)' },
    { value: 'lost', label: 'Lost (-)' },
    { value: 'damaged', label: 'Damaged (-)' },
];

const AdjustmentForm = ({ onSave }: { onSave?: () => void }) => {
    const { products } = useStore();
    const { toast } = useToast();
    const stockTrackedProducts = products.filter(p => p.track_stock);

    const form = useForm<AdjustmentFormValues>({
        resolver: zodResolver(adjustmentFormSchema),
        defaultValues: {
            qty_change: 0,
            reason: "",
        },
    });

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
                <CardDescription>Record a change in stock for any product.</CardDescription>
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
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a product to adjust" />
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
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                                        <Input type="number" placeholder="e.g., 10 or -5" {...field} />
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
                                        <Textarea placeholder="e.g., 'End of month stock count correction'" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button type="submit" className="w-full">Save Adjustment</Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
    )
}

// List item for the left panel
const InventoryListItem = ({ product, category }: { product: Product, category?: Category }) => {
    const isLowStock = product.low_stock_alert ? product.stock <= product.low_stock_alert : false;
    return (
        <div className="flex items-center gap-4 p-3 border-b">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md">
                <Image
                    src={product.imageUrl}
                    alt={product.name}
                    fill
                    sizes="64px"
                    className="object-cover"
                    data-ai-hint={product.imageHint}
                />
            </div>
            <div className="flex-1">
                <p className="font-medium line-clamp-2">{product.name}</p>
                {category && <Badge variant="outline" className="mt-1">{category.name}</Badge>}
            </div>
            <div className="text-right">
                <p className={cn("text-xl font-bold", isLowStock ? "text-destructive" : "text-foreground")}>
                    {product.stock}
                </p>
                <p className="text-xs text-muted-foreground">in stock</p>
            </div>
        </div>
    )
}

export default function InventoryPage() {
    const { products, categories } = useStore();
    const [searchTerm, setSearchTerm] = useState("");
    const [isSheetOpen, setIsSheetOpen] = useState(false);

    const categoryMap = useMemo(() => 
        categories.reduce((acc, cat) => {
            acc[cat.id] = cat;
            return acc;
        }, {} as Record<string, Category>), 
    [categories]);

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
                        />
                    </div>
                     <div className="md:hidden">
                        <Button onClick={() => setIsSheetOpen(true)}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Adjustment
                        </Button>
                    </div>
                </div>
                <ScrollArea className="flex-grow bg-background">
                    {filteredProducts.length > 0 ? (
                        <div>
                            {filteredProducts.map(product => (
                                <InventoryListItem key={product.id} product={product} category={product.category_id ? categoryMap[product.category_id] : undefined} />
                            ))}
                        </div>
                    ) : (
                         <div className="text-center text-muted-foreground py-24">
                            <SlidersHorizontal className="mx-auto h-12 w-12" />
                            <h3 className="mt-4 text-lg font-semibold">No Stock-Tracked Products</h3>
                            <p>Enable stock tracking for products to see them here.</p>
                        </div>
                    )}
                </ScrollArea>
            </div>

            {/* Right Panel: Adjustment Form (Desktop) */}
            <aside className="hidden md:block col-span-4 lg:col-span-3 h-full p-4 bg-background">
               <AdjustmentForm />
            </aside>
            
            {/* Adjustment Form Sheet (Mobile) */}
             <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                <SheetContent side="right" className="w-full sm:w-[500px] p-0">
                    <AdjustmentForm onSave={() => setIsSheetOpen(false)} />
                </SheetContent>
            </Sheet>
        </div>
    );
}
