
"use client";

import { useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { addCategory, updateCategory, deleteCategory } from "@/services/categoryService";
import { useToast } from "@/hooks/use-toast";
import { Category } from "@/lib/types";

import { ArrowLeft, Edit, PlusCircle, Trash } from "lucide-react";
import { TokoCepatLogo } from "@/components/TokoCepatLogo";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DashboardPageHeader } from "@/components/DashboardPageHeader";

export default function CategoriesPage() {
    const { categories } = useStore();
    const { toast } = useToast();
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [categoryToEdit, setCategoryToEdit] = useState<Category | null>(null);
    const [newCategoryName, setNewCategoryName] = useState("");
    const [editedCategoryName, setEditedCategoryName] = useState("");

    const handleAddCategory = async () => {
        if (!newCategoryName.trim()) return;
        try {
            await addCategory(newCategoryName);
            toast({ title: "Category added", description: `"${newCategoryName}" has been created.` });
            setNewCategoryName("");
            setIsAddDialogOpen(false);
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Could not add category." });
        }
    };

    const openEditDialog = (category: Category) => {
        setCategoryToEdit(category);
        setEditedCategoryName(category.name);
        setIsEditDialogOpen(true);
    }

    const handleUpdateCategory = async () => {
        if (!categoryToEdit || !editedCategoryName.trim()) return;
        try {
            await updateCategory(categoryToEdit.id, editedCategoryName);
            toast({ title: "Category updated", description: `Category has been renamed to "${editedCategoryName}".` });
            setCategoryToEdit(null);
            setEditedCategoryName("");
            setIsEditDialogOpen(false);
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Could not update category." });
        }
    }

    const handleDeleteCategory = async (id: string) => {
        try {
            const result = await deleteCategory(id);
            if (result.success) {
                toast({ title: "Category deleted", description: "The category has been soft-deleted." });
            } else {
                toast({ variant: "destructive", title: "Deletion Failed", description: result.message });
            }
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Could not delete category." });
        }
    }

    return (
        <>
            <div className="flex min-h-screen w-full flex-col bg-muted/40">
                <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
                    <Button variant="outline" size="icon" asChild>
                        <Link href="/dashboard/products">
                            <ArrowLeft />
                        </Link>
                    </Button>
                    <TokoCepatLogo />
                </header>
                <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
                    <DashboardPageHeader
                        title="Category Management"
                        description="Add, edit, and manage your product categories."
                    >
                         <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                            <DialogTrigger asChild>
                                <Button>
                                    <PlusCircle className="mr-2 h-4 w-4" /> Add Category
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Add New Category</DialogTitle>
                                    <DialogDescription>
                                        Enter the name for the new category.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="py-4">
                                    <Label htmlFor="category-name">Category Name</Label>
                                    <Input 
                                        id="category-name" 
                                        value={newCategoryName} 
                                        onChange={(e) => setNewCategoryName(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                                    <Button onClick={handleAddCategory}>Save Category</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </DashboardPageHeader>

                    <Card>
                        <CardContent className="p-6">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Category Name</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {categories.map(category => (
                                        <TableRow key={category.id}>
                                            <TableCell className="font-medium">{category.name}</TableCell>
                                            <TableCell>
                                                <Badge variant={category.is_active ? "default" : "outline"}>
                                                    {category.is_active ? "Active" : "Inactive"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" onClick={() => openEditDialog(category)}>
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                         <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                                            <Trash className="h-4 w-4" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                This will soft-delete the category (set to inactive). It cannot be used for new products but will remain on existing ones. You cannot delete a category that is in use.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDeleteCategory(category.id)}>Confirm Delete</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                        <CardFooter>
                            <div className="text-xs text-muted-foreground">
                                Showing <strong>{categories.length}</strong> categories
                            </div>
                        </CardFooter>
                    </Card>
                </main>
            </div>
            {/* Edit Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Category</DialogTitle>
                        <DialogDescription>
                            Rename the category.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Label htmlFor="edit-category-name">Category Name</Label>
                        <Input
                            id="edit-category-name"
                            value={editedCategoryName}
                            onChange={(e) => setEditedCategoryName(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleUpdateCategory}>Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
