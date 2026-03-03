'use client';

import React, { useState } from 'react';
import { useStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import { addCategory, updateCategory, deleteCategory } from '@/services/categoryService';
import { Category } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { PlusCircle, Edit, Trash } from 'lucide-react';

const CategoryManagerComponent = () => {
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
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message || "Could not save category." });
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
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message || "Could not delete category." });
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
                                                    <AlertDialogTitle>Delete "{cat.name}"?</AlertDialogTitle>
                                                    <AlertDialogDescription>This will soft-delete the category. It cannot be used for new products.</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDelete(cat.id)}>Confirm Delete</AlertDialogAction>
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

export const CategoryManager = React.memo(CategoryManagerComponent);
CategoryManager.displayName = "CategoryManager";
