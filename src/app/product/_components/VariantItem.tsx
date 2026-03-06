
'use client';

import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { FormField, FormItem, FormLabel, FormControl } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Trash, Minus, Plus } from 'lucide-react';
import { ProductFormData } from './ProductForm';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

interface VariantItemProps {
    index: number;
    field: any; // from useFieldArray
    form: UseFormReturn<ProductFormData>;
    removeVariant: (index: number) => void;
}

const VariantItemComponent: React.FC<VariantItemProps> = ({ index, field, form, removeVariant }) => {
    
    return (
      <Accordion type="single" collapsible defaultValue='item-0'>
        <AccordionItem value={`item-${index}`} className='bg-muted/30 rounded-lg border px-4'>
          <AccordionTrigger>
              <div className="flex flex-col items-start">
                  <span className="font-medium">Variant: {form.watch(`variants.${index}.name`) || `(new variant)`}</span>
                  <span className="text-xs text-muted-foreground">Price: +{form.watch(`variants.${index}.additional_price`) || 0}, Stock: {form.watch(`variants.${index}.stock`) || 0}</span>
              </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="flex flex-col gap-4 pt-2">
                <div className="grid grid-cols-2 gap-4">
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
                </div>
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
                <Separator />
                 <FormField
                    control={form.control}
                    name={`variants.${index}.track_stock`}
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between">
                            <FormLabel className="text-sm">Track Stock</FormLabel>
                            <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                        </FormItem>
                    )}
                />
                <div className={cn("grid grid-cols-2 gap-4", !form.watch(`variants.${index}.track_stock`) && "opacity-50")}>
                    <FormField
                        control={form.control}
                        name={`variants.${index}.stock`}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-xs">Stock</FormLabel>
                                <FormControl><Input type="number" placeholder="50" {...field} disabled={!form.watch(`variants.${index}.track_stock`)} /></FormControl>
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name={`variants.${index}.low_stock_alert`}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-xs">Low Stock Alert</FormLabel>
                                <FormControl><Input type="number" placeholder="10" {...field} disabled={!form.watch(`variants.${index}.track_stock`)}/></FormControl>
                            </FormItem>
                        )}
                    />
                </div>
                <Button type="button" variant="ghost" size="sm" className="w-full text-destructive hover:text-destructive" onClick={() => removeVariant(index)}>
                    <Trash className="h-4 w-4 mr-2"/> Remove Variant
                </Button>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    );
};

export const VariantItem = React.memo(VariantItemComponent);
