
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
  store_name: z.string().min(2, 'Nama toko minimal 2 karakter.'),
  address: z.string().optional(),
  receipt_footer: z.string().optional().or(z.literal('')),
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
                toast({ title: 'Berhasil', description: 'Informasi toko telah diperbarui.' });
            } catch (error: any) {
                toast({ variant: 'destructive', title: 'Error', description: error.message || 'Gagal memperbarui info toko.' });
            }
        });
    };
    
    return (
        <Card>
            <CardHeader>
                <CardTitle>Informasi Toko</CardTitle>
                <CardDescription>Informasi ini akan muncul pada struk belanja dan laporan Anda.</CardDescription>
            </CardHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <CardContent className="space-y-6">
                        <FormField control={form.control} name="store_name" render={({ field }) => (
                            <FormItem><FormLabel>Nama Toko</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="address" render={({ field }) => (
                            <FormItem><FormLabel>Alamat</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="receipt_footer" render={({ field }) => (
                            <FormItem><FormLabel>Pesan Kaki Struk (Footer)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                         <Button type="submit" disabled={isPending}>
                            {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Menyimpan...</> : <><Save className="mr-2 h-4 w-4"/> Simpan Perubahan</>}
                        </Button>
                    </CardContent>
                </form>
            </Form>
        </Card>
    );
}
