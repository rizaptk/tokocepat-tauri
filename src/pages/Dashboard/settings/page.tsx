

import { useRef, useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { getBackupMetadata, promptAndSetBackupFile, performBackup } from '@/lib/backupService';
import { printerManager, type PrinterInfo } from '@/lib/webUSBprinter';
import { resetApplicationData } from '@/services/dataService';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Link } from 'react-router-dom';
import { StoreInfoForm } from './_components/StoreInfoForm';
import { TaxSettingsForm } from './_components/TaxSettingsForm';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Database, Trash2, Loader2, Printer, Usb, AlertTriangle, Store, Percent } from 'lucide-react';
import { TokoCepatLogo } from '@/components/TokoCepatLogo';
import { ThemeToggle } from '@/components/ThemeButtons';
import { useDbStore } from '@/lib/db-store';
import { NotificationBell } from '@/components/NotificationBell';
import { appStorage } from '@/lib/tauristorage';
import { LicenseInfo } from '@/components/LicenseInfo';
import { ScrollArea } from '@/components/ui/scroll-area';


export default function SettingsPage() {
  const { firesqlite } = useDbStore();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isRestoreAlertOpen, setIsRestoreAlertOpen] = useState(false);
  const [isResetAlertOpen, setIsResetAlertOpen] = useState(false);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [isBackupLoading, setIsBackupLoading] = useState(false);
  
  // Printer state
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [isPairing, setIsPairing] = useState(false);


  const fetchBackupStatus = async () => {
    const meta = await getBackupMetadata();
    setLastBackup(meta.lastBackup??null);
  };

  const loadPrinters = async () => {
    const paired = await printerManager.getPairedDevices();
    setPrinters(paired);
  };
  
  useEffect(() => {
      fetchBackupStatus();
      loadPrinters();
  }, []);
  
  const handlePairPrinter = async () => {
    setIsPairing(true);
    try {
        const newDevice = await printerManager.request();
        if (newDevice) {
            toast({ title: "Printer Paired", description: `${newDevice.productName} is now ready for printing.` });
            await loadPrinters(); // Refresh list
        }
    } catch (err: any) {
        if (err.name !== 'NotFoundError') {
            toast({ variant: 'destructive', title: "Pairing Failed", description: err.message });
        }
    } finally {
        setIsPairing(false);
    }
  };

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

  const handleResetData = async () => {
      try {
          const result = await resetApplicationData();
          if (result.success) {
              appStorage.removeItem('tokoc_db_version');
              toast({
                  title: 'Application Reset',
                  description: 'All business data has been reset. The app will now reload.',
              });
              setTimeout(() => window.location.reload(), 1500);
          } else {
              throw new Error(result.message);
          }
      } catch (error: any) {
          toast({
              variant: 'destructive',
              title: 'Error Resetting Data',
              description: error.message || 'An unexpected error occurred.',
          });
      } finally {
          setIsResetAlertOpen(false);
      }
  }
  
  const handleForceBackup = async () => {
      if (!firesqlite) {
          toast({ title: 'Error', description: 'Database not ready.', variant: 'destructive'});
          return;
      }
      setIsBackupLoading(true);
      toast({ title: 'Backup In Progress...', description: 'Saving data to your backup file.'});
      const success = await performBackup(firesqlite, true);
      if (success) {
          await fetchBackupStatus(); // Refresh timestamp
          toast({ title: 'Backup Complete', description: 'Your data has been successfully saved.'});
      } else {
          toast({ title: 'Backup Failed', description: 'Could not save data. Please check file permissions.', variant: 'destructive'});
      }
      setIsBackupLoading(false);
  }

  const handleChangeLocation = async () => {
      await promptAndSetBackupFile();
      await fetchBackupStatus(); // Refresh last backup time
      toast({ title: 'Backup Location Updated', description: 'Future backups will be saved to the new location.' });
  }

  return (
    <div className="flex h-screen min-h-0 w-full flex-col bg-muted/40">
        <header className="sticky shrink-0 top-0 z-20 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6 justify-between">
            <Link to="/">
            <TokoCepatLogo />
            </Link>
            <div className="flex items-center gap-2">
                <NotificationBell />
                <ThemeToggle />
            </div>
        </header>
        <main className="flex flex-1 flex-col lg:flex-row min-h-0">

            <section className="lg:w-2/5 border-b lg:border-b-0 lg:border-r bg-background p-8 flex flex-col justify-between">

                <div className="space-y-8">
                    <div className="space-y-3">
                        <h1 className="text-3xl font-bold tracking-tight">
                        System Settings
                        </h1>
                        <p className="text-muted-foreground">
                        Manage store info, taxes, licensing, database,
                        and system-level controls.
                        </p>
                    </div>

                    <LicenseInfo />
                </div>
            </section>

            <section className="flex-1 min-h-0">

                <ScrollArea className="h-full">
                    <div className="p-8">
                        <Tabs defaultValue="store" className="w-full min-h-0">
                            <TabsList className="w-full mb-8 overflow-x-auto overflow-y-hidden no-scrollbar">
                                <TabsTrigger value="store"><Store className="mr-2 h-4 w-4" />Store</TabsTrigger>
                                <TabsTrigger value="taxes"><Percent className="mr-2 h-4 w-4" />Taxes</TabsTrigger>
                                <TabsTrigger value="printer"><Printer className="mr-2 h-4 w-4" />Printer</TabsTrigger>
                                <TabsTrigger value="database"><Database className="mr-2 h-4 w-4" />Database</TabsTrigger>
                                <TabsTrigger data-danger value="danger" className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Danger</TabsTrigger>
                            </TabsList>
                            
                            <TabsContent value="store">
                            <StoreInfoForm />
                            </TabsContent>

                            <TabsContent value="taxes">
                                <TaxSettingsForm />
                            </TabsContent>

                            <TabsContent value="printer">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Direct Printer Setup</CardTitle>
                                        <CardDescription>Connect to a USB thermal printer for automatic receipt printing.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
                                        <div className="p-4 rounded-lg border bg-muted/50">
                                            <h4 className="font-semibold">Paired Devices</h4>
                                            {printers.length > 0 ? (
                                                <ul className="text-sm list-disc pl-5 mt-2 text-muted-foreground">
                                                    {printers.map(p => <li key={`${p.vendorId}-${p.productId}`}>{p.productName || 'Unnamed Printer'}</li>)}
                                                </ul>
                                            ) : (
                                                <p className="text-sm text-muted-foreground mt-2">No printers have been paired with this site yet.</p>
                                            )}
                                        </div>
                                        <Button onClick={handlePairPrinter} disabled={isPairing}>
                                            {isPairing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Usb className="mr-2 h-4 w-4"/>}
                                            Pair New Printer
                                        </Button>
                                        <Alert>
                                            <AlertTriangle className="h-4 w-4" />
                                            <AlertTitle>Important Setup Instructions</AlertTitle>
                                            <AlertDescription>
                                                <ul className="list-disc pl-5 space-y-2 mt-2">
                                                    <li>This feature requires an <b>HTTPS</b> connection.</li>
                                                    <li><b>Windows Users:</b> You must use the <a href="https://zadig.akeo.ie/" target="_blank" rel="noopener noreferrer" className="underline font-semibold">Zadig tool</a> to replace the printer driver with 'WinUSB'. This is a one-time setup per printer.</li>
                                                    <li>To unpair a device, go to your browser's site settings (usually a lock icon in the address bar) and remove the USB permission for this website.</li>
                                                </ul>
                                            </AlertDescription>
                                        </Alert>
                                    </CardContent>
                                </Card>
                            </TabsContent>
                            
                            <TabsContent value="database">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Database Management</CardTitle>
                                        <CardDescription>Manage local data backup and restore operations.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
                                        <div className="p-4 rounded-lg border bg-muted/50">
                                            <h4 className="font-semibold">Auto-Backup Status</h4>
                                            {lastBackup ? (
                                                <p className="text-sm text-muted-foreground">
                                                    Last backup: {formatDistanceToNow(new Date(lastBackup), { addSuffix: true })}
                                                </p>
                                            ) : (
                                                <p className="text-sm text-muted-foreground">
                                                    Auto-backup is not yet configured or has not run.
                                                </p>
                                            )}
                                        </div>
                                        <div className="grid gap-4 md:grid-cols-2">
                                            <Button variant="outline" onClick={handleForceBackup} disabled={isBackupLoading}>
                                                {isBackupLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
                                                Force Backup Now
                                            </Button>
                                            <Button variant="outline" onClick={handleChangeLocation}>
                                                <Database className="mr-2 h-4 w-4" /> Change Backup Location
                                            </Button>
                                            <Button variant="outline" onClick={() => setIsRestoreAlertOpen(true)}>
                                                <Database className="mr-2 h-4 w-4" /> Manual Restore
                                            </Button>
                                            <Button variant="outline" onClick={handleBackup}>
                                                <Database className="mr-2 h-4 w-4" /> Download Manual Backup
                                            </Button>
                                        </div>
                                        <input type="file" ref={fileInputRef} onChange={onFileSelected} accept=".db,.sqlite,.sqlite3" hidden />
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
                                        <Button variant="destructive" onClick={() => setIsResetAlertOpen(true)}><Trash2 className="mr-2 h-4 w-4" /> Reset Application Data</Button>
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        </Tabs>
                    </div>
                </ScrollArea>
            </section>
        </main>
        
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
        <AlertDialog open={isResetAlertOpen} onOpenChange={setIsResetAlertOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Reset All Application Data?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action is permanent and cannot be undone. It will delete all local business data and clear your auto-backup file configuration. If you wish to preserve the current backup, please make a copy of the file before proceeding. Your license will not be affected.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleResetData}>Yes, Reset Everything</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}
