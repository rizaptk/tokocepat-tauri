
"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { ModifierGroup, ModifierItem } from "@/lib/types";
import { addModifierGroup, updateModifierGroup, deleteModifierGroup, addModifierItem, updateModifierItem, deleteModifierItem } from "@/services/modifierService";

import { Edit, PlusCircle, SlidersHorizontal, Trash } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

// Form state for adding/editing a modifier group
const defaultGroupState = {
    name: "",
    min_select: 1,
    max_select: 1,
    required: true,
};

// Form state for adding/editing a modifier item
const defaultItemState = {
    name: "",
    additional_price: 0,
};

export default function ModifiersPage() {
    const { modifierGroups } = useStore();
    const { toast } = useToast();

    // Dialog states
    const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
    const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
    
    // Form states
    const [groupToEdit, setGroupToEdit] = useState<ModifierGroup | null>(null);
    const [groupFormData, setGroupFormData] = useState(defaultGroupState);

    const [itemToEdit, setItemToEdit] = useState<ModifierItem | null>(null);
    const [activeGroupId, setActiveGroupId] = useState<string | null>(null); // To know which group to add item to
    const [itemFormData, setItemFormData] = useState(defaultItemState);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('id-ID', {
          style: 'currency',
          currency: 'IDR',
          minimumFractionDigits: 0,
        }).format(amount);
    };

    // --- GROUP MANAGEMENT ---
    const openGroupDialog = (group: ModifierGroup | null) => {
        if (group) {
            setGroupToEdit(group);
            setGroupFormData({
                name: group.name,
                min_select: group.min_select,
                max_select: group.max_select,
                required: group.required,
            });
        } else {
            setGroupToEdit(null);
            setGroupFormData(defaultGroupState);
        }
        setIsGroupDialogOpen(true);
    };

    const handleGroupSubmit = async () => {
        if (!groupFormData.name.trim()) return;
        try {
            if (groupToEdit) {
                await updateModifierGroup(groupToEdit.id, groupFormData);
                toast({ title: "Modifier group updated" });
            } else {
                await addModifierGroup(groupFormData);
                toast({ title: "Modifier group added" });
            }
            setIsGroupDialogOpen(false);
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: `Could not save modifier group.` });
        }
    };

    const handleDeleteGroup = async (id: string) => {
        try {
            await deleteModifierGroup(id);
            toast({ title: "Modifier group deleted" });
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Could not delete modifier group. It might be in use by a product." });
        }
    };
    
    // --- ITEM MANAGEMENT ---
    const openItemDialog = (group: ModifierGroup, item: ModifierItem | null) => {
        setActiveGroupId(group.id);
        if (item) {
            setItemToEdit(item);
            setItemFormData({
                name: item.name,
                additional_price: item.additional_price,
            });
        } else {
            setItemToEdit(null);
            setItemFormData(defaultItemState);
        }
        setIsItemDialogOpen(true);
    };

    const handleItemSubmit = async () => {
        if (!activeGroupId || !itemFormData.name.trim()) return;
        try {
             if (itemToEdit) {
                await updateModifierItem(activeGroupId, itemToEdit.id, itemFormData.name, itemFormData.additional_price);
                toast({ title: "Modifier item updated" });
            } else {
                await addModifierItem(activeGroupId, itemFormData.name, itemFormData.additional_price);
                toast({ title: "Modifier item added" });
            }
            setIsItemDialogOpen(false);
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Could not save modifier item." });
        }
    };
    
    const handleDeleteItem = async (groupId: string, itemId: string) => {
        try {
            await deleteModifierItem(groupId, itemId);
            toast({ title: "Modifier item deleted" });
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Could not delete modifier item." });
        }
    };


    return (
        <>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Modifier Groups</CardTitle>
                        <CardDescription>Create groups like "Sugar Level" or "Toppings" to customize products.</CardDescription>
                    </div>
                    <Button onClick={() => openGroupDialog(null)} size="sm">
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Group
                    </Button>
                </CardHeader>
                <CardContent>
                    {modifierGroups.length === 0 ? (
                        <div className="text-center text-muted-foreground py-12">
                            <SlidersHorizontal className="mx-auto h-12 w-12" />
                            <h3 className="mt-4 text-lg font-semibold">No Modifier Groups Yet</h3>
                            <p>Get started by creating your first modifier group.</p>
                        </div>
                    ) : (
                        <Accordion type="single" collapsible className="w-full">
                            {modifierGroups.map(group => (
                                <AccordionItem value={group.id} key={group.id}>
                                    <AccordionTrigger>
                                        <div className="flex flex-1 items-center justify-between pr-4">
                                            <div className="flex items-center gap-4">
                                                <span className="font-medium text-lg">{group.name}</span>
                                                <Badge variant="secondary">{group.items.length} items</Badge>
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                                {group.required ? "Required" : "Optional"} ({group.min_select}-{group.max_select})
                                            </div>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="space-y-4">
                                        <div className="flex justify-end items-center p-2 bg-muted/50 rounded-lg gap-2">
                                            <Button variant="outline" size="sm" onClick={() => openGroupDialog(group)}>
                                                <Edit className="mr-2 h-3 w-3"/> Edit Group
                                            </Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="destructive" size="sm">
                                                        <Trash className="mr-2 h-3 w-3"/> Delete Group
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            This action cannot be undone. This will permanently delete the "{group.name}" modifier group and all its items.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDeleteGroup(group.id)}>Confirm Delete</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                        
                                        <div className="border rounded-lg">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Item Name</TableHead>
                                                        <TableHead>Additional Price</TableHead>
                                                        <TableHead className="text-right">
                                                             <Button variant="outline" size="sm" onClick={() => openItemDialog(group, null)}>
                                                                <PlusCircle className="mr-2 h-4 w-4"/> Add Item
                                                            </Button>
                                                        </TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {group.items.map(item => (
                                                        <TableRow key={item.id}>
                                                            <TableCell className="font-medium">{item.name}</TableCell>
                                                            <TableCell>{formatCurrency(item.additional_price)}</TableCell>
                                                            <TableCell className="text-right">
                                                                <Button variant="ghost" size="icon" onClick={() => openItemDialog(group, item)}>
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
                                                                            <AlertDialogTitle>Delete "{item.name}"?</AlertDialogTitle>
                                                                            <AlertDialogDescription>
                                                                                This action cannot be undone.
                                                                            </AlertDialogDescription>
                                                                        </AlertDialogHeader>
                                                                        <AlertDialogFooter>
                                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                            <AlertDialogAction onClick={() => handleDeleteItem(group.id, item.id)}>Delete</AlertDialogAction>
                                                                        </AlertDialogFooter>
                                                                    </AlertDialogContent>
                                                                </AlertDialog>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    )}
                </CardContent>
            </Card>

            {/* Group Add/Edit Dialog */}
            <Dialog open={isGroupDialogOpen} onOpenChange={setIsGroupDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{groupToEdit ? 'Edit' : 'Add'} Modifier Group</DialogTitle>
                        <DialogDescription>
                            Define the rules for this group of options.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="group-name">Group Name</Label>
                            <Input 
                                id="group-name" 
                                value={groupFormData.name} 
                                onChange={(e) => setGroupFormData({...groupFormData, name: e.target.value})}
                                autoFocus
                            />
                        </div>
                        <div className="flex items-center space-x-2">
                            <Switch id="required" checked={groupFormData.required} onCheckedChange={(checked) => setGroupFormData({...groupFormData, required: checked, min_select: checked ? Math.max(1, groupFormData.min_select) : groupFormData.min_select })} />
                            <Label htmlFor="required">Required Group</Label>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="min-select">Min Selection</Label>
                                <Input id="min-select" type="number" value={groupFormData.min_select} onChange={(e) => setGroupFormData({...groupFormData, min_select: Number(e.target.value)})} min={groupFormData.required ? 1 : 0} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="max-select">Max Selection</Label>
                                <Input id="max-select" type="number" value={groupFormData.max_select} onChange={(e) => setGroupFormData({...groupFormData, max_select: Number(e.target.value)})} min={groupFormData.min_select} />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsGroupDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleGroupSubmit}>Save Group</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

             {/* Item Add/Edit Dialog */}
            <Dialog open={isItemDialogOpen} onOpenChange={setIsItemDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{itemToEdit ? 'Edit' : 'Add'} Modifier Item</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="item-name">Item Name</Label>
                            <Input 
                                id="item-name" 
                                value={itemFormData.name} 
                                onChange={(e) => setItemFormData({...itemFormData, name: e.target.value})}
                                autoFocus
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="item-price">Additional Price</Label>
                             <div className="relative">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">Rp</span>
                                <Input 
                                    id="item-price" 
                                    type="number"
                                    value={itemFormData.additional_price || ''}
                                    onChange={(e) => setItemFormData({...itemFormData, additional_price: Number(e.target.value)})}
                                    className="pl-10"
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsItemDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleItemSubmit}>Save Item</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
