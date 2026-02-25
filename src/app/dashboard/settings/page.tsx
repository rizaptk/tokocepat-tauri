
'use client';

import * as z from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useStore } from '@/lib/store';
import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { updateStoreConfig } from '@/services/settingsService';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Database, HardHat, Info, Trash2 } from 'lucide-react';
import { TokoCepatLogo } from '@/components/TokoCepatLogo';
import Link from 'next/link';

const storeDetailsSchema = z.object({
  store_name: z.string().min(3, 'Store name must be at least 3 characters.'),
  address: z.string().optional(),
  receipt_footer: z.string().optional(),
});

type StoreDetailsValues = z.infer<typeof storeDetailsSchema>;

export default function SettingsPage() {
  const { storeConfig } = useStore();
  const { toast } = useToast();

  const form = useForm<StoreDetailsValues>({
    resolver: zodResolver(storeDetailsSchema),
    defaultValues: {
      store_name: '',
      address: '',
      receipt_footer: '',
    },
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

  async function onSubmit(data: StoreDetailsValues) {
    try {
      await updateStoreConfig(data);
      toast({
        title: 'Settings Saved',
        description: 'Your store details have been updated.',
      });
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not save settings.',
      });
    }
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
      <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
        <Link href="/">
          <TokoCepatLogo />
        </Link>
      </header>
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="mx-auto grid w-full max-w-6xl gap-2">
          <h1 className="text-3xl font-semibold">Settings</h1>
        </div>
        <div className="mx-auto grid w-full max-w-6xl items-start gap-6 md:grid-cols-[180px_1fr] lg:grid-cols-[250px_1fr]">
          <nav className="grid gap-4 text-sm text-muted-foreground">
            <a href="#store-details" className="font-semibold text-primary">
              Store Details
            </a>
            <a href="#database-management">Database</a>
          </nav>
          <div className="grid gap-6">
            <Card id="store-details">
              <CardHeader>
                <CardTitle>Store Details</CardTitle>
                <CardDescription>
                  Update your store's information. This will be reflected on receipts.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                      control={form.control}
                      name="store_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Store Name</FormLabel>
                          <FormControl>
                            <Input placeholder="My Awesome Store" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Store Address</FormLabel>
                          <FormControl>
                            <Textarea placeholder="123 Main St, Anytown, ID 12345" {...field} />
                          </FormControl>
                           <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="receipt_footer"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Receipt Footer Message</FormLabel>
                          <FormControl>
                            <Input placeholder="Thank you for your business!" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" disabled={!form.formState.isDirty}>Save Changes</Button>
                  </form>
                </Form>
              </CardContent>
            </Card>

            <Card id="database-management">
              <CardHeader>
                <CardTitle>Database Management</CardTitle>
                <CardDescription>
                  Manage your application's data. These are advanced actions.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                 <Alert>
                    <HardHat className="h-4 w-4" />
                    <AlertTitle>Under Construction</AlertTitle>
                    <AlertDescription>
                        These database management features are not yet implemented.
                    </AlertDescription>
                </Alert>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Button variant="outline" disabled>
                        <Database className="mr-2" /> Backup Data
                    </Button>
                     <Button variant="outline" disabled>
                        <Database className="mr-2" /> Restore Data
                    </Button>
                </div>
              </CardContent>
            </Card>
             <Card id="data-cleaning" className="border-destructive/50">
              <CardHeader>
                <CardTitle className="text-destructive">Danger Zone</CardTitle>
                <CardDescription>
                  These actions are irreversible. Be absolutely sure before proceeding.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="destructive" disabled>
                    <Trash2 className="mr-2" /> Clear All Transaction Data
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
