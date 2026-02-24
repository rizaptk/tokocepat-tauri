
"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { ModifierGroup, ModifierItem } from "@/lib/types";
import { addModifierGroup, updateModifierGroup, deleteModifierGroup, addModifierItem, updateModifierItem, deleteModifierItem } from "@/services/modifierService";

import { Edit, PlusCircle, SlidersHorizontal, Trash } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
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

export default function ModifiersPage() {
    const { modifierGroups } = useStore();
    const { toast } = useToast();

    // Dialog states
    const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
    const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
    
    // Form states
    const [groupToEdit, setGroupToEdit] = useState<ModifierGroup | null>(null);
    const [groupFormData, setGroupFormData] = useState(defaultGroupState);

    const handleAddGroup = async () => {
        if (!groupFormData.name.trim()) return;
        try {
            await addModifierGroup(groupFormData);
            toast({ title: "Modifier group added" });
            setIsGroupDialogOpen(false);
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Could not add modifier group." });
        }
    };

    const handleUpdateGroup = async () => {
        if (!groupToEdit || !groupFormData.name.trim()) return;
        try {
            await updateModifierGroup(groupToEdit.id, groupFormData);
            toast({ title: "Modifier group updated" });
            setIsGroupDialogOpen(false);
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Could not update modifier group." });
        }
    }

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

    const handleDeleteGroup = async (id: string) => {
        try {
            // Note: Add check for product associations before deleting
            await deleteModifierGroup(id);
            toast({ title: "Modifier group deleted" });
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Could not delete modifier group." });
        }
    };

    // Placeholder functions for items
    const openItemDialog = (group: ModifierGroup, item: ModifierItem | null) => {
        // TODO: Implement item dialog logic
        toast({title: "Coming Soon!", description: "Managing modifier items will be implemented next."})
    }

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('id-ID', {
          style: 'currency',
          currency: 'IDR',
          minimumFractionDigits: 0,
        }).format(amount);
      };

    return (
        <>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Modifier Groups</CardTitle>
                    <Button onClick={() => openGroupDialog(null)} size="sm">
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Group
                    </Button>
                </CardHeader>
                <CardContent>
                    {modifierGroups.length === 0 ? (
                        <div className="text-center text-muted-foreground py-8">
                            <SlidersHorizontal className="mx-auto h-12 w-12" />
                            <h3 className="mt-4 text-lg font-semibold">No Modifier Groups</h3>
                            <p>Create groups like "Sugar Level" or "Toppings" to customize products.</p>
                        </div>
                    ) : (
                        <Accordion type="single" collapsible className="w-full">
                            {modifierGroups.map(group => (
                                <AccordionItem value={group.id} key={group.id}>
                                    <AccordionTrigger>
                                        <div className="flex items-center gap-4">
                                            <span className="font-medium text-lg">{group.name}</span>
                                            <Badge variant="secondary">{group.items.length} items</Badge>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="space-y-4">
                                        <div className="flex justify-between items-start p-4 bg-muted/50 rounded-lg">
                                            <div className="grid grid-cols-3 gap-x-8 gap-y-2 text-sm">
                                                <div><span className="font-semibold">Required:</span> {group.required ? 'Yes' : 'No'}</div>
                                                <div><span className="font-semibold">Min Select:</span> {group.min_select}</div>
                                                <div><span className="font-semibold">Max Select:</span> {group.max_select}</div>
                                            </div>
                                            <div className="flex gap-2">
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
                                                                This action cannot be undone. This will permanently delete the "{group.name}" modifier group.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDeleteGroup(group.id)}>Confirm Delete</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        </div>
                                        
                                        <div className="border rounded-lg">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Item Name</TableHead>
                                                        <TableHead>Additional Price</TableHead>
                                                        <TableHead className="text-right">
                                                             <Button variant="ghost" size="sm" onClick={() => openItemDialog(group, null)}>
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
                                                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => toast({title: "Coming Soon!", description: "Item deletion will be implemented soon."})}>
                                                                    <Trash className="h-4 w-4" />
                                                                </Button>
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
                        <Button onClick={groupToEdit ? handleUpdateGroup : handleAddGroup}>Save Group</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
