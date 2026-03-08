
'use client';

import React, { useState, useMemo, useEffect, useRef } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

// UI Components
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea, ScrollAreaHandle } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

// Icons
import { PlusCircle, Scan, Zap, Upload } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { ScrollShadow } from "@/components/ui/scrollshadow";

// Services
import { addProduct, updateProduct } from "@/services/productService";

// Sub-components
import { BarcodeScanner } from './BarcodeScanner';
import { VariantItem } from './VariantItem';
import { RecipeItem as CompositeItem } from './RecipeItem';
import { useToast } from "@/hooks/use-toast";

// Form Schema & Types
const variantSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(1, "Variant name is required."),
    additional_price: z.coerce.number().min(0),
    sku: z.string().optional(),
    track_stock: z.boolean().default(true),
    stock: z.coerce.number().min(0, "Stock cannot be negative."),
    low_stock_alert: z.coerce.number().min(0).optional(),
});

const recipeItemSchema = z.object({
    ingredient_id: z.string().min(1, "Please select an ingredient."),
    quantity: z.coerce.number().min(0.01, "Quantity must be greater than 0."),
});

const productFormSchema = z.object({
    name: z.string().min(2, { message: "Product name must be at least 2 characters." }),
    product_type: z.enum(["retail", "food_and_beverage"], { required_error: "You need to select a product type." }),
    category_id: z.string().optional(),
    sku: z.string().optional(),
    barcode: z.string().optional(),
    price: z.coerce.number().min(0, { message: "Price cannot be negative." }),
    cost_price: z.coerce.number().min(0, { message: "Cost price cannot be negative." }).optional(),
    stock: z.coerce.number().min(0, { message: "Stock cannot be negative." }),
    low_stock_alert: z.coerce.number().min(0, { message: "Low stock alert cannot be negative." }).optional(),
    track_stock: z.boolean().default(true),
    is_active: z.boolean().default(true),
    has_variant: z.boolean().default(false),
    has_modifier: z.boolean().default(false),
    is_composite: z.boolean().default(false),
    modifier_group_ids: z.array(z.string()).optional(),
    variants: z.array(variantSchema).optional(),
    recipe_items: z.array(recipeItemSchema).optional(),
    imageUrl: z.string().optional(),
    imageHint: z.string().optional(),
});

export type ProductFormData = z.infer<typeof productFormSchema>;

interface ProductFormProps {
    productId: string | null;
    onSave: () => void;
    onCancel: () => void;
}

const initialFormValues: ProductFormData = {
    name: "", product_type: "retail", price: 0, cost_price: 0, stock: 0,
    low_stock_alert: 0, track_stock: true, is_active: true, has_variant: false,
    has_modifier: false, is_composite: false, modifier_group_ids: [], sku: "", barcode: "",
    variants: [], recipe_items: [], imageUrl: "", imageHint: ""
};

