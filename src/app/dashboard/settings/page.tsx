
'use client';

import { useDbStore } from '@/lib/db-store';
import { useEffect, useRef, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { clearTransactionData } from '@/services/dataService';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Database, HardHat, Info, Trash2, Shield, Send } from 'lucide-react';
import { TokoCepatLogo } from '@/components/TokoCepatLogo';
import Link from 'next/link';
import { LicenseManager } from '@/components/LicenseManager';
import { ManualPaymentForm } from './_components/ManualPaymentForm';

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
          // Reset file input to allow selecting the same file again
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
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="mx-auto grid w-full max-w-6xl gap-2">
          <h1 className="text-3xl font-semibold">Settings</h1>
        </div>
        <div className="mx-auto grid w-full max-w-6xl items-start gap-6 md:grid-cols-[180px_1fr] lg:grid-cols-[250px_1fr]">
          <nav className="grid gap-4 text-sm text-muted-foreground">
             <a href="#license-management" className="font-semibold text-primary flex items-center gap-2">
              <Shield className="h-4 w-4"/> License
            </a>
            <a href="#manual-payment" className="flex items-center gap-2">
              <Send className="h-4 w-4"/> Manual Payment
            </a>
            <a href="#database-management" className="flex items-center gap-2"><Database className="h-4 w-4"/> Database</a>
             <a href="#danger-zone" className="flex items-center gap-2"><Trash2 className="h-4 w-4"/> Danger Zone</a>
          </nav>
          <div className="grid gap-6">
            <LicenseManager />
            <ManualPaymentForm />
            <Card id="database-management">
              <CardHeader>
                <CardTitle>Database Management</CardTitle>
                <CardDescription>
                  Manage your application's data. These are advanced actions.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Button variant="outline" onClick={handleBackup}>
                        <Database className="mr-2" /> Backup Data
                    </Button>
                     <Button variant="outline" onClick={() => setIsRestoreAlertOpen(true)}>
                        <Database className="mr-2" /> Restore Data
                    </Button>
                     <input type="file" ref={fileInputRef} onChange={onFileSelected} accept=".db,.sqlite,.sqlite3" hidden />
                </div>
              </CardContent>
            </Card>
             <Card id="danger-zone" className="border-destructive/50">
              <CardHeader>
                <CardTitle className="text-destructive">Danger Zone</CardTitle>
                <CardDescription>
                  These actions are irreversible. Be absolutely sure before proceeding.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="destructive" onClick={() => setIsClearDataAlertOpen(true)}>
                    <Trash2 className="mr-2" /> Clear All Transaction Data
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
         <AlertDialog open={isRestoreAlertOpen} onOpenChange={setIsRestoreAlertOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action is irreversible. Restoring from a backup will
                        completely overwrite all current data in the application.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleRestoreConfirm}>
                        Yes, Restore Database
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        <AlertDialog open={isClearDataAlertOpen} onOpenChange={setIsClearDataAlertOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                       This action is permanent and cannot be undone. This will delete all shifts, transactions, and stock movement history. Product and category data will not be affected.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleClearData}>
                        Yes, Clear All Data
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
}
