
"use client";

import { useState, useEffect, useMemo } from 'react';
import { Product, ModifierGroup, ModifierItem, SelectedModifier } from '@/lib/types';
import { useStore } from '@/lib/store';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from './ui/separator';

interface ModifierPanelProps {
    product: Product | null;
    onOpenChange: (isOpen: boolean) => void;
    onItemAdded?: () => void;
}

export function ModifierPanel({ product, onOpenChange, onItemAdded }: ModifierPanelProps) {
    const { modifierGroups: allModifierGroups, addToCart } = useStore();
    const [selectedModifiers, setSelectedModifiers] = useState<Record<string, ModifierItem[]>>({});
    const [isDesktop, setIsDesktop] = useState(false);

    const productModifierGroups = useMemo(() => {
        if (!product || !product.modifier_group_ids) return [];
        return allModifierGroups.filter(g => product.modifier_group_ids?.includes(g.id));
    }, [product, allModifierGroups]);

    useEffect(() => {
        // Reset state when product changes
        if (product) {
            setSelectedModifiers({});
        }
    }, [product]);

    useEffect(() => {
        const mediaQuery = window.matchMedia("(min-width: 768px)");
        setIsDesktop(mediaQuery.matches);
        const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
        mediaQuery.addEventListener('change', handler);
        return () => mediaQuery.removeEventListener('change', handler);
    }, []);

    const handleSingleSelect = (group: ModifierGroup, item: ModifierItem) => {
        setSelectedModifiers(prev => ({
            ...prev,
            [group.id]: [item]
        }));
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
        if (!product) return { isValid: false, errors: [] };
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
    }, [product, productModifierGroups, selectedModifiers]);

    const finalPrice = useMemo(() => {
        if (!product) return 0;
        const modifierPrice = Object.values(selectedModifiers)
            .flat()
            .reduce((sum, item) => sum + item.additional_price, 0);
        return product.price + modifierPrice;
    }, [product, selectedModifiers]);

    const handleAddToCart = () => {
        if (!product || !validation.isValid) return;

        const flattenedModifiers: SelectedModifier[] = Object.entries(selectedModifiers)
            .flatMap(([groupId, items]) => {
                const groupName = productModifierGroups.find(g => g.id === groupId)?.name || '';
                return items.map(item => ({
                    groupId,
                    groupName,
                    item,
                }));
            });
        
        addToCart(product, flattenedModifiers);
        onOpenChange(false);
        if (onItemAdded) {
            onItemAdded();
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('id-ID', {
          style: 'currency',
          currency: 'IDR',
          minimumFractionDigits: 0,
        }).format(amount);
      };

    return (
        <Sheet open={!!product} onOpenChange={onOpenChange}>
            <SheetContent side={isDesktop ? 'right' : 'bottom'} className={isDesktop ? "w-[400px] sm:w-[540px] flex flex-col" : "h-[90vh] flex flex-col"}>
                {product && (
                    <>
                        <SheetHeader>
                            <SheetTitle>{product.name}</SheetTitle>
                            <SheetDescription>Customize your item. Base price: {formatCurrency(product.price)}</SheetDescription>
                        </SheetHeader>
                        <ScrollArea className="flex-1 -mx-6 px-6">
                            <div className="space-y-6 py-4">
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
                                            <RadioGroup onValueChange={(value) => handleSingleSelect(group, group.items.find(i => i.id === value)!)}>
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
                                <Button onClick={handleAddToCart} disabled={!validation.isValid} className="w-full" size="lg">Add to Cart</Button>
                           </div>
                        </SheetFooter>
                    </>
                )}
            </SheetContent>
        </Sheet>
    );
}