export const ProductForm = ({ productId, onSave, onCancel }: ProductFormProps) => {
    const { products, categories, modifierGroups, productVariants, rawIngredients, recipes } = useStore();
    const { toast } = useToast();
    const isEditing = !!productId;
    const product = useMemo(() => productId === null ? undefined : products.find(p => p.id === productId), [productId, products]);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const scrollRef = useRef<ScrollAreaHandle>(null);

    const form = useForm<ProductFormData>({
        resolver: zodResolver(productFormSchema),
        defaultValues: initialFormValues,
    });

    const { fields: variantFields, append: appendVariant, remove: removeVariant } = useFieldArray({
        control: form.control, name: "variants",
    });

    const { fields: recipeFields, append: appendRecipeItem, remove: removeRecipeItem } = useFieldArray({
        control: form.control, name: "recipe_items",
    });

    const hasVariant = form.watch('has_variant');
    const productType = form.watch('product_type');
    const isComposite = form.watch('is_composite');
    const imageUrl = form.watch('imageUrl');

    useEffect(() => {
        if (product) {
            const variantsForProduct = productVariants.filter(v => v.product_id === product.id);
            const recipeForProduct = recipes.find(r => r.product_id === product.id);
            form.reset({
                name: product.name, product_type: product.product_type, category_id: product.category_id,
                sku: product.sku, barcode: product.barcode,
                price: product.price, cost_price: product.cost_price, stock: product.stock,
                low_stock_alert: product.low_stock_alert, track_stock: product.track_stock,
                is_active: product.is_active, has_variant: product.has_variant, has_modifier: product.has_modifier,
                is_composite: product.is_composite || false,
                modifier_group_ids: product.modifier_group_ids || [],
                variants: variantsForProduct,
                recipe_items: recipeForProduct ? recipeForProduct.items : [],
                imageUrl: product.imageUrl,
                imageHint: product.imageHint,
            });
        } else {
            form.reset(initialFormValues);
        }
    }, [product, form, productVariants, recipes]);

    const handleScanSuccess = (barcode: string) => {
        form.setValue('barcode', barcode, { shouldValidate: true });
        setIsScannerOpen(false);
    };

    const resizeImage = (file: File, maxSize: number): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = document.createElement('img');
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let { width, height } = img;
                    if (width > height) {
                        if (width > maxSize) { height *= maxSize / width; width = maxSize; }
                    } else {
                        if (height > maxSize) { width *= maxSize / height; height = maxSize; }
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return reject(new Error('Could not get canvas context'));
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/webp', 0.9));
                };
                img.onerror = reject;
                img.src = e.target?.result as string;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const resizedDataUrl = await resizeImage(file, 512);
            form.setValue('imageUrl', resizedDataUrl, { shouldDirty: true });
            form.setValue('imageHint', file.name.split('.').slice(0, -1).join('.'), { shouldDirty: true });
        } catch (error) {
            toast({ variant: "destructive", title: "Image Error", description: "Could not process the selected image." });
        }
    };

    async function onSubmit(data: ProductFormData) {
        try {
            if (isEditing && product) {
                await updateProduct(product.id, data);
                toast({ title: "Product Updated" });
            } else {
                await addProduct(data);
                toast({ title: "Product Created" });
            }
            onSave();
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error Saving Product", description: error.message });
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="h-full flex flex-col min-h-0">
                <div className="flex-1 min-h-0 relative overflow-hidden">
                    <ScrollShadow scrollRef={scrollRef} side="both" />
                    <ScrollArea className="px-1 h-full" ref={scrollRef}>
                        <div className="space-y-6 p-4">
                            <Card>
                                <CardHeader><CardTitle>Product Details</CardTitle></CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="flex items-stretch w-full gap-6">
                                        <div onClick={() => imageInputRef.current?.click()} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && imageInputRef.current?.click()} className="group relative w-48 h-48 rounded-xl overflow-hidden border bg-muted cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary">
                                            <img src={imageUrl || "/images/placeholder.svg"} alt={form.getValues("name") || "Product image"} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors duration-300 flex items-center justify-center">
                                                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-white text-sm font-medium flex flex-col items-center gap-2">
                                                    <Upload className="h-6 w-6" />
                                                    {imageUrl ? "Change Image" : "Upload Image"}
                                                </div>
                                            </div>
                                        </div>
                                        <input type="file" ref={imageInputRef} hidden accept="image/*" onChange={handleImageSelect} />
                                        <div className="flex flex-col grow gap-6">
                                            <FormField control={form.control} name="product_type" render={({ field }) => (
                                                <FormItem className="space-y-3"><FormLabel>Product Type</FormLabel>
                                                    <FormControl><RadioGroup onValueChange={field.onChange} value={field.value} className="flex flex-col space-y-1">
                                                        <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="retail" /></FormControl><FormLabel className="font-normal">Retail Product</FormLabel></FormItem>
                                                        <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="food_and_beverage" /></FormControl><FormLabel className="font-normal">Food & Beverage</FormLabel></FormItem>
                                                    </RadioGroup></FormControl><FormMessage />
                                                </FormItem>
                                            )} />
                                            <div className="grow"></div>
                                            <FormField control={form.control} name="is_active" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between"><FormLabel>Product Active</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                                        </div>
                                    </div>
                                    <FormField control={form.control} name="barcode" render={({ field }) => (
                                        <FormItem><FormLabel>Barcode</FormLabel><FormControl><Input placeholder="Scan or enter barcode" {...field} /></FormControl>
                                            <div className="flex gap-2 pt-2">
                                                <Dialog open={isScannerOpen} onOpenChange={setIsScannerOpen}><DialogTrigger asChild><Button type="button" variant="outline" className="w-full"><Scan className="h-4 w-4" /> Scan</Button></DialogTrigger>
                                                    <DialogContent><DialogHeader><DialogTitle>Barcode Scanner</DialogTitle></DialogHeader><BarcodeScanner onScanSuccess={handleScanSuccess} /></DialogContent>
                                                </Dialog>
                                                <Button type="button" variant="outline" className="w-full" onClick={() => { form.setValue('barcode', Math.floor(1000000000000 + Math.random() * 9000000000000).toString(), { shouldValidate: true }); }}><Zap className="h-4 w-4" /> Generate</Button>
                                            </div><FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="sku" render={({ field }) => (<FormItem><FormLabel>SKU (Stock Keeping Unit)</FormLabel><FormControl><Input placeholder="e.g. F-DRK-001" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Product Name</FormLabel><FormControl><Input placeholder="e.g. Cokelat Batang" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={form.control} name="category_id" render={({ field }) => (
                                        <FormItem><FormLabel>Category</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger></FormControl><SelectContent>{categories.map(cat => (<SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={form.control} name="price" render={({ field }) => (<FormItem><FormLabel>Selling Price</FormLabel><FormControl><div className="relative"><span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">Rp</span><Input type="number" placeholder="8000" className="pl-10" {...field} /></div></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={form.control} name="cost_price" render={({ field }) => (<FormItem><FormLabel>Cost Price</FormLabel><FormControl><div className="relative"><span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">Rp</span><Input type="number" placeholder="6500" className="pl-10" {...field} /></div></FormControl><FormDescription>Used to calculate profit.</FormDescription><FormMessage /></FormItem>)} />
                                    <Separator />
                                    <FormField control={form.control} name="track_stock" render={({ field }) => (<FormItem className={cn("flex flex-row items-center justify-between", (hasVariant || isComposite) && "opacity-50")}><FormLabel>Track Stock (Parent)</FormLabel><FormControl><Switch checked={(hasVariant || isComposite) ? false : field.value} onCheckedChange={field.onChange} disabled={hasVariant || isComposite} /></FormControl></FormItem>)} />
                                    <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-6", (hasVariant || isComposite) && "opacity-50")}>
                                        <FormField control={form.control} name="stock" render={({ field }) => (<FormItem><FormLabel>Initial Stock</FormLabel><FormControl><Input type="number" placeholder="50" {...field} disabled={isEditing || hasVariant || isComposite || !form.watch('track_stock')} /></FormControl><FormDescription>Editable only on creation.</FormDescription><FormMessage /></FormItem>)} />
                                        <FormField control={form.control} name="low_stock_alert" render={({ field }) => (<FormItem><FormLabel>Low Stock Alert</FormLabel><FormControl><Input type="number" placeholder="10" {...field} disabled={hasVariant || isComposite || !form.watch('track_stock')} /></FormControl><FormMessage /></FormItem>)} />
                                    </div>
                                    <Separator />
                                    <FormField control={form.control} name="has_variant" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between"><FormLabel>Enable Variants</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                                    {hasVariant && (<div className="space-y-4">{variantFields.map((field, index) => (<VariantItem key={field.id} index={index} field={field} form={form} removeVariant={removeVariant} isEditing={isEditing} />))}<Button type="button" variant="outline" size="sm" onClick={() => appendVariant({ name: '', additional_price: 0, stock: 0, sku: '', track_stock: true, low_stock_alert: 0 })}><PlusCircle className="mr-2 h-4 w-4" /> Add Variant</Button></div>)}
                                    {productType === 'food_and_beverage' && (<>
                                        <Separator />
                                        <FormField control={form.control} name="has_modifier" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between"><FormLabel>Enable Modifiers Group</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange}  /></FormControl></FormItem>)} />
                                        {form.watch('has_modifier') && productType === 'food_and_beverage' && (<FormField control={form.control} name="modifier_group_ids" render={() => (<FormItem className="grid grid-cols-2 space-y-0">{modifierGroups.map((group) => (<FormField key={group.id} control={form.control} name="modifier_group_ids" render={({ field }) => (<FormItem key={group.id} className="flex flex-row items-start space-x-3 space-y-0 py-2"><FormControl><Checkbox checked={field.value?.includes(group.id)} onCheckedChange={(checked) => checked ? field.onChange([...(field.value || []), group.id]) : field.onChange(field.value?.filter((value) => value !== group.id))} /></FormControl><FormLabel className="font-normal">{group.name}</FormLabel></FormItem>)} />))}<FormMessage /></FormItem>)} />)}
                                        <Separator />
                                        <FormField control={form.control} name="is_composite" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between"><FormLabel>Composite Product</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={productType !== 'food_and_beverage'} /></FormControl></FormItem>)} />
                                        {isComposite && productType === 'food_and_beverage' && (<div className="space-y-4 pt-4">{recipeFields.map((field, index) => (<CompositeItem key={field.id} rawIngredients={rawIngredients} index={index} field={field} form={form} removeRecipeItem={removeRecipeItem} />))}<Button type="button" variant="outline" size="sm" onClick={() => appendRecipeItem({ ingredient_id: '', quantity: 0 })}><PlusCircle className="mr-2 h-4 w-4" /> Add Ingredient</Button></div>)}
                                    </>)}
                                    <Separator />
                                </CardContent>
                            </Card>
                        </div>
                    </ScrollArea>
                </div>
                <div className="p-4 mt-auto shrink-0 flex items-center gap-4">
                    {isEditing && (<Button variant="outline" type="button" className="flex-1" onClick={onCancel}>Cancel</Button>)}
                    <Button type="submit" className="flex-1">{isEditing ? "Save Changes" : "Create Product"}</Button>
                </div>
            </form>
        </Form>
    );
};
