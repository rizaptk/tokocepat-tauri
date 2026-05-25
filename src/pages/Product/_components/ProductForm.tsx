import React, { useState, useMemo, useEffect, useRef } from "react";
import { useForm, useFieldArray } from "react-hook-form";
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
import { useGlobalNumberInputFix } from "@/hooks/useGlobalNumberInputFix";
import { resizeImageWorker } from "@/lib/imageWorker"
// import { ImagePicker } from "@/components/ImagePicker";

// Types (Replacing Zod Schema)
export interface VariantFormData {
    id?: string;
    name: string;
    additional_price: number;
    sku?: string;
    track_stock: boolean;
    stock: number;
    low_stock_alert?: number;
}

export interface RecipeItemFormData {
    ingredient_id: string;
    quantity: number;
}

export interface ProductFormData {
    name: string;
    product_type: "retail" | "food_and_beverage";
    category_id?: string;
    sku?: string;
    barcode?: string;
    price: number;
    cost_price?: number;
    stock: number;
    low_stock_alert?: number;
    track_stock: boolean;
    is_active: boolean;
    has_variant: boolean;
    has_modifier: boolean;
    is_composite: boolean;
    modifier_group_ids?: string[];
    variants?: VariantFormData[];
    recipe_items?: RecipeItemFormData[];
    imageUrl?: string;
    imageHint?: string;

    is_consignment?: boolean;
    consignor_name?: string;
    consignment_commission_type?: 'percentage' | 'flat';
    consignment_commission_value?: number;
}

interface ProductFormProps {
    productId: string | null;
    onSave: () => void;
    onCancel: () => void;
}

