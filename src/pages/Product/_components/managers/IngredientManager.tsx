'use client';

import React, { useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import { RawIngredient, StockMovementType } from '@/lib/types';
import { addIngredient, updateIngredient, deleteIngredient } from '@/services/ingredientService';
import { adjustIngredientStock } from '@/services/stockService';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea, ScrollAreaHandle } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { PlusCircle, Edit, Trash, Package, Banknote } from 'lucide-react';
import { ScrollShadow } from '@/components/ui/scrollshadow';

const adjustmentTypes: { value: StockMovementType, label: string }[] = [
    { value: 'initial_balance', label: 'Saldo Awal (+)' },
    { value: 'restock', label: 'Stok Masuk / Restok (+)' },
    { value: 'correction', label: 'Koreksi (+/-)' },
    { value: 'lost', label: 'Hilang (-)' },
    { value: 'damaged', label: 'Rusak (-)' },
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

    const scrollRef = useRef<ScrollAreaHandle>(null);

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
                toast({ title: "Bahan diperbarui" });
            } else {
                await addIngredient(formData);
                toast({ title: "Bahan ditambahkan" });
            }
            setIsAddDialogOpen(false);
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message || "Gagal menyimpan bahan." });
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteIngredient(id);
            toast({ title: "Bahan dihapus" });
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message || "Gagal menghapus bahan." });
        }
    };

    const handleAdjustmentSave = async () => {
        if (!ingredientToAdjust || !adjustmentData.reason.trim() || adjustmentData.qty_change === 0) {
            toast({ variant: 'destructive', title: 'Input Tidak Valid', description: 'Mohon isi semua kolom dan pastikan jumlah tidak nol.' });
            return;
        }
        try {
            await adjustIngredientStock(ingredientToAdjust.id, adjustmentData.type, adjustmentData.qty_change, adjustmentData.reason);
            toast({ title: 'Stok Disesuaikan', description: `Stok ${ingredientToAdjust.name} telah diperbarui.` });
            setIsAdjustmentDialogOpen(false);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Penyesuaian Gagal', description: error.message || "Gagal menyesuaikan stok." });
        }
    };

    const formatCurrency = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

    return (
        <div className="p-0 h-full flex flex-col min-h-0">
            <div className="flex justify-between items-center my-4 px-4">
                <h3 className="font-semibold">Kelola Bahan Baku</h3>
                <Button size="sm" onClick={() => openDialog(null)}><PlusCircle className="mr-2 h-4 w-4" /> Tambah</Button>
            </div>
            <div className='flex-1 min-h-0 flex flex-col overflow-hidden relative px-4'>
                <ScrollShadow scrollRef={scrollRef} side="top" />
                <ScrollArea className="flex-1 min-h-0 -mx-4 px-4" ref={scrollRef}>
                    <div className="space-y-3">
                        {rawIngredients.map((ing) => (
                            <Card key={ing.id} className="p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 space-y-1">
                                        <p className="font-semibold leading-tight mb-3">{ing.name}</p>
                                        <div className="flex items-center gap-2"><Package className="h-4 w-4 shrink-0 text-purple-500" /><span><span className="font-medium">{ing.stock_qty.toLocaleString()} {ing.unit_type}</span></span></div>
                                        <div className="flex items-center gap-2"><Banknote className="h-4 w-4 shrink-0 text-green-600" /><span>{formatCurrency(ing.cost_per_unit)} / {ing.unit_type}</span></div>
                                    </div>
                                    <Button size="sm" variant="outline" onClick={() => openAdjustmentDialog(ing)}>Stok</Button>
                                </div>
                                <Separator className="my-3" />
                                <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="sm" onClick={() => openDialog(ing)}><Edit className="h-4 w-4 mr-1" />Ubah</Button>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="text-destructive hover:text-destructive"><Trash className="h-4 w-4 mr-1" />Hapus</Button></AlertDialogTrigger>
                                        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Hapus "{ing.name}"?</AlertDialogTitle></AlertDialogHeader>
                                            <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(ing.id)}>Hapus</AlertDialogAction></AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            </Card>
                        ))}
                    </div>
                </ScrollArea>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogContent className='bg-card'>
                    <DialogHeader><DialogTitle>{ingredientToEdit ? 'Ubah' : 'Tambah'} Bahan</DialogTitle></DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2"><Label>Nama Bahan</Label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><Label>Stok Awal</Label><Input type="number" value={formData.stock_qty} onChange={(e) => setFormData({ ...formData, stock_qty: Number(e.target.value) })} /></div>
                            <div className="space-y-2"><Label>Satuan</Label>
                                <Select value={formData.unit_type} onValueChange={(v) => setFormData({ ...formData, unit_type: v as any })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent><SelectItem value="gram">Gram (g)</SelectItem><SelectItem value="ml">Milliliter (ml)</SelectItem><SelectItem value="pcs">Pieces (pcs)</SelectItem></SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-2"><Label>Harga per Satuan</Label><Input type="number" value={formData.cost_per_unit} onChange={(e) => setFormData({ ...formData, cost_per_unit: Number(e.target.value) })} /></div>
                    </div>
                    <DialogFooter><Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Batal</Button><Button onClick={handleSave}>Simpan</Button></DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog open={isAdjustmentDialogOpen} onOpenChange={setIsAdjustmentDialogOpen}>
                <DialogContent className='bg-card'>
                    <DialogHeader><DialogTitle>Sesuaikan Stok: {ingredientToAdjust?.name}</DialogTitle><DialogDescription>Stok saat ini: {ingredientToAdjust?.stock_qty.toLocaleString()} {ingredientToAdjust?.unit_type}</DialogDescription></DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2"><Label>Tipe Penyesuaian</Label>
                            <Select value={adjustmentData.type} onValueChange={(v) => setAdjustmentData({ ...adjustmentData, type: v as StockMovementType })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>{adjustmentTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2"><Label>Perubahan Jumlah</Label><Input type="number" value={adjustmentData.qty_change} onChange={(e) => setAdjustmentData({ ...adjustmentData, qty_change: Number(e.target.value) })} placeholder="cth. 10 atau -5" /><p className="text-xs text-muted-foreground">Gunakan angka negatif untuk mengurangi stok.</p></div>
                        <div className="space-y-2"><Label>Alasan</Label><Textarea value={adjustmentData.reason} onChange={(e) => setAdjustmentData({ ...adjustmentData, reason: e.target.value })} placeholder="cth. 'Stok opname akhir bulan'" /></div>
                    </div>
                    <DialogFooter><Button variant="outline" onClick={() => setIsAdjustmentDialogOpen(false)}>Batal</Button><Button onClick={handleAdjustmentSave}>Simpan</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export const IngredientManager = React.memo(IngredientManagerComponent);
IngredientManager.displayName = "IngredientManager";
