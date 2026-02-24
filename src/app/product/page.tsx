
"use client";

import { useState, useMemo, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useStore } from "@/lib/store";
import { Product, Category, ModifierGroup, ModifierItem, ProductType } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// UI Components
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductSearchBar } from "@/components/ProductSearchBar";
import { ProductList } from "@/components/ProductList";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

// Icons
import { PlusCircle, Edit, Trash, SlidersHorizontal, Library, Package, Menu, Scan } from "lucide-react";

// Services
import { addProduct, updateProduct } from "@/services/productService";
import { addCategory, updateCategory, deleteCategory } from "@/services/categoryService";
import { addModifierGroup, updateModifierGroup, deleteModifierGroup, addModifierItem, updateModifierItem, deleteModifierItem } from "@/services/modifierService";


// ========= PRODUCT FORM =========
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
    modifier_group_ids: z.array(z.string()).optional(),
  });
  
type ProductFormValues = z.infer<typeof productFormSchema>;

const ProductForm = ({ productId, onSave }: { productId: string | null, onSave: () => void }) => {
    const { products, categories, modifierGroups } = useStore();
    const { toast } = useToast();
    const isEditing = !!productId;
    const product = useMemo(() => products.find(p => p.id === productId), [productId, products]);

    const form = useForm<ProductFormValues>({
        resolver: zodResolver(productFormSchema),
        defaultValues: {
            name: "", product_type: "retail", price: 0, cost_price: 0, stock: 0,
            low_stock_alert: 0, track_stock: true, is_active: true, has_variant: false,
            has_modifier: false, modifier_group_ids: [], sku: "", barcode: "",
        },
    });

    useEffect(() => {
        if (product) {
            form.reset({
                name: product.name, product_type: product.product_type, category_id: product.category_id,
                sku: product.sku, barcode: product.barcode,
                price: product.price, cost_price: product.cost_price, stock: product.stock,
                low_stock_alert: product.low_stock_alert, track_stock: product.track_stock,
                is_active: product.is_active, has_variant: product.has_variant, has_modifier: product.has_modifier,
                modifier_group_ids: product.modifier_group_ids || [],
            });
        } else {
            form.reset(form.formState.defaultValues);
        }
    }, [product, form]);

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
        } catch (error) {
            toast({ variant: "destructive", title: "Error saving product" });
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="h-full flex flex-col">
                 <ScrollArea className="flex-grow p-1">
                    <div className="space-y-6 p-4">
                        <Card>
                            <CardHeader><CardTitle>Product Details</CardTitle></CardHeader>
                            <CardContent className="space-y-6">
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
                                <FormField control={form.control} name="name" render={({ field }) => (
                                    <FormItem><FormLabel>Product Name</FormLabel><FormControl><Input placeholder="e.g. Cokelat Batang" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="category_id" render={({ field }) => (
                                    <FormItem><FormLabel>Category</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl><SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger></FormControl>
                                            <SelectContent>{categories.map(cat => (<SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>))}</SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <FormField control={form.control} name="price" render={({ field }) => (
                                        <FormItem><FormLabel>Selling Price</FormLabel><FormControl><div className="relative"><span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">Rp</span><Input type="number" placeholder="8000" className="pl-10" {...field} /></div></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={form.control} name="cost_price" render={({ field }) => (
                                        <FormItem><FormLabel>Cost Price</FormLabel><FormControl><div className="relative"><span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">Rp</span><Input type="number" placeholder="6500" className="pl-10" {...field} /></div></FormControl><FormDescription>Used to calculate profit.</FormDescription><FormMessage /></FormItem>
                                    )} />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <FormField control={form.control} name="sku" render={({ field }) => (
                                        <FormItem><FormLabel>SKU (Stock Keeping Unit)</FormLabel><FormControl><Input placeholder="e.g. F-DRK-001" {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={form.control} name="barcode" render={({ field }) => (
                                        <FormItem><FormLabel>Barcode</FormLabel>
                                         <div className="flex gap-2">
                                            <FormControl><Input placeholder="Scan or enter barcode" {...field} /></FormControl>
                                            <Button type="button" variant="outline" size="icon"><Scan className="h-5 w-5"/></Button>
                                         </div>
                                         <FormMessage />
                                        </FormItem>
                                    )} />
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader><CardTitle>Inventory</CardTitle></CardHeader>
                            <CardContent className="space-y-6">
                                <FormField control={form.control} name="track_stock" render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4"><div className="space-y-0.5"><FormLabel className="text-base">Track Stock</FormLabel><FormDescription>Automatically deduct stock for each sale.</FormDescription></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                                )} />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <FormField control={form.control} name="stock" render={({ field }) => (
                                        <FormItem><FormLabel>Initial Stock</FormLabel><FormControl><Input type="number" placeholder="50" {...field} disabled={!form.watch('track_stock')} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={form.control} name="low_stock_alert" render={({ field }) => (
                                        <FormItem><FormLabel>Low Stock Alert</FormLabel><FormControl><Input type="number" placeholder="10" {...field} disabled={!form.watch('track_stock')} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                </div>
                            </CardContent>
                        </Card>
                         <Card>
                            <CardHeader><CardTitle>Customization</CardTitle></CardHeader>
                             <CardContent className="space-y-6">
                                <FormField control={form.control} name="has_modifier" render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                        <div className="space-y-0.5"><FormLabel className="text-base">Enable Modifiers</FormLabel><FormDescription>Allow add-ons like toppings or sugar levels.</FormDescription></div>
                                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={form.watch('product_type') === 'retail'} /></FormControl>
                                    </FormItem>
                                )} />
                                {form.watch('has_modifier') && form.watch('product_type') === 'food_and_beverage' && (
                                    <FormField control={form.control} name="modifier_group_ids" render={() => (
                                        <FormItem className="rounded-lg border p-4">
                                            <div className="mb-4"><FormLabel className="text-base">Modifier Groups</FormLabel><FormDescription>Select which modifier groups can be applied.</FormDescription></div>
                                            <div className="space-y-2">
                                                {modifierGroups.map((group) => (<FormField key={group.id} control={form.control} name="modifier_group_ids" render={({ field }) => {
                                                    return (<FormItem key={group.id} className="flex flex-row items-start space-x-3 space-y-0">
                                                        <FormControl><Checkbox checked={field.value?.includes(group.id)} onCheckedChange={(checked) => {
                                                            return checked ? field.onChange([...(field.value || []), group.id]) : field.onChange(field.value?.filter((value) => value !== group.id))
                                                        }} /></FormControl>
                                                        <FormLabel className="font-normal">{group.name}</FormLabel>
                                                    </FormItem>)
                                                }} />))}
                                            </div><FormMessage />
                                        </FormItem>
                                    )} />
                                )}
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader><CardTitle>Availability</CardTitle></CardHeader>
                            <CardContent>
                                <FormField control={form.control} name="is_active" render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4"><div className="space-y-0.5"><FormLabel className="text-base">Product Active</FormLabel><FormDescription>Allow this product to be sold.</FormDescription></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                                )} />
                            </CardContent>
                        </Card>
                    </div>
                 </ScrollArea>
                <div className="p-4 border-t mt-auto">
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
             <ScrollArea className="flex-grow">
                <Table>
                    <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {categories.map(cat => (
                            <TableRow key={cat.id}>
                                <TableCell className="font-medium">{cat.name}</TableCell>
                                <TableCell><Badge variant={cat.is_active ? "default" : "outline"}>{cat.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" onClick={() => openDialog(cat)}><Edit className="h-4 w-4" /></Button>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"><Trash className="h-4 w-4" /></Button></AlertDialogTrigger>
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
             </ScrollArea>
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
            <ScrollArea className="flex-grow -mx-4">
                 <div className="px-4">
                    {modifierGroups.map(group => (
                        <Card key={group.id} className="mb-4">
                            <CardHeader>
                                <div className="flex justify-between items-center">
                                    <CardTitle className="text-lg">{group.name}</CardTitle>
                                    <div className="flex items-center gap-2">
                                        <Button variant="ghost" size="icon" onClick={() => openGroupDialog(group)}><Edit className="h-4 w-4"/></Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"><Trash className="h-4 w-4" /></Button></AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader><AlertDialogTitle>Delete "{group.name}"?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the group and all its items. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                                                <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleGroupDelete(group.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </div>
                                <CardDescription>
                                    {group.required ? "Required" : "Optional"} &bull; Select {group.min_select} to {group.max_select}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Price</TableHead><TableHead className="text-right"><Button size="sm" variant="outline" onClick={() => openItemDialog(group.id, null)}><PlusCircle className="mr-2 h-4"/>Add Item</Button></TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {group.items.map(item => (
                                            <TableRow key={item.id}>
                                                <TableCell>{item.name}</TableCell>
                                                <TableCell>{formatCurrency(item.additional_price)}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="icon" onClick={() => openItemDialog(group.id, item)}><Edit className="h-4 w-4"/></Button>
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"><Trash className="h-4 w-4" /></Button></AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader><AlertDialogTitle>Delete "{item.name}"?</AlertDialogTitle></AlertDialogHeader>
                                                            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleItemDelete(group.id, item.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
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


// ========= EDITOR PANEL (RIGHT SIDE / DRAWER) =========
const ProductEditor = ({ selectedProductId, onProductUpdate, activeTab, onTabChange }: {
    selectedProductId: string | null;
    onProductUpdate: () => void;
    activeTab: string;
    onTabChange: (tab: string) => void;
}) => {
    return (
        <Tabs value={activeTab} onValueChange={onTabChange} className="h-full flex flex-col">
            <div className="px-4 pt-4">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="product"><Package className="w-4 h-4 mr-2"/>Product</TabsTrigger>
                    <TabsTrigger value="categories"><Library className="w-4 h-4 mr-2"/>Categories</TabsTrigger>
                    <TabsTrigger value="modifiers"><SlidersHorizontal className="w-4 h-4 mr-2"/>Modifiers</TabsTrigger>
                </TabsList>
            </div>
            <TabsContent value="product" className="flex-grow mt-0">
                <ProductForm productId={selectedProductId} onSave={onProductUpdate} />
            </TabsContent>
            <TabsContent value="categories" className="flex-grow mt-0">
                <CategoryManager />
            </TabsContent>
            <TabsContent value="modifiers" className="flex-grow mt-0">
                <ModifierManager />
            </TabsContent>
        </Tabs>
    );
};


// ========= MAIN PAGE COMPONENT =========
export default function ProductManagementPage() {
    const { products } = useStore();
    const [viewMode, setViewMode] = useState<"card" | "thumbnail" | "list">('card');
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [activeTab, setActiveTab] = useState("product");

    useEffect(() => {
        setViewMode(window.innerWidth < 768 ? 'thumbnail' : 'card');
    }, []);

    const filteredProducts = useMemo(() =>
        products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())),
        [products, searchTerm]
    );

    const handleSelectProduct = (product: Product) => {
        setSelectedProductId(product.id);
        setActiveTab("product");
        if (window.innerWidth < 768) {
            setIsDrawerOpen(true);
        }
    };
    
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
        <div className="w-full h-[calc(100vh-4rem)] md:grid md:grid-cols-10">
            {/* Left Panel: Product List */}
            <div className="col-span-10 md:col-span-6 lg:col-span-7 h-full flex flex-col bg-muted/40">
                <div className="p-4 border-b">
                    <div className="flex items-center gap-2">
                        <ProductSearchBar
                            searchTerm={searchTerm}
                            onSearchTermChange={setSearchTerm}
                            viewMode={viewMode}
                            onViewModeChange={setViewMode}
                        />
                        <Button onClick={handleAddNew} className="hidden md:inline-flex">
                           <PlusCircle className="mr-2 h-4 w-4"/> Add Product
                        </Button>
                    </div>
                </div>
                <ScrollArea className="flex-grow">
                    <ProductList
                        products={filteredProducts}
                        viewMode={viewMode}
                        onItemClick={handleSelectProduct}
                        selectedProductId={selectedProductId}
                        context="product"
                    />
                </ScrollArea>
                <div className="p-4 border-t md:hidden flex gap-2">
                    <Button onClick={handleAddNew} className="w-full">
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Product
                    </Button>
                    <Button variant="outline" onClick={() => setIsDrawerOpen(true)} className="w-full">
                        <Menu className="mr-2 h-4 w-4" /> Manage
                    </Button>
                </div>
            </div>

            {/* Right Panel: Editor (Desktop) */}
            <aside className="hidden md:block col-span-4 lg:col-span-3 border-l h-full">
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