const initialFormValues: ProductFormData = {
    name: "", product_type: "retail", price: 0, cost_price: 0, stock: 0,
    low_stock_alert: 0, track_stock: true, is_active: true, has_variant: false,
    has_modifier: false, is_composite: false, modifier_group_ids: [], sku: "", barcode: "",
    variants: [], recipe_items: [], imageUrl: "", imageHint: "",
    // Consignment defaults
    is_consignment: false,
    consignor_name: "",
    consignment_commission_type: "percentage",
    consignment_commission_value: 0
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
        // Removed zodResolver
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
    const isConsignment = form.watch('is_consignment');

    useGlobalNumberInputFix();

    useEffect(() => {
        if (product) {
            const variantsForProduct = productVariants.filter(v => v.product_id === product.id);
            const recipeForProduct = recipes.find(r => r.product_id === product.id);
            form.reset({
                name: product.name, product_type: product.product_type as any, category_id: product.category_id,
                sku: product.sku, barcode: product.barcode,
                price: product.price, cost_price: product.cost_price, stock: product.stock,
                low_stock_alert: product.low_stock_alert, track_stock: product.track_stock,
                is_active: product.is_active, has_variant: product.has_variant, has_modifier: product.has_modifier,
                is_composite: product.is_composite || false,
                modifier_group_ids: product.modifier_group_ids || [],
                variants: variantsForProduct as any,
                recipe_items: recipeForProduct ? (recipeForProduct.items as any) : [],
                imageUrl: product.imageUrl,
                imageHint: product.imageHint,
                is_consignment: product.is_consignment || false,
                consignor_name: product.consignor_name || "",
                consignment_commission_type: product.consignment_commission_type || "percentage",
                consignment_commission_value: product.consignment_commission_value || 0,
            });
        } else {
            form.reset(initialFormValues);
        }
    }, [product, form, productVariants, recipes]);

    const handleScanSuccess = (barcode: string) => {
        form.setValue('barcode', barcode, { shouldValidate: true });
        setIsScannerOpen(false);
    };

    const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        try {
            const resizedDataUrl = await resizeImageWorker(file, 348)
            form.setValue(
                "imageUrl",
                resizedDataUrl,
                { shouldDirty: true }
            )
            form.setValue(
                "imageHint",
                file.name.split(".").slice(0, -1).join("."),
                { shouldDirty: true }
            )
        } catch {
            toast({
                variant: "destructive",
                title: "Gagal Memproses Gambar",
                description: "Gambar tidak dapat diproses, silakan coba lagi."
            })
        }
    }

    async function onSubmit(data: ProductFormData) {
        try {
            if (data.is_consignment) {
                data.cost_price = 0;
            }
            if (isEditing && product) {
                await updateProduct(product.id, data);
                toast({ title: "Produk Diperbarui" });
            } else {
                await addProduct(data);
                toast({ title: "Produk Berhasil Dibuat" });
            }
        } catch (error: any) {
            toast({ variant: "destructive", title: "Gagal Menyimpan", description: error.message });
        } finally {
            onSave();
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
                                <CardHeader><CardTitle>Detail Produk</CardTitle></CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="flex items-stretch w-full gap-6">
                                        <div onClick={() => imageInputRef.current?.click()} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && imageInputRef.current?.click()} className="group relative w-48 h-48 rounded-xl overflow-hidden border bg-muted cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary">
                                            <img
                                                src={imageUrl || "/images/placeholder.svg"}
                                                alt={form.getValues("name") || "Product image"}
                                                style={{ position: 'absolute', height: '100%', width: '100%', inset: 0, color: 'transparent' }}
                                                className="object-cover transition-transform duration-300 group-hover:scale-105"
                                            />
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors duration-300 flex items-center justify-center">
                                                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-white text-sm font-medium flex flex-col items-center gap-2">
                                                    <Upload className="h-6 w-6" />
                                                    {imageUrl ? "Ubah Foto" : "Unggah Foto"}
                                                </div>
                                            </div>
                                        </div>
                                        <input type="file" ref={imageInputRef} hidden accept="image/*" onChange={handleImageSelect} />
                                        <div className="flex flex-col grow gap-6">
                                            <FormField
                                                control={form.control}
                                                name="product_type"
                                                rules={{ required: "You need to select a product type." }}
                                                render={({ field }) => (
                                                    <FormItem className="space-y-3"><FormLabel>Tipe Produk</FormLabel>
                                                        <FormControl><RadioGroup onValueChange={field.onChange} value={field.value} className="flex flex-col space-y-1">
                                                            <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="retail" /></FormControl><FormLabel className="font-normal">Retail / Barang</FormLabel></FormItem>
                                                            <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="food_and_beverage" /></FormControl><FormLabel className="font-normal">F&B / Makanan</FormLabel></FormItem>
                                                        </RadioGroup></FormControl><FormMessage />
                                                    </FormItem>
                                                )} />
                                            <div className="grow"></div>
                                            <FormField control={form.control} name="is_active" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between"><FormLabel>Status Aktif</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                                        </div>
                                    </div>
                                    <FormField control={form.control} name="barcode" render={({ field }) => (
                                        <FormItem><FormLabel>Barcode</FormLabel><FormControl>
                                            <Input 
                                                placeholder="Scan atau ketik barcode" 
                                                {...field} 
                                                onKeyDown={(e) => {
                                                    (field as any).onKeyDown?.(e); // preserve existing behavior (optional)
                                                    if (e.key === "Enter") {
                                                    e.preventDefault();
                                                    }
                                                }}
                                            /></FormControl>
                                            <div className="flex gap-2 pt-2">
                                                <Dialog open={isScannerOpen} onOpenChange={setIsScannerOpen}><DialogTrigger asChild><Button type="button" variant="outline" className="w-full"><Scan className="h-4 w-4" /> Kamera</Button></DialogTrigger>
                                                    <DialogContent><DialogHeader><DialogTitle>Scan Barcode</DialogTitle></DialogHeader><BarcodeScanner onScanSuccess={handleScanSuccess} /></DialogContent>
                                                </Dialog>
                                                <Button type="button" variant="outline" className="w-full" onClick={() => { form.setValue('barcode', Math.floor(1000000000000 + Math.random() * 9000000000000).toString(), { shouldValidate: true }); }}><Zap className="h-4 w-4" /> Acak</Button>
                                            </div><FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="sku" render={({ field }) => (<FormItem><FormLabel>SKU / Kode Produk</FormLabel><FormControl><Input placeholder="cth. F-DRK-001" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField
                                        control={form.control}
                                        name="name"
                                        rules={{ required: "Product name is required.", minLength: { value: 2, message: "Product name must be at least 2 characters." } }}
                                        render={({ field }) => (<FormItem><FormLabel>Nama Produk</FormLabel><FormControl><Input placeholder="cth. Cokelat Batang" {...field} /></FormControl><FormMessage /></FormItem>)}
                                    />
                                    <FormField control={form.control} name="category_id" render={({ field }) => (
                                        <FormItem><FormLabel>Kategori</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Pilih kategori" /></SelectTrigger></FormControl><SelectContent>{categories.map(cat => (<SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>
                                    )} />
                                    <FormField
                                        control={form.control}
                                        name="price"
                                        rules={{ required: "Price is required", min: { value: 0, message: "Price cannot be negative." } }}
                                        render={({ field }) => (<FormItem><FormLabel>Harga Jual</FormLabel><FormControl><div className="relative"><span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">Rp</span><Input type="number" placeholder="8000" className="pl-10" {...field} onChange={(e) => field.onChange(Number(e.target.value))} /></div></FormControl><FormMessage /></FormItem>)}
                                    />
                                    {
                                        !isConsignment &&
                                        <FormField
                                            control={form.control}
                                            name="cost_price"
                                            rules={{ min: { value: 0, message: "Cost price cannot be negative." } }}
                                            render={({ field }) => (<FormItem><FormLabel>Harga Modal</FormLabel><FormControl><div className="relative"><span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">Rp</span><Input type="number" placeholder="6500" className="pl-10" {...field} onChange={(e) => field.onChange(Number(e.target.value || 0))} /></div></FormControl><FormDescription>Untuk menghitung laba kotor.</FormDescription><FormMessage /></FormItem>)}
                                        />
                                    }
                                    <Separator />
                                    {/* Consignment Switch & Form Fields */}
                                    <FormField control={form.control} name="is_consignment" render={({ field }) => (
                                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 bg-muted/20">
                                            <div className="space-y-0.5">
                                                <FormLabel>Produk Konsinyasi (Titipan)</FormLabel>
                                                {
                                                    !isConsignment ?
                                                    <FormDescription>Aktifkan jika item dititipkan oleh pihak ketiga.</FormDescription> :
                                                    <FormDescription>Kontrol Stok Masuk/Penarikan pada inventori.</FormDescription>
                                                }
                                            </div>
                                            <FormControl>
                                                <Switch 
                                                    checked={field.value} 
                                                    onCheckedChange={(val) => {
                                                        field.onChange(val);
                                                        if (!val) {
                                                            form.setValue('consignor_name', '');
                                                            form.setValue('consignment_commission_type', 'percentage');
                                                            form.setValue('consignment_commission_value', 0);
                                                        }
                                                    }} 
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )} />

                                    {form.watch('is_consignment') && (
                                        <>
                                            <FormField control={form.control} name="consignor_name" rules={{ required: "Nama penitip wajib diisi" }} render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Nama Penitip (Consignor)</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="Contoh: Ibu Ani" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />

                                            <div className="grid grid-cols-1 gap-4">
                                                <FormField control={form.control} name="consignment_commission_type" render={({ field }) => (
                                                    <FormItem className="space-y-3">
                                                        <FormLabel>Tipe Komisi</FormLabel>
                                                        <FormControl>
                                                            <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4">
                                                                <FormItem className="flex items-center space-x-2 space-y-0">
                                                                    <FormControl><RadioGroupItem value="percentage" /></FormControl>
                                                                    <FormLabel className="font-normal cursor-pointer">Persentase (%)</FormLabel>
                                                                </FormItem>
                                                                <FormItem className="flex items-center space-x-2 space-y-0">
                                                                    <FormControl><RadioGroupItem value="flat" /></FormControl>
                                                                    <FormLabel className="font-normal cursor-pointer">Flat (Rp)</FormLabel>
                                                                </FormItem>
                                                            </RadioGroup>
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )} />

                                                <FormField 
                                                    control={form.control} 
                                                    name="consignment_commission_value" 
                                                    rules={{ 
                                                        required: "Nilai komisi wajib diisi",
                                                        min: { value: 0, message: "Komisi tidak boleh kurang dari 0" }, 
                                                        validate: (value) => {
                                                            const type = form.getValues('consignment_commission_type');
                                                            if (type === 'percentage' && (value||0) > 100) {
                                                                return "Komisi persentase tidak boleh melebihi 100%";
                                                            }
                                                            return true;
                                                        }
                                                    }} 
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Nilai Komisi Toko</FormLabel>
                                                            <FormControl>
                                                                <div className="relative">
                                                                    {form.watch('consignment_commission_type') === 'flat' && (
                                                                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground text-xs">Rp</span>
                                                                    )}
                                                                    <Input 
                                                                        type="text"
                                                                        inputMode="numeric" 
                                                                        placeholder={form.watch('consignment_commission_type') === 'flat' ? "5000" : "10"} 
                                                                        className={form.watch('consignment_commission_type') === 'flat' ? "pl-8" : ""} 
                                                                        {...field} 
                                                                        onChange={(e) => field.onChange(Number(e.target.value))} 
                                                                    />
                                                                    {form.watch('consignment_commission_type') === 'percentage' && (
                                                                        <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground text-xs">%</span>
                                                                    )}
                                                                </div>
                                                            </FormControl>
                                                            <FormDescription>
                                                                {form.watch('consignment_commission_type') === 'percentage' 
                                                                    ? "Persentase bagi hasil untuk toko dari total nilai jual."
                                                                    : "Keuntungan tetap bagi toko per unit item terjual."}
                                                            </FormDescription>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )} 
                                                />
                                            </div>
                                        </>
                                    )}
                                    <Separator />
                                    <FormField control={form.control} name="track_stock" render={({ field }) => (<FormItem className={cn("flex flex-row items-center justify-between", (hasVariant || isComposite) && "opacity-50")}><FormLabel>Lacak Stok</FormLabel><FormControl><Switch checked={(hasVariant || isComposite) ? false : field.value} onCheckedChange={field.onChange} disabled={hasVariant || isComposite} /></FormControl></FormItem>)} />
                                    <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-6", (hasVariant || isComposite) && "opacity-50")}>
                                        <FormField
                                            control={form.control}
                                            name="stock"
                                            rules={{ min: { value: 0, message: "Stock cannot be negative." } }}
                                            render={({ field }) => (<FormItem><FormLabel>Stok Awal</FormLabel><FormControl><Input type="number" placeholder="50" {...field} disabled={isEditing || hasVariant || isComposite || !form.watch('track_stock')} onChange={(e) => field.onChange(Number(e.target.value))} /></FormControl><FormDescription>Hanya bisa diisi saat buat baru.</FormDescription><FormMessage /></FormItem>)}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="low_stock_alert"
                                            rules={{ min: { value: 0, message: "Low stock alert cannot be negative." } }}
                                            render={({ field }) => (<FormItem><FormLabel>Batas Stok Minimum</FormLabel><FormControl><Input type="number" placeholder="10" {...field} disabled={hasVariant || isComposite || !form.watch('track_stock')} onChange={(e) => field.onChange(Number(e.target.value))} /></FormControl><FormMessage /></FormItem>)}
                                        />
                                    </div>
                                    <Separator />
                                    <FormField control={form.control} name="has_variant" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between"><FormLabel>Gunakan Varian</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                                    {hasVariant && (<div className="space-y-4">{variantFields.map((field, index) => (<VariantItem key={field.id} index={index} field={field} form={form} removeVariant={removeVariant} isEditing={isEditing} />))}<Button type="button" variant="outline" size="sm" onClick={() => appendVariant({ name: '', additional_price: 0, stock: 0, sku: '', track_stock: true, low_stock_alert: 0 })}><PlusCircle className="mr-2 h-4 w-4" /> Tambah Varian</Button></div>)}
                                    {productType === 'food_and_beverage' && (<>
                                        <Separator />
                                        <FormField control={form.control} name="has_modifier" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between"><FormLabel>Gunakan Modifier</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                                        {form.watch('has_modifier') && productType === 'food_and_beverage' && (<FormField control={form.control} name="modifier_group_ids" render={() => (<FormItem className="grid grid-cols-2 space-y-0">{modifierGroups.map((group) => (<FormField key={group.id} control={form.control} name="modifier_group_ids" render={({ field }) => (<FormItem key={group.id} className="flex flex-row items-start space-x-3 space-y-0 py-2"><FormControl><Checkbox checked={field.value?.includes(group.id)} onCheckedChange={(checked) => checked ? field.onChange([...(field.value || []), group.id]) : field.onChange(field.value?.filter((value) => value !== group.id))} /></FormControl><FormLabel className="font-normal">{group.name}</FormLabel></FormItem>)} />))}<FormMessage /></FormItem>)} />)}
                                        <Separator />
                                        <FormField control={form.control} name="is_composite" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between"><FormLabel>Produk Komposit / Resep</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={productType !== 'food_and_beverage'} /></FormControl></FormItem>)} />
                                        {isComposite && productType === 'food_and_beverage' && (<div className="space-y-4 pt-4">{recipeFields.map((field, index) => (<CompositeItem key={field.id} rawIngredients={rawIngredients} index={index} field={field} form={form} removeRecipeItem={removeRecipeItem} />))}<Button type="button" variant="outline" size="sm" onClick={() => appendRecipeItem({ ingredient_id: '', quantity: 0 })}><PlusCircle className="mr-2 h-4 w-4" /> Tambah Bahan</Button></div>)}
                                    </>)}
                                    <Separator />
                                </CardContent>
                            </Card>
                        </div>
                    </ScrollArea>
                </div>
                <div className="p-4 mt-auto shrink-0 flex items-center gap-4">
                    {isEditing && (<Button variant="outline" type="button" className="flex-1" onClick={onCancel}>Batal</Button>)}
                    <Button type="submit" className="flex-1">{isEditing ? "Simpan Perubahan" : "Buat Produk"}</Button>
                </div>
            </form>
        </Form>
    );
};
