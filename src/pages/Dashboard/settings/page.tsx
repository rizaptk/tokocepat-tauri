import { useRef, useState, useEffect, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { resetApplicationData } from '@/services/dataService';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Link } from 'react-router-dom';
import { StoreInfoForm } from './_components/StoreInfoForm';
import { TaxSettingsForm } from './_components/TaxSettingsForm';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Database, Trash2, Printer, Usb, AlertTriangle, Store, Percent, CheckCircle2, Bluetooth, RefreshCw } from 'lucide-react';
import { TokoCepatLogo } from '@/components/TokoCepatLogo';
import { ThemeToggle } from '@/components/ThemeButtons';
import { useDbStore } from '@/lib/db-store';
import { NotificationBell } from '@/components/NotificationBell';
import { LicenseInfo } from '@/components/LicenseInfo';
import { ScrollArea } from '@/components/ui/scroll-area';
import { usePrinterStore } from '@/lib/print-detect-store';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

import { save, open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { SyncManager } from './_components/Syncmanager';
import { RolesManager } from './_components/RolesManager';
import { NetworkSecurity } from './_components/NetworkSecurity';

export default function SettingsPage() {
    const { firesqlite } = useDbStore();
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isRestoreAlertOpen, setIsRestoreAlertOpen] = useState(false);
    const [isResetAlertOpen, setIsResetAlertOpen] = useState(false);
    const [licenseDetails, setLicenseDetails] = useState<any>(null);
    const [currentRoleIsLeader, setCurrentRoleIsLeader] = useState(false);
    const [isSyncActive, setIsSyncActive] = useState(false);

    // Printer state
    const [isPairing, setIsPairing] = useState(false);
    const { availablePrinters, savedPrinter, savedPrinterName, savePrinter, isOnline, isEnabled, setIsEnabled } = usePrinterStore();

    useEffect(() => {
        // Fetch license details to check if sync is available
        invoke('check_license').then(([_, details]: any) => {
            setLicenseDetails(details);
        });
    }, []);

    const isSyncAvailable = useMemo(() => licenseDetails?.isSyncAvailable === true, [licenseDetails]);

    useEffect(() => {
        if (!isPairing) return;

        const printeritem = availablePrinters.find(p => p.address.toLocaleLowerCase() === savedPrinter?.toLocaleLowerCase());
        
        if (printeritem) {
            toast({ title: "Printer Terhubung", description: `${printeritem.name} siap digunakan.` });
            setIsPairing(false);
            return;
        }

        const timer = setTimeout(() => {
            if (availablePrinters.length === 0) {
                setIsPairing(false);
                toast({ variant: 'destructive', title: "Waktu Habis", description: "Printer tidak ditemukan. Pastikan perangkat terhubung." });
            }
        }, 3000);

        return () => clearTimeout(timer);
    }, [savedPrinterName, isPairing, availablePrinters, toast]);

    const handleBackup = async () => {
        try {
            // 1. Pick where to save the file
            const targetPath = await save({
                title: 'Simpan Cadangan Database',
                defaultPath: `backup_tokocepat_${new Date().toISOString().split('T')[0]}.db.gz`,
                filters: [{ name: 'Gzipped Database', extensions: ['gz'] }]
            });

            if (!targetPath) return;

            toast({ title: 'Memproses Backup...', description: 'Sedang mengompresi data.' });

            // 2. Call the native Rust command
            await invoke('native_backup', { targetPath });

            toast({ title: 'Backup Berhasil', description: 'File berhasil disimpan secara aman.' });
        } catch (e: any) {
            toast({ title: 'Backup Gagal', description: e, variant: 'destructive' });
        }
    };

    const handleRestoreConfirm = async () => {
        setIsRestoreAlertOpen(false);
        
        try {
            // 1. Pick the backup file
            const sourcePath = await open({
                title: 'Pilih File Cadangan',
                filters: [{ name: 'Gzipped Database', extensions: ['gz'] }],
                multiple: false
            });

            if (!sourcePath) return;

            toast({ 
                title: 'Memulai Pemulihan', 
                description: 'Aplikasi akan dimuat ulang secara otomatis setelah selesai.',
                duration: 5000 
            });

            // 2. Call the native Rust command
            // This will trigger app.restart() on success
            await invoke('native_restore', { sourcePath });

        } catch (e: any) {
            toast({ title: 'Pemulihan Gagal', description: e, variant: 'destructive' });
        }
    };

    const onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !firesqlite) return;

        try {
            toast({ title: 'Memulihkan...', description: 'Mohon jangan tutup jendela ini.' });
            await firesqlite.importFullBinary(file);
            toast({ title: 'Pemulihan Selesai', description: 'Database berhasil dipulihkan. Aplikasi akan dimuat ulang.' });

            setTimeout(() => window.location.reload(), 1500);

        } catch (e: any) {
            console.error("Restore failed", e);
            toast({ title: 'Pemulihan Gagal', description: e.message || 'File tidak valid.', variant: 'destructive' });
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
                localStorage.removeItem('tokoc_db_version');
                toast({
                    title: 'Reset Berhasil',
                    description: 'Semua data bisnis telah dihapus. Aplikasi akan dimuat ulang.',
                });
                setTimeout(() => window.location.reload(), 1500);
            } else {
                throw new Error(result.message);
            }
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Gagal Reset Data',
                description: error.message || 'Terjadi kesalahan sistem.',
            });
        } finally {
            setIsResetAlertOpen(false);
        }
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
                                Pengaturan Sistem
                            </h1>
                            <p className="text-muted-foreground">
                                Kelola info toko, pajak, lisensi, database, dan kontrol sistem.
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
                                    <TabsTrigger value="store"><Store className="mr-2 h-4 w-4" />Toko</TabsTrigger>
                                    {isSyncAvailable && (
                                        <TabsTrigger value="sync"><RefreshCw className="mr-2 h-4 w-4" />Jaringan</TabsTrigger>
                                    )}
                                    <TabsTrigger value="taxes"><Percent className="mr-2 h-4 w-4" />Pajak</TabsTrigger>
                                    <TabsTrigger value="printer"><Printer className="mr-2 h-4 w-4" />Printer</TabsTrigger>
                                    <TabsTrigger value="database"><Database className="mr-2 h-4 w-4" />Database</TabsTrigger>
                                    <TabsTrigger data-danger value="danger" className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Bahaya</TabsTrigger>
                                </TabsList>

                                <TabsContent value="store">
                                    <StoreInfoForm />
                                </TabsContent>

                                <TabsContent value="sync" className="space-y-6">
                                    <SyncManager 
                                        isSyncAvailable={isSyncAvailable} 
                                        onSyncStatusChange={(active, isLeader) => {
                                            setIsSyncActive(active);
                                            setCurrentRoleIsLeader(isLeader);
                                        }} />
                                    <RolesManager />
                                    {isSyncActive && (
                                        <>  
                                            { currentRoleIsLeader && <RolesManager /> }
                                            <NetworkSecurity isLeader={currentRoleIsLeader} />
                                        </>
                                    )}
                                </TabsContent>

                                <TabsContent value="taxes">
                                    <TaxSettingsForm />
                                </TabsContent>

                                <TabsContent value="printer">
                                    <Card>
                                        <CardHeader>
                                            <div className="flex items-center justify-between">
                                                <div className="space-y-1">
                                                    <CardTitle>Pengaturan Printer</CardTitle>
                                                    <CardDescription>Hubungkan printer thermal USB/Bluetooth untuk cetak struk otomatis.</CardDescription>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Label htmlFor="printer-enable" className="text-sm font-medium">
                                                        {isEnabled ? 'Aktif' : 'Nonaktif'}
                                                    </Label>
                                                    <Switch 
                                                        id="printer-enable" 
                                                        checked={isEnabled} 
                                                        onCheckedChange={(checked) => {
                                                            setIsEnabled(checked);
                                                        }} 
                                                    />
                                                </div>
                                            </div>
                                        </CardHeader>
                                        <CardContent className={cn("space-y-6 transition-opacity", !isEnabled && "opacity-50 pointer-events-none")}>
                                            <div className="p-4 rounded-lg border bg-muted/50">
                                                <h4 className="font-semibold">Perangkat Terhubung</h4>
                                                {availablePrinters.length > 0 ? (
                                                    <div className="mt-3 space-y-2">
                                                        {availablePrinters.map(p => (
                                                            <div
                                                                key={`${p.name}-${p.address}`}
                                                                className={cn(
                                                                    "flex items-center justify-between p-3 rounded-md border bg-background cursor-pointer",
                                                                    savedPrinter === p.address ? "border-primary ring-1 ring-primary" : "hover:border-primary/50"
                                                                )}
                                                                onClick={() => savePrinter(p.address, p.baud_rate)}
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    {p.kind === 'bluetooth' ? (
                                                                        <Bluetooth className="h-4 w-4 text-muted-foreground" />
                                                                    ) : (
                                                                        <Usb className="h-4 w-4 text-muted-foreground" />
                                                                    )}
                                                                    <span className="text-sm font-medium">{p.name || 'Printer Tanpa Nama'}</span>

                                                                    {/* NEW: Online Indicator for the selected printer */}
                                                                    {savedPrinter?.toLocaleLowerCase() === p.address.toLocaleLowerCase() && (
                                                                        <Badge variant={isOnline ? "success" : "destructive"} className="ml-2 text-[10px] py-0 px-1">
                                                                            {isOnline ? "Online" : "Offline"}
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                                {savedPrinter?.toLocaleLowerCase() === p.address.toLocaleLowerCase() && isOnline && <CheckCircle2 className="h-4 w-4 text-primary" />}
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-sm text-muted-foreground mt-2">Belum ada printer yang terdeteksi.</p>
                                                )}
                                            </div>
                                            <Alert>
                                                <AlertTriangle className="h-4 w-4" />
                                                <AlertTitle>Instruksi Penting</AlertTitle>
                                                <AlertDescription>
                                                    <ul className="list-disc pl-5 space-y-2 mt-2 text-sm text-muted-foreground">
                                                        <li><b>Otomatis:</b> Cukup colok USB atau nyalakan Bluetooth yang sudah dipairing.</li>
                                                        <li><b>Bluetooth:</b> Pairing printer di <b>Pengaturan Bluetooth</b> sistem terlebih dahulu.</li>
                                                        <li><b>USB:</b> Gunakan <a href="https://zadig.akeo.ie/" target="_blank" rel="noopener noreferrer" className="underline font-semibold mx-1 text-primary">Zadig Tool</a> dan ganti driver ke <b>'WinUSB'</b> untuk performa terbaik.</li>
                                                        <li><b>Siap Cetak:</b> Pilih printer dari daftar di atas untuk mengaktifkan.</li>
                                                    </ul>
                                                </AlertDescription>
                                            </Alert>
                                        </CardContent>
                                    </Card>
                                </TabsContent>

                                <TabsContent value="database">
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Manajemen Database</CardTitle>
                                            <CardDescription>Kelola cadangan data lokal dan pemulihan.</CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-6">
                                            <div className="grid gap-4 md:grid-cols-2">
                                                <Button variant="outline" onClick={() => setIsRestoreAlertOpen(true)} className="h-auto py-4 flex-col gap-2">
                                                    <Database className="h-5 w-5" /> Restore Database
                                                </Button>
                                                <Button variant="outline" onClick={handleBackup} className="h-auto py-4 flex-col gap-2">
                                                    <Database className="h-5 w-5" /> Backup Database
                                                </Button>
                                            </div>
                                            <input type="file" ref={fileInputRef} onChange={onFileSelected} accept=".db,.sqlite,.sqlite3" hidden />
                                        </CardContent>
                                    </Card>
                                </TabsContent>

                                <TabsContent value="danger">
                                    <Card className="border-destructive/50">
                                        <CardHeader>
                                            <CardTitle className="text-destructive">Zona Bahaya</CardTitle>
                                            <CardDescription>Tindakan ini tidak dapat dibatalkan. Mohon berhati-hati.</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <Button variant="destructive" onClick={() => setIsResetAlertOpen(true)}><Trash2 className="mr-2 h-4 w-4" /> Reset Semua Data</Button>
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
                        <AlertDialogTitle>Apakah Anda yakin?</AlertDialogTitle>
                        <AlertDialogDescription>Tindakan ini akan menimpa seluruh data yang ada saat ini dengan data dari file backup.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRestoreConfirm}>Ya, Restore</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <AlertDialog open={isResetAlertOpen} onOpenChange={setIsResetAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Reset Semua Data Aplikasi?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Semua data transaksi, produk, dan shift akan dihapus permanen. Lisensi Anda tidak akan terpengaruh.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction onClick={handleResetData}>Ya, Reset Semua</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
