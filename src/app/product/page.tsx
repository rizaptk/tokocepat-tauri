
"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Image from 'next/image';
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useStore } from "@/lib/store";
import { Product, Category, ModifierGroup, ModifierItem, RawIngredient, StockMovementType } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// UI Components
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductSearchBar } from "@/components/ProductSearchBar";
import { ProductList } from "@/components/ProductList";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea, ScrollAreaHandle } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";


// Icons
import { PlusCircle, Edit, Trash, SlidersHorizontal, Library, Package, Menu, Scan, Barcode, Zap, Beaker, Sandwich, Upload, Banknote, Circle, DiamondPlus } from "lucide-react";

// Services
import { addProduct, updateProduct } from "@/services/productService";
import { addCategory, updateCategory, deleteCategory } from "@/services/categoryService";
import { addModifierGroup, updateModifierGroup, deleteModifierGroup, addModifierItem, updateModifierItem, deleteModifierItem } from "@/services/modifierService";
import { addIngredient, updateIngredient, deleteIngredient } from "@/services/ingredientService";
import { adjustIngredientStock } from "@/services/stockService";


import { useZxing } from "react-zxing";
import { useGlobalBarcodeScanner } from "@/hooks/use-global-barcode-scanner";
import { Separator } from "@/components/ui/separator";
import { ScrollShadow } from "@/components/ui/scrollshadow";
// import { ProductForm } from "./productForm";


