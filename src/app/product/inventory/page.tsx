
"use client";

import { useState } from "react";
import * as z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useStore } from "@/lib/store";
import { Product, StockMovementType } from "@/lib/types";
import { adjustStock } from "@/services/stockService";
import { useToast } from "@/hooks/use-toast";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PlusCircle, SlidersHorizontal } from "lucide-react";

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

export default function InventoryPage() {
    const { products } = useStore();
    const { toast } = useToast();
    const [isDialogOpen, setIsDialogOpen] = useState(false);

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
            setIsDialogOpen(false);
            form.reset();
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
        <>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Inventory Management</CardTitle>
                        <CardDescription>View current stock levels and make manual adjustments.</CardDescription>
                    </div>
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Button size="sm">
                                <PlusCircle className="mr-2 h-4 w-4" /> New Adjustment
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Manual Stock Adjustment</DialogTitle>
                                <DialogDescription>
                                    Record a change in stock for a product.
                                </DialogDescription>
                            </DialogHeader>
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
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
                                    <DialogFooter className="pt-4">
                                        <Button variant="outline" type="button" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                                        <Button type="submit">Save Adjustment</Button>
                                    </DialogFooter>
                                </form>
                            </Form>
                        </DialogContent>
                    </Dialog>
                </CardHeader>
                <CardContent>
                    {stockTrackedProducts.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Product Name</TableHead>
                                    <TableHead className="text-right">Current Stock</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {stockTrackedProducts.map(product => (
                                    <TableRow key={product.id}>
                                        <TableCell className="font-medium">{product.name}</TableCell>
                                        <TableCell className={`text-right font-medium ${product.stock < (product.low_stock_alert || 10) ? 'text-destructive' : ''}`}>
                                            {product.stock}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                         <div className="text-center text-muted-foreground py-12">
                            <SlidersHorizontal className="mx-auto h-12 w-12" />
                            <h3 className="mt-4 text-lg font-semibold">No Stock-Tracked Products</h3>
                            <p>Enable stock tracking for products to see them here.</p>
                        </div>
                    )}
                </CardContent>
                <CardFooter>
                    <div className="text-xs text-muted-foreground">
                        Showing <strong>{stockTrackedProducts.length}</strong> products with stock tracking enabled.
                    </div>
                </CardFooter>
            </Card>
        </>
    );
}
