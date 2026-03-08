
'use client';

import { useStore } from '@/lib/store';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useEffect, useTransition } from 'react';
import { useToast } from '@/hooks/use-toast';
import { updateStoreConfig } from '@/services/settingsService';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Save } from 'lucide-react';

const storeInfoSchema = z.object({
  store_name: z.string().min(2, 'Store name must be at least 2 characters.'),
  address: z.string().optional(),
  receipt_footer: z.string().optional(),
});

type StoreInfoFormValues = z.infer<typeof storeInfoSchema>;

export function StoreInfoForm() {
    const { storeConfig } = useStore();
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const form = useForm<StoreInfoFormValues>({
        resolver: zodResolver(storeInfoSchema),
        defaultValues: {
            store_name: '',
            address: '',
            receipt_footer: '',
        }
    });

    useEffect(() => {
        if (storeConfig) {
            form.reset({
                store_name: storeConfig.store_name,
                address: storeConfig.address || '',
                receipt_footer: storeConfig.receipt_footer || '',
            });
        }
    }, [storeConfig, form]);

    const onSubmit = (data: StoreInfoFormValues) => {
        startTransition(async () => {
            try {
                await updateStoreConfig(data);
                toast({ title: 'Success', description: 'Store information updated.' });
            } catch (error: any) {
                toast({ variant: 'destructive', title: 'Error', description: error.message || 'Could not update store info.' });
            }
        });
    };
    
    return (
        <Card>
            <CardHeader>
                <CardTitle>Store Information</CardTitle>
                <CardDescription>This information appears on your receipts and reports.</CardDescription>
            </CardHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <CardContent className="space-y-6">
                        <FormField control={form.control} name="store_name" render={({ field }) => (
                            <FormItem><FormLabel>Store Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="address" render={({ field }) => (
                            <FormItem><FormLabel>Address</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="receipt_footer" render={({ field }) => (
                            <FormItem><FormLabel>Receipt Footer Message</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                         <Button type="submit" disabled={isPending}>
                            {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Saving...</> : <><Save className="mr-2 h-4 w-4"/> Save Changes</>}
                        </Button>
                    </CardContent>
                </form>
            </Form>
        </Card>
    );
}
