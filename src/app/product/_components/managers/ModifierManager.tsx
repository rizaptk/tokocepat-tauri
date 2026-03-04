'use client';

import React, { useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import { ModifierGroup, ModifierItem } from '@/lib/types';
import { addModifierGroup, updateModifierGroup, deleteModifierGroup, addModifierItem, updateModifierItem, deleteModifierItem } from '@/services/modifierService';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea, ScrollAreaHandle } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { PlusCircle, Edit, Trash, DiamondPlus } from 'lucide-react';
import { ScrollShadow } from '@/components/ui/scrollshadow';

const ModifierManagerComponent = () => {
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

    const scrollRef = useRef<ScrollAreaHandle>(null);

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
        <div className="p-0 h-full flex flex-col min-h-0">
            <div className="flex justify-between items-center my-4 px-4">
                <h3 className="font-semibold">Manage Modifiers</h3>
                <Button size="sm" onClick={() => openGroupDialog(null)}><PlusCircle className="mr-2 h-4 w-4" /> Add Group</Button>
            </div>
            <div className='flex-1 min-h-0 flex flex-col overflow-hidden relative px-4'>
                <ScrollShadow scrollRef={scrollRef} side="top" />
                <ScrollArea ref={scrollRef} className="flex-1 min-h-0 -mx-4">
                    <div className="px-4 space-y-4">
                        {modifierGroups.map(group => (
                            <Card key={group.id} className="overflow-hidden">
                                <div className="p-4 border-b">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1">
                                            <p className="font-semibold text-base leading-tight">{group.name}</p>
                                            <p className="text-sm text-muted-foreground mt-1">{group.required ? "Required" : "Optional"} • Select {group.min_select}–{group.max_select}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="divide-y divide-border/40">
                                    {group.items.map(item => (
                                        <div key={item.id} className="p-4 flex items-center justify-between gap-3 hover:bg-background">
                                            <div className="flex-1">
                                                <p className="font-medium flex gap-2"><DiamondPlus className="size-4 mt-1 shrink-0 text-green-600" />{item.name}</p>
                                                <p className="text-sm text-muted-foreground pl-6">{formatCurrency(item.additional_price)}</p>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                <Button variant="ghost" size="icon" onClick={() => openItemDialog(group.id, item)}><Edit className="h-4 w-4" /></Button>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"><Trash className="h-4 w-4" /></Button></AlertDialogTrigger>
                                                    <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete "{item.name}"?</AlertDialogTitle></AlertDialogHeader>
                                                        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleItemDelete(group.id, item.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        </div>
                                    ))}
                                    <div className="p-4 flex justify-between items-center gap-4">
                                        <Button variant="outline" className="grow" onClick={() => openItemDialog(group.id, null)}><PlusCircle className="mr-2 h-4 w-4" />Add Item</Button>
                                        <div className="flex justify-end gap-2">
                                            <Button variant="outline" onClick={() => openGroupDialog(group)}><Edit className="h-4 w-4 mr-1" />Edit</Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild><Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => handleGroupDelete(group.id)}><Trash className="h-4 w-4 mr-1" />Delete</Button></AlertDialogTrigger>
                                                <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete "{group.name}"?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the group and all its items.</AlertDialogDescription></AlertDialogHeader>
                                                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleGroupDelete(group.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                </ScrollArea>
            </div>
            <Dialog open={isGroupDialogOpen} onOpenChange={setIsGroupDialogOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>{groupToEdit ? 'Edit' : 'Add'} Group</DialogTitle></DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2"><Label htmlFor="g-name">Group Name</Label><Input id="g-name" value={groupFormData.name} onChange={(e) => setGroupFormData({ ...groupFormData, name: e.target.value })} /></div>
                        <div className="flex items-center space-x-2"><Switch id="g-req" checked={groupFormData.required} onCheckedChange={(c) => setGroupFormData({ ...groupFormData, required: c, min_select: c ? Math.max(1, groupFormData.min_select) : groupFormData.min_select })} /><Label htmlFor="g-req">Required</Label></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><Label htmlFor="g-min">Min Select</Label><Input id="g-min" type="number" value={groupFormData.min_select} onChange={(e) => setGroupFormData({ ...groupFormData, min_select: Number(e.target.value) })} min={groupFormData.required ? 1 : 0} /></div>
                            <div className="space-y-2"><Label htmlFor="g-max">Max Select</Label><Input id="g-max" type="number" value={groupFormData.max_select} onChange={(e) => setGroupFormData({ ...groupFormData, max_select: Number(e.target.value) })} min={groupFormData.min_select} /></div>
                        </div>
                    </div>
                    <DialogFooter><Button variant="outline" onClick={() => setIsGroupDialogOpen(false)}>Cancel</Button><Button onClick={handleGroupSave}>Save</Button></DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog open={isItemDialogOpen} onOpenChange={setIsItemDialogOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>{itemToEdit ? 'Edit' : 'Add'} Item</DialogTitle></DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2"><Label htmlFor="i-name">Item Name</Label><Input id="i-name" value={itemFormData.name} onChange={(e) => setItemFormData({ ...itemFormData, name: e.target.value })} /></div>
                        <div className="space-y-2"><Label htmlFor="i-price">Additional Price</Label><div className="relative"><span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">Rp</span><Input id="i-price" type="number" value={itemFormData.additional_price || ''} onChange={(e) => setItemFormData({ ...itemFormData, additional_price: Number(e.target.value) })} className="pl-10" /></div></div>
                    </div>
                    <DialogFooter><Button variant="outline" onClick={() => setIsItemDialogOpen(false)}>Cancel</Button><Button onClick={handleItemSave}>Save</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export const ModifierManager = React.memo(ModifierManagerComponent);
ModifierManager.displayName = "ModifierManager";
