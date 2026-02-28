
'use client';

import { useDbStore } from '@/lib/db-store';
import { useRef, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { clearTransactionData } from '@/services/dataService';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { TokoCepatLogo } from '@/components/TokoCepatLogo';
import Link from 'next/link';
import { LicenseManager } from '@/components/LicenseManager';
import { SubscriptionManager } from './_components/SubscriptionManager';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Shield, CreditCard, Database, Trash2 } from 'lucide-react';


export default function SettingsPage() {
  const { firesqlite } = useDbStore();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isRestoreAlertOpen, setIsRestoreAlertOpen] = useState(false);
  const [isClearDataAlertOpen, setIsClearDataAlertOpen] = useState(false);

  const handleBackup = async () => {
    if (!firesqlite) {
        toast({ title: 'Error', description: 'Database is not ready. Please try again in a moment.', variant: 'destructive'});
        return;
    }
    try {
        toast({ title: 'Preparing Download', description: 'Your database backup is being generated...'});
        await firesqlite.downloadBinaryBackup('tokoc_backup.db');
    } catch (e: any) {
        console.error("Backup failed", e);
        toast({ title: 'Backup Failed', description: e.message || 'An unknown error occurred.', variant: 'destructive'});
    }
  };

  const handleRestoreConfirm = () => {
    setIsRestoreAlertOpen(false);
    fileInputRef.current?.click();
  };

  const onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !firesqlite) return;

      try {
          toast({ title: 'Restoring...', description: 'Please do not close this window.' });
          await firesqlite.importFullBinary(file);
          toast({ title: 'Restore Complete', description: 'Database has been restored. The app will now reload.' });
          
          setTimeout(() => window.location.reload(), 1500);

      } catch (e: any) {
          console.error("Restore failed", e);
          toast({ title: 'Restore Failed', description: e.message || 'The selected file may be invalid.', variant: 'destructive'});
      } finally {
          if (fileInputRef.current) {
              fileInputRef.current.value = '';
          }
      }
  };

    const handleClearData = async () => {
        try {
            const result = await clearTransactionData();
            if (result.success) {
                toast({
                    title: 'Data Cleared',
                    description: 'All transaction data has been successfully removed. The app will now reload.',
                });
                setTimeout(() => window.location.reload(), 1500);
            } else {
                throw new Error(result.message);
            }
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Error Clearing Data',
                description: error.message || 'An unexpected error occurred.',
            });
        } finally {
            setIsClearDataAlertOpen(false);
        }
    }


  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
      <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
        <Link href="/">
          <TokoCepatLogo />
        </Link>
      </header>
      {/* <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="mx-auto grid w-full max-w-6xl gap-2">
          <h1 className="text-3xl font-semibold">Settings</h1>
        </div>
        <Tabs defaultValue="license" className="mx-auto w-full max-w-6xl">
            <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="license"><Shield className="mr-2 h-4 w-4"/>License</TabsTrigger>
                <TabsTrigger value="subscription"><CreditCard className="mr-2 h-4 w-4"/>Subscription</TabsTrigger>
                <TabsTrigger value="database"><Database className="mr-2 h-4 w-4"/>Database</TabsTrigger>
                <TabsTrigger value="danger"><Trash2 className="mr-2 h-4 w-4"/>Danger Zone</TabsTrigger>
            </TabsList>
            <TabsContent value="license">
                <Card>
                    <CardHeader>
                        <CardTitle>License Status</CardTitle>
                        <CardDescription>Manage your application license and activation.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <LicenseManager />
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="subscription">
                 <SubscriptionManager />
            </TabsContent>
            <TabsContent value="database">
                <Card>
                    <CardHeader>
                        <CardTitle>Database Management</CardTitle>
                        <CardDescription>Manage your application's data. These are advanced actions.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Button variant="outline" onClick={handleBackup}><Database className="mr-2" /> Backup Data</Button>
                            <Button variant="outline" onClick={() => setIsRestoreAlertOpen(true)}><Database className="mr-2" /> Restore Data</Button>
                            <input type="file" ref={fileInputRef} onChange={onFileSelected} accept=".db,.sqlite,.sqlite3" hidden />
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="danger">
                 <Card className="border-destructive/50">
                    <CardHeader>
                        <CardTitle className="text-destructive">Danger Zone</CardTitle>
                        <CardDescription>These actions are irreversible. Be absolutely sure before proceeding.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button variant="destructive" onClick={() => setIsClearDataAlertOpen(true)}><Trash2 className="mr-2" /> Clear All Transaction Data</Button>
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
         <AlertDialog open={isRestoreAlertOpen} onOpenChange={setIsRestoreAlertOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>This action is irreversible. Restoring from a backup will completely overwrite all current data in the application.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleRestoreConfirm}>Yes, Restore Database</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        <AlertDialog open={isClearDataAlertOpen} onOpenChange={setIsClearDataAlertOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>This action is permanent and cannot be undone. This will delete all shifts, transactions, and stock movement history. Product and category data will not be affected.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleClearData}>Yes, Clear All Data</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      </main> */}
        <main className="flex flex-1 flex-col lg:flex-row">

        {/* ============================= */}
        {/* LEFT — HERO / CONTROL PANEL */}
        {/* ============================= */}

        <section className="lg:w-1/3 border-b lg:border-b-0 lg:border-r bg-background p-8 flex flex-col justify-between">

            <div className="space-y-8">

            {/* Header */}
            <div className="space-y-3">
                <h1 className="text-3xl font-bold tracking-tight">
                System Settings
                </h1>
                <p className="text-muted-foreground">
                Manage licensing, subscription, database operations,
                and system-level controls.
                </p>
            </div>

            {/* System Overview Cards */}
            <div className="grid gap-4">

                <div className="rounded-xl border p-4">
                <div className="flex items-center gap-3">
                    <Shield className="h-5 w-5 text-primary" />
                    <div>
                    <p className="text-sm font-medium">License</p>
                    <p className="text-xs text-muted-foreground">
                        Activation & validation
                    </p>
                    </div>
                </div>
                </div>

                <div className="rounded-xl border p-4">
                <div className="flex items-center gap-3">
                    <CreditCard className="h-5 w-5 text-primary" />
                    <div>
                    <p className="text-sm font-medium">Subscription</p>
                    <p className="text-xs text-muted-foreground">
                        Billing & plan management
                    </p>
                    </div>
                </div>
                </div>

                <div className="rounded-xl border p-4">
                <div className="flex items-center gap-3">
                    <Database className="h-5 w-5 text-primary" />
                    <div>
                    <p className="text-sm font-medium">Database</p>
                    <p className="text-xs text-muted-foreground">
                        Backup & restore operations
                    </p>
                    </div>
                </div>
                </div>

                <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4">
                <div className="flex items-center gap-3">
                    <Trash2 className="h-5 w-5 text-destructive" />
                    <div>
                    <p className="text-sm font-medium text-destructive">
                        Danger Zone
                    </p>
                    <p className="text-xs text-muted-foreground">
                        Irreversible system actions
                    </p>
                    </div>
                </div>
                </div>

            </div>

            {/* Quick Database Actions */}
            <div className="space-y-3 pt-6 border-t">
                <p className="text-sm font-medium text-muted-foreground">
                Quick Actions
                </p>

                <div className="flex flex-col gap-3">
                <Button variant="outline" onClick={handleBackup}>
                    <Database className="mr-2 h-4 w-4" />
                    Backup Database
                </Button>

                <Button
                    variant="outline"
                    onClick={() => setIsRestoreAlertOpen(true)}
                >
                    <Database className="mr-2 h-4 w-4" />
                    Restore Database
                </Button>
                </div>
            </div>

            </div>
        </section>


        {/* ============================= */}
        {/* RIGHT — SETTINGS WORKSPACE  */}
        {/* ============================= */}

        <section className="flex-1 p-8">

            <Tabs defaultValue="license" className="w-full">

            <TabsList className="grid w-full grid-cols-4 mb-8">
                <TabsTrigger value="license">
                <Shield className="mr-2 h-4 w-4" />
                License
                </TabsTrigger>

                <TabsTrigger value="subscription">
                <CreditCard className="mr-2 h-4 w-4" />
                Subscription
                </TabsTrigger>

                <TabsTrigger value="database">
                <Database className="mr-2 h-4 w-4" />
                Database
                </TabsTrigger>

                <TabsTrigger value="danger">
                <Trash2 className="mr-2 h-4 w-4" />
                Danger
                </TabsTrigger>
            </TabsList>


            {/* LICENSE */}
            <TabsContent value="license">
                <Card>
                <CardHeader>
                    <CardTitle>License Status</CardTitle>
                    <CardDescription>
                    Manage your application license and activation.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <LicenseManager />
                </CardContent>
                </Card>
            </TabsContent>


            {/* SUBSCRIPTION */}
            <TabsContent value="subscription">
                <SubscriptionManager />
            </TabsContent>


            {/* DATABASE */}
            <TabsContent value="database">
                <Card>
                <CardHeader>
                    <CardTitle>Database Management</CardTitle>
                    <CardDescription>
                    Advanced system data operations.
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                    <Button variant="outline" onClick={handleBackup}>
                    <Database className="mr-2 h-4 w-4" />
                    Backup Data
                    </Button>

                    <Button
                    variant="outline"
                    onClick={() => setIsRestoreAlertOpen(true)}
                    >
                    <Database className="mr-2 h-4 w-4" />
                    Restore Data
                    </Button>
                </CardContent>
                </Card>
            </TabsContent>


            {/* DANGER */}
            <TabsContent value="danger">
                <Card className="border-destructive/50">
                <CardHeader>
                    <CardTitle className="text-destructive">
                    Danger Zone
                    </CardTitle>
                    <CardDescription>
                    These actions are irreversible.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button
                    variant="destructive"
                    onClick={() => setIsClearDataAlertOpen(true)}
                    >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear All Transaction Data
                    </Button>
                </CardContent>
                </Card>
            </TabsContent>

            </Tabs>

        </section>

        </main>
    </div>
  );
}
