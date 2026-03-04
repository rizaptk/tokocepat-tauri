
'use client';

import { useStore } from '@/lib/store';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useEffect, useTransition } from 'react';
import { useToast } from '@/hooks/use-toast';
import { updateStoreConfigAction } from '../_actions';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save, PlusCircle, Trash2, Percent } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

const categoryOverrideSchema = z.object({
  category_id: z.string().min(1, 'Please select a category.'),
  tax_rate: z.coerce.number().min(0).max(1),
});

const taxSettingsSchema = z.object({
  default_rate: z.coerce.number().min(0).max(1, 'Rate must be between 0 and 1.'),
  product_type_overrides: z.object({
    food_and_beverage: z.preprocess(
      (val) => (val === "" || val === null ? undefined : val),
      z.coerce.number().min(0).max(1).optional()
    ),
  }),
  category_overrides: z.array(categoryOverrideSchema),
});

type TaxSettingsFormValues = z.infer<typeof taxSettingsSchema>;

export function TaxSettingsForm() {
    const { storeConfig, categories } = useStore();
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const form = useForm<TaxSettingsFormValues>({
        resolver: zodResolver(taxSettingsSchema),
        defaultValues: {
            default_rate: 0.11,
            product_type_overrides: { food_and_beverage: undefined },
            category_overrides: [],
        }
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "category_overrides",
    });

    useEffect(() => {
        if (storeConfig) {
            form.reset({
                default_rate: storeConfig.tax_settings?.default_rate ?? storeConfig.tax_rate,
                product_type_overrides: {
                    food_and_beverage: storeConfig.tax_settings?.product_type_overrides?.food_and_beverage
                },
                category_overrides: storeConfig.tax_settings?.category_overrides || [],
            });
        }
    }, [storeConfig, form]);

    const onSubmit = (data: TaxSettingsFormValues) => {
        startTransition(async () => {
            const result = await updateStoreConfigAction({ tax_settings: data });
            if (result.success) {
                toast({ title: 'Success', description: 'Tax settings updated.' });
            } else {
                toast({ variant: 'destructive', title: 'Error', description: result.error });
            }
        });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Tax Management</CardTitle>
                <CardDescription>Set default and override tax rates. Rates should be decimals (e.g., 0.11 for 11%).</CardDescription>
            </CardHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <CardContent className="space-y-8">
                        <FormField control={form.control} name="default_rate" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Default Tax Rate</FormLabel>
                                <FormControl><div className="relative"><Input type="number" step="0.01" {...field} /><Percent className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" /></div></FormControl>
                                <FormDescription>Applied to all items unless an override matches.</FormDescription>
                                <FormMessage />
                            </FormItem>
                        )} />
                        
                        <Separator />

                        <div>
                            <h4 className="font-semibold mb-4">Overrides</h4>
                            <div className="space-y-4">
                                <FormField control={form.control} name="product_type_overrides.food_and_beverage" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Food & Beverage Rate</FormLabel>
                                        <FormControl><div className="relative"><Input type="number" step="0.01" {...field} value={field.value ?? ''} placeholder="e.g. 0.10" /><Percent className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" /></div></FormControl>
                                        <FormDescription>Overrides the default rate for all F&B products.</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>
                        </div>

                         <div>
                            <h4 className="font-semibold mb-4">Category Overrides</h4>
                             <div className="space-y-4">
                                {fields.map((field, index) => (
                                    <div key={field.id} className="flex items-end gap-2 p-3 border rounded-lg bg-muted/50">
                                        <FormField control={form.control} name={`category_overrides.${index}.category_id`} render={({ field }) => (
                                            <FormItem className="flex-1"><FormLabel>Category</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger></FormControl><SelectContent>{categories.map(cat => (<SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>
                                        )} />
                                        <FormField control={form.control} name={`category_overrides.${index}.tax_rate`} render={({ field }) => (
                                            <FormItem className="w-32"><FormLabel>Rate</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => remove(index)}><Trash2 className="h-4 w-4" /></Button>
                                    </div>
                                ))}
                                <Button type="button" variant="outline" size="sm" onClick={() => append({ category_id: '', tax_rate: 0 })}>
                                    <PlusCircle className="mr-2 h-4 w-4" /> Add Category Override
                                </Button>
                             </div>
                        </div>
                        
                        <Button type="submit" disabled={isPending}>
                            {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Saving...</> : <><Save className="mr-2 h-4 w-4"/> Save Tax Settings</>}
                        </Button>
                    </CardContent>
                </form>
            </Form>
        </Card>
    );
}
