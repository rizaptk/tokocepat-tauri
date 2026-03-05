'use client';

import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { FormField, FormItem, FormLabel, FormControl } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Trash } from 'lucide-react';
import { ProductFormData } from './ProductForm';

interface VariantItemProps {
    index: number;
    field: any; // from useFieldArray
    form: UseFormReturn<ProductFormData>;
    removeVariant: (index: number) => void;
}

const VariantItemComponent: React.FC<VariantItemProps> = ({ index, field, form, removeVariant }) => {
    
    return (
        <div key={field.id} className="flex flex-col gap-2 items-end p-3 border rounded-lg bg-muted/50">
            <div className="flex items-center justify-between w-full border-b px-2">
                <FormLabel className="text-sm">Variant {index + 1}</FormLabel>
                <Button type="button" variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeVariant(index)}>
                    <Trash className="h-4 w-4" />
                </Button>
            </div>
            <div className="flex-grow grid grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name={`variants.${index}.name`}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-xs">Name</FormLabel>
                            <FormControl>
                                <Input placeholder="e.g. Small" {...field} />
                            </FormControl>
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name={`variants.${index}.additional_price`}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-xs">Price Adj.</FormLabel>
                            <FormControl>
                                <div className="relative"><span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground text-xs">Rp</span><Input type="number" placeholder="0" className="pl-8" {...field} /></div>
                            </FormControl>
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name={`variants.${index}.sku`}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-xs">SKU</FormLabel>
                            <FormControl>
                                <Input placeholder="SKU-S" {...field} />
                            </FormControl>
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name={`variants.${index}.stock`}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-xs">Stock</FormLabel>
                            <FormControl>
                                <Input type="number" placeholder="50" {...field} />
                            </FormControl>
                        </FormItem>
                    )}
                />
            </div>
        </div>
    );
};

export const VariantItem = React.memo(VariantItemComponent);
