
"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { Product, ModifierGroup, ModifierItem, SelectedModifier, CartItem } from '@/lib/types';
import { useStore } from '@/lib/store';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from './ui/separator';
import { useGlobalKeydown } from '@/hooks/use-global-keydown';

interface ModifierPanelProps {
    item: Product | CartItem | null;
    onOpenChange: (isOpen: boolean) => void;
    onConfirm: (selectedModifiers: SelectedModifier[]) => void;
}

export function ModifierPanel({ item, onOpenChange, onConfirm }: ModifierPanelProps) {
    const { modifierGroups: allModifierGroups } = useStore();
    const [selectedModifiers, setSelectedModifiers] = useState<Record<string, ModifierItem[]>>({});
    const [isDesktop, setIsDesktop] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);

    const isEditing = item && 'cartItemId' in item;
    const productData = item as Product; // Treat both Product and CartItem as Product for data access

    const productModifierGroups = useMemo(() => {
        if (!productData || !productData.modifier_group_ids) return [];
        return allModifierGroups.filter(g => productData.modifier_group_ids?.includes(g.id));
    }, [productData, allModifierGroups]);

    useEffect(() => {
        if (item) {
            if (isEditing) {
                // Pre-populate from cart item
                const initialSelections: Record<string, ModifierItem[]> = {};
                (item as CartItem).selectedModifiers.forEach(mod => {
                    if (!initialSelections[mod.groupId]) {
                        initialSelections[mod.groupId] = [];
                    }
                    initialSelections[mod.groupId].push(mod.item);
                });
                setSelectedModifiers(initialSelections);
            } else {
                // Reset for new product
                setSelectedModifiers({});
            }
        }
    }, [item, isEditing]);

    useEffect(() => {
        const mediaQuery = window.matchMedia("(min-width: 768px)");
        setIsDesktop(mediaQuery.matches);
        const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
        mediaQuery.addEventListener('change', handler);
        return () => mediaQuery.removeEventListener('change', handler);
    }, []);

    const handleSingleSelect = (group: ModifierGroup, itemValue: string) => {
        const selectedItem = group.items.find(i => i.id === itemValue);
        if (selectedItem) {
            setSelectedModifiers(prev => ({
                ...prev,
                [group.id]: [selectedItem]
            }));
        }
    };

    const handleMultiSelect = (group: ModifierGroup, item: ModifierItem, checked: boolean) => {
        setSelectedModifiers(prev => {
            const currentSelection = prev[group.id] || [];
            let newSelection;
            if (checked) {
                newSelection = [...currentSelection, item];
            } else {
                newSelection = currentSelection.filter(i => i.id !== item.id);
            }
            // Enforce max_select
            if (newSelection.length > group.max_select) {
                newSelection.pop(); // Or show a toast message
            }
            return {
                ...prev,
                [group.id]: newSelection
            };
        });
    };

    const validation = useMemo(() => {
        if (!productData) return { isValid: false, errors: [] };
        let isValid = true;
        const errors: string[] = [];

        for (const group of productModifierGroups) {
            const selection = selectedModifiers[group.id] || [];
            if (group.required && selection.length < group.min_select) {
                isValid = false;
                errors.push(`Please select at least ${group.min_select} option(s) for ${group.name}.`);
            }
        }
        return { isValid, errors };
    }, [productData, productModifierGroups, selectedModifiers]);

    const finalPrice = useMemo(() => {
        if (!productData) return 0;
        const modifierPrice = Object.values(selectedModifiers)
            .flat()
            .reduce((sum, item) => sum + item.additional_price, 0);
        return productData.price + modifierPrice;
    }, [productData, selectedModifiers]);

    const handleConfirm = () => {
        if (!productData || !validation.isValid) return;

        const flattenedModifiers: SelectedModifier[] = Object.entries(selectedModifiers)
            .flatMap(([groupId, items]) => {
                const groupName = productModifierGroups.find(g => g.id === groupId)?.name || '';
                return items.map(item => ({
                    groupId,
                    groupName,
                    item,
                }));
            });
        
        onConfirm(flattenedModifiers);
    };

    useGlobalKeydown({
        key: 'Enter',
        handler: handleConfirm,
        enabled: !!item && validation.isValid,
        bindTo: contentRef,
    });

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('id-ID', {
          style: 'currency',
          currency: 'IDR',
          minimumFractionDigits: 0,
        }).format(amount);
      };

    return (
        <Sheet open={!!item} onOpenChange={onOpenChange}>
            <SheetContent ref={contentRef} side={isDesktop ? 'right' : 'bottom'} className={isDesktop ? "w-[400px] sm:w-[540px] flex flex-col" : "h-[90vh] flex flex-col"}>
                {productData && (
                    <>
                        <SheetHeader>
                            <SheetTitle>{isEditing ? `Edit ${productData.name}` : productData.name}</SheetTitle>
                            <SheetDescription>Customize your item. Base price: {formatCurrency(productData.price)}</SheetDescription>
                        </SheetHeader>
                        <ScrollArea className="flex-1 -mx-6 px-4">
                            <div className="space-y-6 py-4 px-2">
                                {productModifierGroups.map(group => (
                                    <div key={group.id} className="space-y-4">
                                        <div>
                                            <h4 className="font-semibold">{group.name}</h4>
                                            <p className="text-sm text-muted-foreground">
                                                {group.required ? 'Required' : 'Optional'}.
                                                {group.max_select > 1 ? ` Select up to ${group.max_select}.` : ' Select one.'}
                                            </p>
                                        </div>
                                        {group.max_select === 1 ? (
                                            <RadioGroup onValueChange={(value) => handleSingleSelect(group, value)} value={selectedModifiers[group.id]?.[0]?.id}>
                                                {group.items.map(item => (
                                                    <div key={item.id} className="flex items-center space-x-2">
                                                        <RadioGroupItem value={item.id} id={`${group.id}-${item.id}`} />
                                                        <Label htmlFor={`${group.id}-${item.id}`} className="flex-1 cursor-pointer">
                                                            {item.name}
                                                        </Label>
                                                        {item.additional_price > 0 && <span className="text-sm text-muted-foreground">+{formatCurrency(item.additional_price)}</span>}
                                                    </div>
                                                ))}
                                            </RadioGroup>
                                        ) : (
                                            <div className="space-y-2">
                                                {group.items.map(item => (
                                                    <div key={item.id} className="flex items-center space-x-2">
                                                        <Checkbox 
                                                            className='rounded-none'
                                                            id={`${group.id}-${item.id}`}
                                                            onCheckedChange={(checked) => handleMultiSelect(group, item, !!checked)}
                                                            checked={(selectedModifiers[group.id] || []).some(i => i.id === item.id)}
                                                            disabled={(selectedModifiers[group.id]?.length || 0) >= group.max_select && !(selectedModifiers[group.id] || []).some(i => i.id === item.id)}
                                                        />
                                                        <Label htmlFor={`${group.id}-${item.id}`} className="flex-1 cursor-pointer">
                                                            {item.name}
                                                        </Label>
                                                        {item.additional_price > 0 && <span className="text-sm text-muted-foreground">+{formatCurrency(item.additional_price)}</span>}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        <Separator />
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                        <SheetFooter className="mt-auto">
                           <div className="w-full space-y-4">
                               {validation.errors.length > 0 && (
                                   <div className="text-destructive text-sm">
                                       {validation.errors.map((e, i) => <p key={i}>{e}</p>)}
                                   </div>
                               )}
                                <div className="flex justify-between items-center text-lg font-bold">
                                    <span>Total Price</span>
                                    <span>{formatCurrency(finalPrice)}</span>
                                </div>
                                <Button onClick={handleConfirm} disabled={!validation.isValid} className="w-full" size="lg">
                                    {isEditing ? 'Update Item' : 'Add to Cart'}
                                </Button>
                           </div>
                        </SheetFooter>
                    </>
                )}
            </SheetContent>
        </Sheet>
    );
}