// ========= PRODUCT FORM =========
const variantSchema = z.object({
    id: z.string().optional(), // Keep track of existing variants for React keys
    name: z.string().min(1, "Variant name is required."),
    additional_price: z.coerce.number().min(0),
    sku: z.string().optional(),
    stock: z.coerce.number().min(0, "Stock cannot be negative."),
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
  
type ProductFormValues = z.infer<typeof productFormSchema>;

const BarcodeScanner = ({ onScanSuccess }: { onScanSuccess: (text: string) => void }) => {
    const { ref } = useZxing({
        onDecodeResult(result) {
            onScanSuccess(result.getText());
        },
    });

    return (
        <div className="flex flex-col items-center justify-center gap-4 py-4">
            <div className="relative w-full max-w-sm aspect-square bg-muted rounded-lg overflow-hidden">
                <video ref={ref} className="w-full h-full object-cover" />
                <div className="absolute inset-0 border-4 border-primary/50 rounded-lg pointer-events-none" />
            </div>
            <p className="text-sm text-muted-foreground">Point the camera at a barcode</p>
        </div>
    );
};

const ProductForm = ({ productId, onSave }: { productId: string | null, onSave: () => void }) => {
    const { products, categories, modifierGroups, productVariants, rawIngredients, recipes } = useStore();
    const { toast } = useToast();
    const isEditing = !!productId;
    const product = useMemo(() => products.find(p => p.id === productId), [productId, products]);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const scrollRef = useRef<ScrollAreaHandle>(null);

    const form = useForm<ProductFormValues>({
        resolver: zodResolver(productFormSchema),
        defaultValues: {
            name: "", product_type: "retail", price: 0, cost_price: 0, stock: 0,
            low_stock_alert: 0, track_stock: true, is_active: true, has_variant: false,
            has_modifier: false, is_composite: false, modifier_group_ids: [], sku: "", barcode: "", 
            variants: [], recipe_items: [], imageUrl: "", imageHint: ""
        },
    });

    const { fields: variantFields, append: appendVariant, remove: removeVariant } = useFieldArray({
        control: form.control,
        name: "variants",
    });

    const { fields: recipeFields, append: appendRecipeItem, remove: removeRecipeItem } = useFieldArray({
        control: form.control,
        name: "recipe_items",
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
            form.reset(form.formState.defaultValues);
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
                        if (width > maxSize) {
                            height *= maxSize / width;
                            width = maxSize;
                        }
                    } else {
                        if (height > maxSize) {
                            width *= maxSize / height;
                            height = maxSize;
                        }
                    }
    
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return reject(new Error('Could not get canvas context'));
    
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/webp', 0.9)); // Use WebP for better compression
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
            const resizedDataUrl = await resizeImage(file, 512); // Resize to max 512px
            form.setValue('imageUrl', resizedDataUrl, { shouldDirty: true });
            form.setValue('imageHint', file.name.split('.').slice(0, -1).join('.'), { shouldDirty: true });
        } catch (error) {
            console.error("Image resizing failed:", error);
            toast({
                variant: "destructive",
                title: "Image Error",
                description: "Could not process the selected image."
            });
        }
    };

    async function onSubmit(data: ProductFormValues) {
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
            toast({
                variant: "destructive",
                title: "Error Saving Product",
                description: error.message,
            });
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
                                        <div
                                            onClick={() => imageInputRef.current?.click()}
                                            role="button"
                                            tabIndex={0}
                                            onKeyDown={(e) => e.key === "Enter" && imageInputRef.current?.click()}
                                            className="group relative w-48 h-48 rounded-xl overflow-hidden border bg-muted cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary"
                                        >
                                            {/* Image */}
                                            <Image
                                                src={imageUrl || "/images/placeholder.svg"}
                                                alt={form.getValues("name") || "Product image"}
                                                fill
                                                sizes="192px"
                                                className="object-cover transition-transform duration-300 group-hover:scale-105"
                                            />

                                            {/* Hover Overlay */}
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors duration-300 flex items-center justify-center">
                                                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-white text-sm font-medium flex flex-col items-center gap-2">
                                                    <Upload className="h-6 w-6" />
                                                    {imageUrl ? "Change Image" : "Upload Image"}
                                                </div>
                                            </div>
                                        </div>

                                        <input
                                            type="file"
                                            ref={imageInputRef}
                                            hidden
                                            accept="image/*"
                                            onChange={handleImageSelect}
                                        />

                                        <div className="flex flex-col grow gap-6">
                                            <FormField control={form.control} name="product_type" render={({ field }) => (
                                                <FormItem className="space-y-3"><FormLabel>Product Type</FormLabel>
                                                    <FormControl>
                                                        <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-1">
                                                            <FormItem className="flex items-center space-x-3 space-y-0">
                                                                <FormControl><RadioGroupItem value="retail" /></FormControl>
                                                                <FormLabel className="font-normal">Retail Product</FormLabel>
                                                            </FormItem>
                                                            <FormItem className="flex items-center space-x-3 space-y-0">
                                                                <FormControl><RadioGroupItem value="food_and_beverage" /></FormControl>
                                                                <FormLabel className="font-normal">Food & Beverage</FormLabel>
                                                            </FormItem>
                                                        </RadioGroup>
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                    
                                            <div className="grow"></div>

                                        <FormField control={form.control} name="is_active" render={({ field }) => (
                                                <FormItem className="flex flex-row items-center justify-between">
                                                    <FormLabel className="">Product Active</FormLabel>
                                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                                            )} />

                                        </div>

                                        
                                </div>
                                    
                                    <FormField control={form.control} name="barcode" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Barcode</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Scan or enter barcode" {...field} />
                                            </FormControl>
                                            <div className="flex gap-2 pt-2">
                                                <Dialog open={isScannerOpen} onOpenChange={setIsScannerOpen}>
                                                    <DialogTrigger asChild>
                                                        <Button type="button" variant="outline" className="w-full">
                                                            <Scan className="h-4 w-4" /> Scan
                                                        </Button>
                                                    </DialogTrigger>
                                                    <DialogContent>
                                                        <DialogHeader>
                                                            <DialogTitle>Barcode Scanner</DialogTitle>
                                                        </DialogHeader>
                                                        <BarcodeScanner onScanSuccess={handleScanSuccess} />
                                                    </DialogContent>
                                                </Dialog>
                                                <Button type="button" variant="outline" className="w-full" onClick={() => {
                                                    const randomBarcode = Math.floor(1000000000000 + Math.random() * 9000000000000).toString();
                                                    form.setValue('barcode', randomBarcode, { shouldValidate: true });
                                                }}>
                                                    <Zap className="h-4 w-4" /> Generate
                                                </Button>
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    )} />

                                    <FormField control={form.control} name="sku" render={({ field }) => (
                                        <FormItem><FormLabel>SKU (Stock Keeping Unit)</FormLabel><FormControl><Input placeholder="e.g. F-DRK-001" {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />

                                    <FormField control={form.control} name="name" render={({ field }) => (
                                        <FormItem><FormLabel>Product Name</FormLabel><FormControl><Input placeholder="e.g. Cokelat Batang" {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={form.control} name="category_id" render={({ field }) => (
                                        <FormItem><FormLabel>Category</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl><SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger></FormControl>
                                                <SelectContent>{categories.map(cat => (<SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>))}</SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="price" render={({ field }) => (
                                        <FormItem><FormLabel>Selling Price</FormLabel><FormControl><div className="relative"><span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">Rp</span><Input type="number" placeholder="8000" className="pl-10" {...field} /></div></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={form.control} name="cost_price" render={({ field }) => (
                                        <FormItem><FormLabel>Cost Price</FormLabel><FormControl><div className="relative"><span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">Rp</span><Input type="number" placeholder="6500" className="pl-10" {...field} /></div></FormControl><FormDescription>Used to calculate profit.</FormDescription><FormMessage /></FormItem>
                                    )} />

                                    <Separator />

                                    <FormField
                                        control={form.control}
                                        name="track_stock"
                                        render={({ field }) => (
                                            <FormItem className={cn("flex flex-row items-center justify-between", (hasVariant || isComposite) && "opacity-50")}>
                                                <div className="space-y-0.5">
                                                    <FormLabel className="text-base">Track Stock (Parent)</FormLabel>
                                                </div>
                                                <FormControl>
                                                    <Switch
                                                        checked={(hasVariant || isComposite) ? false : field.value}
                                                        onCheckedChange={field.onChange}
                                                        disabled={hasVariant || isComposite}
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                    <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-6", (hasVariant || isComposite) && "opacity-50")}>
                                        <FormField
                                            control={form.control}
                                            name="stock"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Initial Stock</FormLabel>
                                                    <FormControl>
                                                        <Input type="number" placeholder="50" {...field} disabled={hasVariant || isComposite || !form.watch('track_stock')} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="low_stock_alert"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Low Stock Alert</FormLabel>
                                                    <FormControl>
                                                        <Input type="number" placeholder="10" {...field} disabled={hasVariant || isComposite || !form.watch('track_stock')} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <Separator />

                                    <FormField
                                        control={form.control}
                                        name="has_variant"
                                        render={({ field }) => (
                                            <FormItem className="flex flex-row items-center justify-between">
                                                <FormLabel className="text-base">Enable Variants</FormLabel>
                                                <FormControl>
                                                    <Switch
                                                        checked={field.value}
                                                        onCheckedChange={field.onChange}
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />

                                    {hasVariant && (
                                        <div className="space-y-4">
                                            {variantFields.map((field, index) => (
                                                <div key={field.id} className="flex flex-col gap-2 items-end p-3 border rounded-lg bg-muted/50">
                                                    <div className="flex items-center justify-between w-full border-b px-2">
                                                        <FormLabel className="text-sm">Variant {index + 1}</FormLabel>
                                                        <Button type="button" variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeVariant(index)}>
                                                            <Trash className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                    <div className="flex-grow grid grid-cols-2 gap-4">
                                                        <FormField
                                                            control={form.control}
                                                            name={`variants.${index}.name`}
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel className="text-xs">Name</FormLabel>
                                                                    <FormControl>
                                                                        <Input placeholder="e.g. Small" {...field} />
                                                                    </FormControl>
                                                                </FormItem>
                                                            )}
                                                        />
                                                        <FormField
                                                            control={form.control}
                                                            name={`variants.${index}.additional_price`}
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel className="text-xs">Price Adj.</FormLabel>
                                                                    <FormControl>
                                                                        <div className="relative"><span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground text-xs">Rp</span><Input type="number" placeholder="0" className="pl-8" {...field} /></div>
                                                                    </FormControl>
                                                                </FormItem>
                                                            )}
                                                        />
                                                        <FormField
                                                            control={form.control}
                                                            name={`variants.${index}.sku`}
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel className="text-xs">SKU</FormLabel>
                                                                    <FormControl>
                                                                        <Input placeholder="SKU-S" {...field} />
                                                                    </FormControl>
                                                                </FormItem>
                                                            )}
                                                        />
                                                        <FormField
                                                            control={form.control}
                                                            name={`variants.${index}.stock`}
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel className="text-xs">Stock</FormLabel>
                                                                    <FormControl>
                                                                        <Input type="number" placeholder="50" {...field} />
                                                                    </FormControl>
                                                                </FormItem>
                                                            )}
                                                        />
                                                    </div>
                                                    
                                                </div>
                                            ))}
                                            <Button type="button" variant="outline" size="sm" onClick={() => appendVariant({ name: '', additional_price: 0, stock: 0, sku: '' })}>
                                                <PlusCircle className="mr-2 h-4 w-4" /> Add Variant
                                            </Button>
                                        </div>
                                    )}

                                    {
                                        form.watch('product_type') === 'food_and_beverage' &&
                                        (
                                            <>
                                                <Separator />
                                                <FormField control={form.control} name="has_modifier" render={({ field }) => (
                                                    <FormItem className="flex flex-row items-center justify-between">
                                                        <FormLabel className="text-base">Enable Modifiers Group</FormLabel>
                                                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={form.watch('product_type') === 'retail'} /></FormControl>
                                                    </FormItem>
                                                )} />
                                                {form.watch('has_modifier') && form.watch('product_type') === 'food_and_beverage' && (
                                                    <FormField control={form.control} name="modifier_group_ids" render={() => (
                                                        <FormItem className="grid grid-cols-2 space-y-0">
                                                            {modifierGroups.map((group) => (<FormField key={group.id} control={form.control} name="modifier_group_ids" render={({ field }) => {
                                                                return (<FormItem key={group.id} className="flex flex-row items-start space-x-3 space-y-0 py-2">
                                                                    <FormControl><Checkbox checked={field.value?.includes(group.id)} onCheckedChange={(checked) => {
                                                                        return checked ? field.onChange([...(field.value || []), group.id]) : field.onChange(field.value?.filter((value) => value !== group.id))
                                                                    }} /></FormControl>
                                                                    <FormLabel className="font-normal">{group.name}</FormLabel>
                                                                </FormItem>)
                                                            }} />))}
                                                            <FormMessage />
                                                        </FormItem>
                                                    )} />
                                                )}

                                                <Separator />

                                                <FormField
                                                    control={form.control}
                                                    name="is_composite"
                                                    render={({ field }) => (
                                                        <FormItem className="flex flex-row items-center justify-between">
                                                            <FormLabel className="text-base">Composite Product</FormLabel>
                                                            <FormControl>
                                                                <Switch
                                                                    checked={field.value}
                                                                    onCheckedChange={field.onChange}
                                                                    disabled={productType !== 'food_and_beverage'}
                                                                />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                                {isComposite && productType === 'food_and_beverage' && (
                                                    <div className="space-y-4 pt-4">
                                                        {recipeFields.map((field, index) => (
                                                            <div key={field.id} className="flex gap-2 items-end p-3 border rounded-lg bg-muted/50">
                                                                <div className="flex-grow grid grid-cols-2 gap-4">
                                                                    <FormField
                                                                        control={form.control}
                                                                        name={`recipe_items.${index}.ingredient_id`}
                                                                        render={({ field }) => (
                                                                            <FormItem>
                                                                                <FormLabel className="text-xs">Ingredient</FormLabel>
                                                                                <Select onValueChange={field.onChange} value={field.value}>
                                                                                    <FormControl><SelectTrigger><SelectValue placeholder="Select ingredient" /></SelectTrigger></FormControl>
                                                                                    <SelectContent>{rawIngredients.map(ing => (<SelectItem key={ing.id} value={ing.id}>{ing.name}</SelectItem>))}</SelectContent>
                                                                                </Select>
                                                                                <FormMessage/>
                                                                            </FormItem>
                                                                        )}
                                                                    />
                                                                    <FormField
                                                                        control={form.control}
                                                                        name={`recipe_items.${index}.quantity`}
                                                                        render={({ field }) => (
                                                                            <FormItem>
                                                                                <FormLabel className="text-xs">Quantity</FormLabel>
                                                                                <FormControl>
                                                                                    <Input type="number" placeholder="e.g. 18" {...field} />
                                                                                </FormControl>
                                                                                <FormMessage/>
                                                                            </FormItem>
                                                                        )}
                                                                    />
                                                                </div>
                                                                <Button type="button" variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeRecipeItem(index)}>
                                                                    <Trash className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        ))}
                                                        <Button type="button" variant="outline" size="sm" onClick={() => appendRecipeItem({ ingredient_id: '', quantity: 0 })}>
                                                            <PlusCircle className="mr-2 h-4 w-4" /> Add Ingredient
                                                        </Button>
                                                    </div>
                                                )}

                                            </>   
                                        )
                                    }

                                    <Separator />
                                </CardContent>
                            </Card>
                        </div>
                    </ScrollArea>
                </div>
                <div className="p-4 mt-auto shrink-0">
                    <Button type="submit" className="w-full">{isEditing ? "Save Changes" : "Create Product"}</Button>
                </div>
            </form>
        </Form>
    );
};

// ========= CATEGORY MANAGER =========
const CategoryManager = () => {
    const { categories } = useStore();
    const { toast } = useToast();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [categoryToEdit, setCategoryToEdit] = useState<Category | null>(null);
    const [categoryName, setCategoryName] = useState("");

    const openDialog = (category: Category | null) => {
        setCategoryToEdit(category);
        setCategoryName(category ? category.name : "");
        setIsDialogOpen(true);
    }
    
    const handleSave = async () => {
        if (!categoryName.trim()) return;
        try {
            if (categoryToEdit) {
                await updateCategory(categoryToEdit.id, categoryName);
                toast({ title: "Category updated" });
            } else {
                await addCategory(categoryName);
                toast({ title: "Category added" });
            }
            setIsDialogOpen(false);
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Could not save category." });
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const result = await deleteCategory(id);
            if (!result.success) {
                toast({ variant: "destructive", title: "Deletion Failed", description: result.message });
            } else {
                toast({ title: "Category deleted" });
            }
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Could not delete category." });
        }
    };

    return (
        <div className="p-4 h-full flex flex-col">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold">Manage Categories</h3>
                <Button size="sm" onClick={() => openDialog(null)}><PlusCircle className="mr-2 h-4 w-4" /> Add</Button>
            </div>
            <ScrollArea className="flex-1">
            <Card className="rounded-lg">
                <CardContent className="p-0">

                <div className="divide-y">

                    {categories.map((cat) => (
                    <div
                        key={cat.id}
                        className="flex items-center justify-between px-4 py-4"
                    >

                        {/* Left Side */}
                        <div className="flex flex-col">
                        <span className="font-medium text-base">
                            {cat.name}
                        </span>
                        {/* <span className="text-xs text-muted-foreground">
                            Category
                        </span> */}
                        </div>

                        {/* Right Actions */}
                        <div className="flex items-center gap-2">

                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openDialog(cat)}
                        >
                            <Edit className="h-4 w-4" />
                        </Button>

                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive"
                            >
                                <Trash className="h-4 w-4" />
                            </Button>
                            </AlertDialogTrigger>

                            <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>
                                Delete "{cat.name}"?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                This will soft-delete the category.
                                It cannot be used for new products.
                                </AlertDialogDescription>
                            </AlertDialogHeader>

                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                onClick={() => handleDelete(cat.id)}
                                >
                                Confirm Delete
                                </AlertDialogAction>
                            </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>

                        </div>

                    </div>
                    ))}

                </div>

                </CardContent>
            </Card>
            </ScrollArea>
             {/* <ScrollArea className="flex-grow">
                <Card>
                    <CardContent className="pt-6">

                        <Table>
                            <TableHeader><TableRow><TableHead>Name</TableHead>
                            <TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {categories.map(cat => (
                                    <TableRow key={cat.id}>
                                        <TableCell className="font-medium">{cat.name}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="sm" onClick={() => openDialog(cat)}><Edit className="h-4 w-4" /></Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="text-destructive hover:text-destructive"><Trash className="h-4 w-4" /></Button></AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will soft-delete the category. It cannot be used for new products.</AlertDialogDescription></AlertDialogHeader>
                                                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(cat.id)}>Confirm Delete</AlertDialogAction></AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
             </ScrollArea> */}
             <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>{categoryToEdit ? 'Edit' : 'Add'} Category</DialogTitle></DialogHeader>
                    <div className="py-4"><Label htmlFor="cat-name">Category Name</Label><Input id="cat-name" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} autoFocus /></div>
                    <DialogFooter><Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button><Button onClick={handleSave}>Save</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

// ========= MODIFIER MANAGER =========
const ModifierManager = () => {
    const { modifierGroups } = useStore();
    const { toast } = useToast();
    const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
    const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
    const [groupToEdit, setGroupToEdit] = useState<ModifierGroup | null>(null);
    const [itemToEdit, setItemToEdit] = useState<ModifierItem | null>(null);
    const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

    const defaultGroupState = { name: "", min_select: 1, max_select: 1, required: true };
    const [groupFormData, setGroupFormData] = useState(defaultGroupState);
    const defaultItemState = { name: "", additional_price: 0 };
    const [itemFormData, setItemFormData] = useState(defaultItemState);

    const openGroupDialog = (group: ModifierGroup | null) => {
        setGroupToEdit(group);
        setGroupFormData(group ? { name: group.name, min_select: group.min_select, max_select: group.max_select, required: group.required } : defaultGroupState);
        setIsGroupDialogOpen(true);
    };

    const handleGroupSave = async () => {
        if (!groupFormData.name.trim()) return;
        try {
            if (groupToEdit) {
                await updateModifierGroup(groupToEdit.id, groupFormData);
            } else {
                await addModifierGroup(groupFormData);
            }
            setIsGroupDialogOpen(false);
        } catch (e) { toast({ variant: "destructive", title: "Error saving group" }); }
    };

    const handleGroupDelete = async (id: string) => {
        try {
            await deleteModifierGroup(id);
        } catch (e) { toast({ variant: "destructive", title: "Error deleting group" }); }
    };
    
    const openItemDialog = (groupId: string, item: ModifierItem | null) => {
        setActiveGroupId(groupId);
        setItemToEdit(item);
        setItemFormData(item ? { name: item.name, additional_price: item.additional_price } : defaultItemState);
        setIsItemDialogOpen(true);
    };

    const handleItemSave = async () => {
        if (!activeGroupId || !itemFormData.name.trim()) return;
        try {
            if (itemToEdit) {
                await updateModifierItem(activeGroupId, itemToEdit.id, itemFormData.name, itemFormData.additional_price);
            } else {
                await addModifierItem(activeGroupId, itemFormData.name, itemFormData.additional_price);
            }
            setIsItemDialogOpen(false);
        } catch (e) { toast({ variant: "destructive", title: "Error saving item" }); }
    };
    
    const handleItemDelete = async (groupId: string, itemId: string) => {
        try {
            await deleteModifierItem(groupId, itemId);
        } catch (e) { toast({ variant: "destructive", title: "Error deleting item" }); }
    };

    const formatCurrency = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

    return (
        <div className="p-4 h-full flex flex-col">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold">Manage Modifiers</h3>
                <Button size="sm" onClick={() => openGroupDialog(null)}><PlusCircle className="mr-2 h-4 w-4" /> Add Group</Button>
            </div>
            <ScrollArea className="flex-1 min-h-0 -mx-4">
                <div className="px-4 space-y-4">

                    {modifierGroups.map(group => (
                        <Card key={group.id} className="overflow-hidden">

                            {/* GROUP HEADER */}
                            <div className="p-4 border-b">
                                <div className="flex items-start justify-between gap-3">

                                    <div className="flex-1">
                                        <p className="font-semibold text-base leading-tight">
                                            {group.name}
                                        </p>

                                        <p className="text-sm text-muted-foreground mt-1">
                                            {group.required ? "Required" : "Optional"} •
                                            Select {group.min_select}–{group.max_select}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* ITEMS LIST */}
                            <div className="divide-y divide-border/40">

                                {group.items.map(item => (
                                    <div key={item.id} className="p-4 flex items-center justify-between gap-3 hover:bg-background">

                                        <div className="flex-1">
                                            <p className="font-medium flex gap-2">
                                                <DiamondPlus className="size-4 mt-1 shrink-0 text-green-600" />
                                                {item.name}
                                            </p>
                                            <p className="text-sm text-muted-foreground pl-6">
                                                {formatCurrency(item.additional_price)}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-1 shrink-0">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => openItemDialog(group.id, item)}
                                            >
                                                <Edit className="h-4 w-4" />
                                            </Button>

                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-destructive hover:text-destructive"
                                                    >
                                                        <Trash className="h-4 w-4" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>
                                                            Delete "{item.name}"?
                                                        </AlertDialogTitle>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction
                                                            onClick={() => handleItemDelete(group.id, item.id)}
                                                        >
                                                            Delete
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    </div>
                                ))}

                                {/* ADD ITEM BUTTON */}
                                <div className="p-4 flex justify-between items-center gap-4">
                                    <Button
                                        variant="outline"
                                        className="grow"
                                        onClick={() => openItemDialog(group.id, null)}
                                    >
                                        <PlusCircle className="mr-2 h-4 w-4" />
                                        Add Item
                                    </Button>
                                    {/* GROUP FOOTER ACTIONS */}
                                    <div className="flex justify-end gap-2">
                                        <Button
                                            variant="outline"
                                            onClick={() => openGroupDialog(group)}
                                            >
                                            <Edit className="h-4 w-4 mr-1" />
                                            Edit
                                        </Button>

                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    className="text-destructive hover:text-destructive"
                                                    onClick={() => handleGroupDelete(group.id)}
                                                    >
                                                    <Trash className="h-4 w-4 mr-1" />
                                                    Delete
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>
                                                        Delete "{group.name}"?
                                                    </AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        This will permanently delete the group and all its items.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction
                                                        onClick={() => handleGroupDelete(group.id)}
                                                    >
                                                        Delete
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>

                                    </div>
                                </div>

                            </div>
                        </Card>
                    ))}

                </div>
            </ScrollArea>
            
            {/* Group Dialog */}
            <Dialog open={isGroupDialogOpen} onOpenChange={setIsGroupDialogOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>{groupToEdit ? 'Edit' : 'Add'} Group</DialogTitle></DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2"><Label htmlFor="g-name">Group Name</Label><Input id="g-name" value={groupFormData.name} onChange={(e) => setGroupFormData({...groupFormData, name: e.target.value})} /></div>
                        <div className="flex items-center space-x-2"><Switch id="g-req" checked={groupFormData.required} onCheckedChange={(c) => setGroupFormData({...groupFormData, required: c, min_select: c ? Math.max(1, groupFormData.min_select) : groupFormData.min_select })} /><Label htmlFor="g-req">Required</Label></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><Label htmlFor="g-min">Min Select</Label><Input id="g-min" type="number" value={groupFormData.min_select} onChange={(e) => setGroupFormData({...groupFormData, min_select: Number(e.target.value)})} min={groupFormData.required ? 1 : 0} /></div>
                            <div className="space-y-2"><Label htmlFor="g-max">Max Select</Label><Input id="g-max" type="number" value={groupFormData.max_select} onChange={(e) => setGroupFormData({...groupFormData, max_select: Number(e.target.value)})} min={groupFormData.min_select} /></div>
                        </div>
                    </div>
                    <DialogFooter><Button variant="outline" onClick={() => setIsGroupDialogOpen(false)}>Cancel</Button><Button onClick={handleGroupSave}>Save</Button></DialogFooter>
                </DialogContent>
            </Dialog>
            {/* Item Dialog */}
             <Dialog open={isItemDialogOpen} onOpenChange={setIsItemDialogOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>{itemToEdit ? 'Edit' : 'Add'} Item</DialogTitle></DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2"><Label htmlFor="i-name">Item Name</Label><Input id="i-name" value={itemFormData.name} onChange={(e) => setItemFormData({...itemFormData, name: e.target.value})} /></div>
                        <div className="space-y-2"><Label htmlFor="i-price">Additional Price</Label><div className="relative"><span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">Rp</span><Input id="i-price" type="number" value={itemFormData.additional_price || ''} onChange={(e) => setItemFormData({...itemFormData, additional_price: Number(e.target.value)})} className="pl-10" /></div></div>
                    </div>
                    <DialogFooter><Button variant="outline" onClick={() => setIsItemDialogOpen(false)}>Cancel</Button><Button onClick={handleItemSave}>Save</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

// ========= INGREDIENT MANAGER =========
const adjustmentTypes: { value: StockMovementType, label: string }[] = [
    { value: 'initial_balance', label: 'Opening Balance (+)' },
    { value: 'restock', label: 'Purchase / Restock (+)' },
    { value: 'correction', label: 'Correction (+/-)' },
    { value: 'lost', label: 'Lost (-)' },
    { value: 'damaged', label: 'Damaged (-)' },
];

const IngredientManager = () => {
    const { rawIngredients } = useStore();
    const { toast } = useToast();
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isAdjustmentDialogOpen, setIsAdjustmentDialogOpen] = useState(false);
    const [ingredientToEdit, setIngredientToEdit] = useState<RawIngredient | null>(null);
    const [ingredientToAdjust, setIngredientToAdjust] = useState<RawIngredient | null>(null);

    const defaultFormState = { name: "", unit_type: 'gram' as RawIngredient['unit_type'], stock_qty: 0, cost_per_unit: 0 };
    const [formData, setFormData] = useState(defaultFormState);

    const defaultAdjustmentState = { type: 'correction' as StockMovementType, qty_change: 0, reason: '' };
    const [adjustmentData, setAdjustmentData] = useState(defaultAdjustmentState);

    const openDialog = (ingredient: RawIngredient | null) => {
        setIngredientToEdit(ingredient);
        setFormData(ingredient ? { name: ingredient.name, unit_type: ingredient.unit_type, stock_qty: ingredient.stock_qty, cost_per_unit: ingredient.cost_per_unit } : defaultFormState);
        setIsAddDialogOpen(true);
    };

    const openAdjustmentDialog = (ingredient: RawIngredient) => {
        setIngredientToAdjust(ingredient);
        setAdjustmentData(defaultAdjustmentState);
        setIsAdjustmentDialogOpen(true);
    };

    const handleSave = async () => {
        if (!formData.name.trim()) return;
        try {
            if (ingredientToEdit) {
                await updateIngredient(ingredientToEdit.id, formData);
                toast({ title: "Ingredient Updated" });
            } else {
                await addIngredient(formData);
                toast({ title: "Ingredient Added" });
            }
            setIsAddDialogOpen(false);
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Could not save ingredient." });
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteIngredient(id);
            toast({ title: "Ingredient Deleted" });
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Could not delete ingredient." });
        }
    };

    const handleAdjustmentSave = async () => {
        if (!ingredientToAdjust || !adjustmentData.reason.trim() || adjustmentData.qty_change === 0) {
            toast({ variant: 'destructive', title: 'Invalid Input', description: 'Please fill out all fields and ensure quantity is not zero.' });
            return;
        }
        try {
            await adjustIngredientStock(ingredientToAdjust.id, adjustmentData.type, adjustmentData.qty_change, adjustmentData.reason);
            toast({ title: 'Stock Adjusted', description: `${ingredientToAdjust.name} stock has been updated.` });
            setIsAdjustmentDialogOpen(false);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Adjustment Failed', description: error.message || "Could not adjust stock." });
        }
    };

    const formatCurrency = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

    return (
        <div className="p-4 h-full flex flex-col">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold">Manage Raw Ingredients</h3>
                <Button size="sm" onClick={() => openDialog(null)}><PlusCircle className="mr-2 h-4 w-4" /> Add</Button>
            </div>
            <ScrollArea className="flex-1 min-h-0">
                <div className="space-y-3">
                    {rawIngredients.map((ing) => (
                        <Card key={ing.id} className="p-4">
                            <div className="flex items-start justify-between gap-3">

                                {/* Left Content */}
                                <div className="flex-1 space-y-1">
                                    <p className="font-semibold leading-tight mb-3">
                                        {ing.name}
                                    </p>

                                    {/* Stock */}
                                    <div className="flex items-center gap-2">
                                        <Package className="h-4 w-4 shrink-0 text-purple-500" />
                                        <span>
                                        <span className="font-medium">
                                            {ing.stock_qty.toLocaleString()} {ing.unit_type}
                                        </span>
                                        </span>
                                    </div>

                                    {/* Cost */}
                                    <div className="flex items-center gap-2">
                                        <Banknote className="h-4 w-4 shrink-0 text-green-600" />
                                        <span>
                                        {formatCurrency(ing.cost_per_unit)} / {ing.unit_type}
                                        </span>
                                    </div>
                                </div>

                                {/* Quick Adjust Button */}
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openAdjustmentDialog(ing)}
                                >
                                    Adjust
                                </Button>
                            </div>

                            {/* Divider */}
                            <Separator className="my-3" />

                            {/* Actions Row */}
                            <div className="flex justify-end gap-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openDialog(ing)}
                                >
                                    <Edit className="h-4 w-4 mr-1" />
                                    Edit
                                </Button>

                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-destructive hover:text-destructive"
                                        >
                                            <Trash className="h-4 w-4 mr-1" />
                                            Delete
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>
                                                Delete "{ing.name}"?
                                            </AlertDialogTitle>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction
                                                onClick={() => handleDelete(ing.id)}
                                            >
                                                Confirm Delete
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </Card>
                    ))}
                </div>
            </ScrollArea>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>{ingredientToEdit ? 'Edit' : 'Add'} Ingredient</DialogTitle></DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <Label>Name</Label>
                            <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Initial Stock</Label>
                                <Input type="number" value={formData.stock_qty} onChange={(e) => setFormData({ ...formData, stock_qty: Number(e.target.value) })} />
                            </div>
                            <div className="space-y-2">
                                <Label>Unit</Label>
                                <Select value={formData.unit_type} onValueChange={(v) => setFormData({ ...formData, unit_type: v as any })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="gram">Gram (g)</SelectItem>
                                        <SelectItem value="ml">Milliliter (ml)</SelectItem>
                                        <SelectItem value="pcs">Pieces (pcs)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Cost per Unit</Label>
                            <Input type="number" value={formData.cost_per_unit} onChange={(e) => setFormData({ ...formData, cost_per_unit: Number(e.target.value) })} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSave}>Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog open={isAdjustmentDialogOpen} onOpenChange={setIsAdjustmentDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Adjust Stock: {ingredientToAdjust?.name}</DialogTitle>
                        <DialogDescription>Current stock: {ingredientToAdjust?.stock_qty.toLocaleString()} {ingredientToAdjust?.unit_type}</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <Label>Adjustment Type</Label>
                            <Select value={adjustmentData.type} onValueChange={(v) => setAdjustmentData({ ...adjustmentData, type: v as StockMovementType })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {adjustmentTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Quantity Change</Label>
                            <Input type="number" value={adjustmentData.qty_change} onChange={(e) => setAdjustmentData({ ...adjustmentData, qty_change: Number(e.target.value) })} placeholder="e.g. 10 or -5" />
                            <p className="text-xs text-muted-foreground">Use a negative number to decrease stock.</p>
                        </div>
                        <div className="space-y-2">
                            <Label>Reason</Label>
                            <Textarea value={adjustmentData.reason} onChange={(e) => setAdjustmentData({ ...adjustmentData, reason: e.target.value })} placeholder="e.g. 'End of month stock count'" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAdjustmentDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleAdjustmentSave}>Save Adjustment</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};


// ========= EDITOR PANEL (RIGHT SIDE / DRAWER) =========
const ProductEditor = ({ selectedProductId, onProductUpdate, activeTab, onTabChange }: {
    selectedProductId: string | null;
    onProductUpdate: () => void;
    activeTab: string;
    onTabChange: (tab: string) => void;
}) => {
    return (
        <Tabs value={activeTab} onValueChange={onTabChange} className="h-full flex flex-col min-h-0">
            <div className="px-4 py-4 grid grid-cols-1 w-full overflow-x-auto shrink-0">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="product"><Package className="w-4 h-4 mr-2 text-primary"/>Product</TabsTrigger>
                    <TabsTrigger value="categories"><Library className="w-4 h-4 mr-2 text-destructive"/>Categories</TabsTrigger>
                    <TabsTrigger value="modifiers"><SlidersHorizontal className="w-4 h-4 mr-2 text-purple-500"/>Modifiers</TabsTrigger>
                    <TabsTrigger value="ingredients"><Beaker className="w-4 h-4 mr-2 text-green-600"/>Ingredients</TabsTrigger>
                </TabsList>
            </div>
            <TabsContent value="product" className="grid grid-cols-1 w-full mt-0 overflow-x-auto min-h-0">
                <ProductForm productId={selectedProductId} onSave={onProductUpdate} />
            </TabsContent>
            <TabsContent value="categories" className="grid grid-cols-1 w-full mt-0 overflow-x-auto">
                <CategoryManager />
            </TabsContent>
            <TabsContent value="modifiers" className="grid grid-cols-1 w-full mt-0 overflow-x-auto">
                <ModifierManager />
            </TabsContent>
            <TabsContent value="ingredients" className="grid grid-cols-1 w-full mt-0 overflow-x-auto">
                <IngredientManager />
            </TabsContent>
        </Tabs>
    );
};


// ========= MAIN PAGE COMPONENT =========
export default function ProductManagementPage() {
    const { products } = useStore();
    const { toast } = useToast();
    const [viewMode, setViewMode] = useState<"card" | "thumbnail" | "list">('card');
    // const [searchTerm, setSearchTerm] = useState("");
    const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [activeTab, setActiveTab] = useState("product");

    useEffect(() => {
        setViewMode(window.innerWidth < 768 ? 'thumbnail' : 'card');
    }, []);

    // const filteredProducts = useMemo(() =>
    //     products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())),
    //     [products, searchTerm]
    // );

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
                           <PlusCircle className="h-4 w-4"/>
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
                        activeTab={activeTab}
                        onTabChange={setActiveTab}
                    />
                </SheetContent>
            </Sheet>
        </div>
    );
}
