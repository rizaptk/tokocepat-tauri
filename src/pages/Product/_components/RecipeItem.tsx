'use client';

import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { RawIngredient } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash } from 'lucide-react';
import { ProductFormData } from './ProductForm';

interface RecipeItemProps {
    index: number;
    field: any;
    form: UseFormReturn<ProductFormData>;
    rawIngredients: RawIngredient[];
    removeRecipeItem: (index: number) => void;
}

const RecipeItemComponent: React.FC<RecipeItemProps> = ({ index, field, form, rawIngredients, removeRecipeItem }) => {
    return (
        <div key={field.id} className="flex gap-2 items-end p-3 border rounded-lg bg-muted/50">
            <div className="grow grid grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name={`recipe_items.${index}.ingredient_id`}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-xs">Bahan</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Pilih Bahan" /></SelectTrigger></FormControl>
                                <SelectContent>{rawIngredients.map(ing => (<SelectItem key={ing.id} value={ing.id}>{ing.name}</SelectItem>))}</SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name={`recipe_items.${index}.quantity`}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-xs">Kuantitas</FormLabel>
                            <FormControl>
                                <Input type="number" placeholder="e.g. 18" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
            <Button type="button" variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeRecipeItem(index)}>
                <Trash className="h-4 w-4" />
            </Button>
        </div>
    );
}

export const RecipeItem = React.memo(RecipeItemComponent);
