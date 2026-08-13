'use client';

import React, { useRef, useState, useMemo, useCallback } from 'react';
import { useStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import { addCategory, updateCategory, deleteCategory } from '@/services/categoryService';
import { Category } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlusCircle, Edit, Trash, Search, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea, ScrollAreaHandle } from '@/components/ui/scroll-area';
import { ScrollShadow } from '@/components/ui/scrollshadow';

const CategoryManagerComponent = () => {
    const { categories, products } = useStore();
    const { toast } = useToast();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [categoryToEdit, setCategoryToEdit] = useState<Category | null>(null);
    const [categoryName, setCategoryName] = useState("");
    const [search, setSearch] = useState("");
    const [activeIndex, setActiveIndex] = useState(-1);

    const scrollRef = useRef<ScrollAreaHandle>(null);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return categories;
        return categories.filter(c => c.name.toLowerCase().includes(q));
    }, [categories, search]);

    const productCount = useCallback((catId: string) => {
        return products.filter(p => p.category_id === catId).length;
    }, [products]);

    // Reset the active row when the filtered list shrinks or search changes.
    const activeRef = useRef(activeIndex);
    activeRef.current = activeIndex;
    useMemo(() => {
        if (activeRef.current >= filtered.length) setActiveIndex(-1);
    }, [filtered.length]);

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

    const scrollActiveIntoView = (index: number) => {
        const row = scrollRef.current?.viewport?.querySelector<HTMLElement>(`[data-cat-index="${index}"]`);
        row?.scrollIntoView({ block: 'nearest' });
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (filtered.length === 0) return;
        let next = activeRef.current;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            next = next >= filtered.length - 1 ? 0 : next + 1;
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            next = next <= 0 ? filtered.length - 1 : next - 1;
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const cat = filtered[activeRef.current];
            if (cat) openDialog(cat);
            return;
        } else {
            return;
        }
        setActiveIndex(next);
        scrollActiveIntoView(next);
    };

    return (
        <div className="h-full flex flex-col min-h-0">
            <div className="flex justify-between items-center px-4 py-3 border-b border-border/60">
                <h3 className="font-semibold">Kelola Kategori</h3>
                <Button size="sm" onClick={() => openDialog(null)}><PlusCircle className="mr-2 h-4 w-4" /> Tambah</Button>
            </div>
            <div className="px-4 py-2 border-b border-border/40">
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        className="h-7 pl-7 text-sm"
                        placeholder="Cari nama kategori..."
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setActiveIndex(-1); }}
                    />
                </div>
            </div>
            <div className="flex-1 min-h-0 relative overflow-hidden">
                <ScrollShadow scrollRef={scrollRef} side="both" />
                <div tabIndex={0} onKeyDown={handleKeyDown} className="h-full outline-none">
                    <ScrollArea ref={scrollRef} className="h-full">
                        {filtered.length > 0 ? (
                            <div className="px-4 pb-2 pt-1">
                                <table className="w-full caption-bottom text-sm">
                                    <thead className="sticky top-0 z-10 bg-background/95 backdrop-blur">
                                        <tr className="border-b transition-colors">
                                            <th className="h-9 px-3 text-left align-middle text-xs font-medium uppercase tracking-wider text-muted-foreground">Nama Kategori</th>
                                            <th className="h-9 px-3 text-right align-middle text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">Produk</th>
                                            <th className="h-9 px-3 w-28 text-right align-middle text-xs font-medium uppercase tracking-wider text-muted-foreground">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.map((cat, idx) => {
                                            const isActive = idx === activeIndex;
                                            return (
                                                <tr
                                                    key={cat.id}
                                                    data-cat-index={idx}
                                                    onMouseEnter={() => setActiveIndex(idx)}
                                                    onClick={() => openDialog(cat)}
                                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDialog(cat); } }}
                                                    tabIndex={0}
                                                    className={cn(
                                                        "group border-b transition-colors hover:bg-muted/50 cursor-pointer data-[state=selected]:bg-muted focus:outline-none focus-visible:bg-muted/70",
                                                        isActive && "bg-primary/10"
                                                    )}
                                                >
                                                    <td className="p-2.5 px-3 align-middle font-medium truncate max-w-[200px]">{cat.name}</td>
                                                    <td className="p-2.5 px-3 text-right text-muted-foreground tabular-nums whitespace-nowrap">
                                                        {productCount(cat.id)}
                                                    </td>
                                                    <td className="p-2.5 px-3">
                                                        <div className={cn(
                                                            "flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity",
                                                            isActive && "opacity-100"
                                                        )}>
                                                            <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-foreground" aria-label={`Ubah kategori ${cat.name}`} onClick={(e) => { e.stopPropagation(); openDialog(cat); }}>
                                                                <Edit className="h-4 w-4" />
                                                            </Button>
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive" aria-label={`Hapus kategori ${cat.name}`} onClick={(e) => e.stopPropagation()}>
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
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="flex h-full items-center justify-center text-center text-muted-foreground p-8">
                                <div>
                                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                                        <Inbox className="h-6 w-6" />
                                    </div>
                                    <p className="font-medium text-foreground/70">Kategori tidak ditemukan.</p>
                                </div>
                            </div>
                        )}
                    </ScrollArea>
                </div>
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