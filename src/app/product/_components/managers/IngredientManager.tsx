'use client';

import React, { useState } from 'react';
import { useStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import { RawIngredient, StockMovementType } from '@/lib/types';
import { addIngredient, updateIngredient, deleteIngredient } from '@/services/ingredientService';
import { adjustIngredientStock } from '@/services/stockService';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { PlusCircle, Edit, Trash, Package, Banknote } from 'lucide-react';

const adjustmentTypes: { value: StockMovementType, label: string }[] = [
    { value: 'initial_balance', label: 'Opening Balance (+)' },
    { value: 'restock', label: 'Purchase / Restock (+)' },
    { value: 'correction', label: 'Correction (+/-)' },
    { value: 'lost', label: 'Lost (-)' },
    { value: 'damaged', label: 'Damaged (-)' },
];

const IngredientManagerComponent = () => {
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
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message || "Could not save ingredient." });
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteIngredient(id);
            toast({ title: "Ingredient Deleted" });
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message || "Could not delete ingredient." });
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
                                <div className="flex-1 space-y-1">
                                    <p className="font-semibold leading-tight mb-3">{ing.name}</p>
                                    <div className="flex items-center gap-2"><Package className="h-4 w-4 shrink-0 text-purple-500" /><span><span className="font-medium">{ing.stock_qty.toLocaleString()} {ing.unit_type}</span></span></div>
                                    <div className="flex items-center gap-2"><Banknote className="h-4 w-4 shrink-0 text-green-600" /><span>{formatCurrency(ing.cost_per_unit)} / {ing.unit_type}</span></div>
                                </div>
                                <Button size="sm" variant="outline" onClick={() => openAdjustmentDialog(ing)}>Adjust</Button>
                            </div>
                            <Separator className="my-3" />
                            <div className="flex justify-end gap-2">
                                <Button variant="ghost" size="sm" onClick={() => openDialog(ing)}><Edit className="h-4 w-4 mr-1" />Edit</Button>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="text-destructive hover:text-destructive"><Trash className="h-4 w-4 mr-1" />Delete</Button></AlertDialogTrigger>
                                    <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete "{ing.name}"?</AlertDialogTitle></AlertDialogHeader>
                                        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(ing.id)}>Confirm Delete</AlertDialogAction></AlertDialogFooter>
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
                        <div className="space-y-2"><Label>Name</Label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><Label>Initial Stock</Label><Input type="number" value={formData.stock_qty} onChange={(e) => setFormData({ ...formData, stock_qty: Number(e.target.value) })} /></div>
                            <div className="space-y-2"><Label>Unit</Label>
                                <Select value={formData.unit_type} onValueChange={(v) => setFormData({ ...formData, unit_type: v as any })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent><SelectItem value="gram">Gram (g)</SelectItem><SelectItem value="ml">Milliliter (ml)</SelectItem><SelectItem value="pcs">Pieces (pcs)</SelectItem></SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-2"><Label>Cost per Unit</Label><Input type="number" value={formData.cost_per_unit} onChange={(e) => setFormData({ ...formData, cost_per_unit: Number(e.target.value) })} /></div>
                    </div>
                    <DialogFooter><Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button><Button onClick={handleSave}>Save</Button></DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog open={isAdjustmentDialogOpen} onOpenChange={setIsAdjustmentDialogOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Adjust Stock: {ingredientToAdjust?.name}</DialogTitle><DialogDescription>Current stock: {ingredientToAdjust?.stock_qty.toLocaleString()} {ingredientToAdjust?.unit_type}</DialogDescription></DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2"><Label>Adjustment Type</Label>
                            <Select value={adjustmentData.type} onValueChange={(v) => setAdjustmentData({ ...adjustmentData, type: v as StockMovementType })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>{adjustmentTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2"><Label>Quantity Change</Label><Input type="number" value={adjustmentData.qty_change} onChange={(e) => setAdjustmentData({ ...adjustmentData, qty_change: Number(e.target.value) })} placeholder="e.g. 10 or -5" /><p className="text-xs text-muted-foreground">Use a negative number to decrease stock.</p></div>
                        <div className="space-y-2"><Label>Reason</Label><Textarea value={adjustmentData.reason} onChange={(e) => setAdjustmentData({ ...adjustmentData, reason: e.target.value })} placeholder="e.g. 'End of month stock count'" /></div>
                    </div>
                    <DialogFooter><Button variant="outline" onClick={() => setIsAdjustmentDialogOpen(false)}>Cancel</Button><Button onClick={handleAdjustmentSave}>Save Adjustment</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export const IngredientManager = React.memo(IngredientManagerComponent);
IngredientManager.displayName = "IngredientManager";
