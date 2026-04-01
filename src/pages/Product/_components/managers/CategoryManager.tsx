'use client';

import React, { useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import { addCategory, updateCategory, deleteCategory } from '@/services/categoryService';
import { Category } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea, ScrollAreaHandle } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { PlusCircle, Edit, Trash } from 'lucide-react';
import { ScrollShadow } from '@/components/ui/scrollshadow';

const CategoryManagerComponent = () => {
    const { categories } = useStore();
    const { toast } = useToast();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [categoryToEdit, setCategoryToEdit] = useState<Category | null>(null);
    const [categoryName, setCategoryName] = useState("");

    const scrollRef = useRef<ScrollAreaHandle>(null);

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
                toast({ title: "Kategori diperbarui" });
            } else {
                await addCategory(categoryName);
                toast({ title: "Kategori ditambahkan" });
            }
            setIsDialogOpen(false);
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message || "Could not save category." });
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const result = await deleteCategory(id);
            if (!result.success) {
                toast({ variant: "destructive", title: "Gagal Menghapus", description: result.message });
            } else {
                toast({ title: "Kategori dihapus" });
            }
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message || "Gagal menghapus kategori." });
        }
    };

    return (
        <div className="h-full flex flex-col min-h-0">
            <div className="flex justify-between items-center my-4 px-4">
                <h3 className="font-semibold">Kelola Kategori</h3>
                <Button size="sm" onClick={() => openDialog(null)}><PlusCircle className="mr-2 h-4 w-4" /> Tambah</Button>
            </div>
            <div className='flex-1 min-h-0 flex flex-col overflow-hidden relative px-4'>
                <ScrollShadow scrollRef={scrollRef} side="top" />
                <ScrollArea className="flex-1 min-h-0 -mx-4 px-4" ref={scrollRef}>
                    <Card className="rounded-lg">
                        <CardContent className="p-0">
                            <div className="divide-y">
                                {categories.map((cat) => (
                                    <div key={cat.id} className="flex items-center justify-between px-4 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-medium text-base">{cat.name}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button variant="ghost" size="icon" onClick={() => openDialog(cat)}>
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="text-destructive">
                                                        <Trash className="h-4 w-4" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Hapus "{cat.name}"?</AlertDialogTitle>
                                                        <AlertDialogDescription>Kategori akan dinonaktifkan dan tidak bisa digunakan untuk produk baru.</AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Batal</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDelete(cat.id)}>Hapus</AlertDialogAction>
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
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>{categoryToEdit ? 'Ubah' : 'Tambah'} Kategori</DialogTitle></DialogHeader>
                    <div className="py-4"><Label htmlFor="cat-name">Nama Kategori</Label><Input id="cat-name" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} autoFocus /></div>
                    <DialogFooter><Button variant="outline" onClick={() => setIsDialogOpen(false)}>Batal</Button><Button onClick={handleSave}>Simpan</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export const CategoryManager = React.memo(CategoryManagerComponent);
CategoryManager.displayName = "CategoryManager";
