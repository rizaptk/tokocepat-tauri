import { useState, useEffect, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { resetApplicationData } from '@/services/dataService';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
// import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Link } from 'react-router-dom';
import { StoreInfoForm } from './_components/StoreInfoForm';
import { TaxSettingsForm } from './_components/TaxSettingsForm';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Settings2, Trash2, Printer, Usb, AlertTriangle, Store, Percent, Bluetooth, RefreshCw, Download, MenuIcon } from 'lucide-react';
import { TokoCepatLogo } from '@/components/TokoCepatLogo';
import { ThemeToggle } from '@/components/ThemeButtons';
// import { useDbStore } from '@/lib/db-store';
import { NotificationBell } from '@/components/NotificationBell';
import { LicenseInfo } from '@/components/LicenseInfo';
import { ScrollArea } from '@/components/ui/scroll-area';
import { usePrinterStore } from '@/lib/print-detect-store';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
// import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

import { save } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { SyncManager } from './_components/SyncManager';
import { NetworkSecurity } from './_components/NetworkSecurity';
import { useLicense } from '@/hooks/useLicense';
import { useSyncStore } from '@/lib/sync-store';
import { CustomizeAccess } from './_components/CustomizeAccess';

export default function SettingsPage() {
    const { toast } = useToast();
    const [isResetAlertOpen, setIsResetAlertOpen] = useState(false);
    const { licenseDetails } = useLicense();
    const { isNetworkEnable } = useSyncStore();

    // Printer state
    const [isPairing, setIsPairing] = useState(false);
    const { availablePrinters, savedPrinter, savedPrinterName, savePrinter, isOnline, isEnabled, setIsEnabled } = usePrinterStore();
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
                toast({ variant: 'destructive', title: "Waktu Habis", description: "Printer tidak ditemukan." });
            }
        }, 3000);

        return () => clearTimeout(timer);
    }, [savedPrinterName, isPairing, availablePrinters, toast]);

    const handleBackup = async () => {
        try {
            const targetPath = await save({
                title: 'Simpan Cadangan Database',
                defaultPath: `backup_tokocepat_${new Date().toISOString().split('T')[0]}.db.zip`,
                filters: [{ name: 'Archived Database', extensions: ['zip'] }]
            });

            if (!targetPath) return;
            toast({ title: 'Memproses...', description: 'Sedang membuat file cadangan.' });
            await invoke('native_backup', { targetPath });
            toast({ title: 'Berhasil', description: 'Database berhasil dicadangkan.' });
        } catch (e: any) {
            toast({ title: 'Gagal', description: e, variant: 'destructive' });
        }
    };

    const handleResetData = async () => {
        try {
            const result = await resetApplicationData();
            if (result.success) {
                localStorage.removeItem('tokoc_db_version');
                toast({ title: 'Reset Berhasil', description: 'Aplikasi akan dimuat ulang.' });
                setTimeout(() => window.location.reload(), 1500);
            } else {
                throw new Error(result.message);
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Gagal', description: error.message });
        } finally {
            setIsResetAlertOpen(false);
        }
    }

    return (
        <div className="flex h-screen min-h-0 w-full flex-col bg-muted/40">
            <header className="sticky shrink-0 top-0 z-20 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6 justify-between">
                <Link to="/"><TokoCepatLogo /></Link>
                <div className="flex items-center gap-2">
                    <NotificationBell />
                    <ThemeToggle />
                </div>
            </header>

            <main className="flex flex-1 flex-col lg:flex-row min-h-0">
                <section className="lg:w-2/5 border-b lg:border-b-0 lg:border-r bg-background p-8 flex flex-col justify-between">
                    <div className="space-y-8">
                        <div className="space-y-3">
                            <h1 className="text-3xl font-bold tracking-tight">Pengaturan</h1>
                            <p className="text-muted-foreground">Kelola konfigurasi toko dan sistem Anda.</p>
                        </div>
                        <LicenseInfo />
                    </div>
                </section>

                <section className="flex-1 min-h-0">
                    <ScrollArea className="h-full">
                        <div className="p-8">
                            <Tabs defaultValue="store" className="w-full min-h-0">
                                <TabsList className="w-full mb-8 overflow-x-auto no-scrollbar justify-start">
                                    <TabsTrigger value="store"><Store className="mr-2 h-4 w-4" />Toko</TabsTrigger>
                                    {isSyncAvailable && <TabsTrigger value="sync"><RefreshCw className="mr-2 h-4 w-4" />Jaringan</TabsTrigger>}
                                    <TabsTrigger value="taxes"><Percent className="mr-2 h-4 w-4" />Pajak</TabsTrigger>
                                    <TabsTrigger value="printer"><Printer className="mr-2 h-4 w-4" />Printer</TabsTrigger>
                                    {isSyncAvailable && <TabsTrigger value="access"><MenuIcon className="mr-2 h-4 w-4" />Akses</TabsTrigger>}
                                    <TabsTrigger value="maintenance"><Settings2 className="mr-2 h-4 w-4" />Sistem</TabsTrigger>
                                </TabsList>

                                <TabsContent value="store"><StoreInfoForm /></TabsContent>

                                <TabsContent value="sync" className="space-y-6">
                                    {isSyncAvailable && (
                                        <>
                                            <SyncManager />
                                            {isNetworkEnable && <NetworkSecurity />}
                                        </>
                                    )}
                                </TabsContent>

                                <TabsContent value="taxes"><TaxSettingsForm /></TabsContent>

                                <TabsContent value="printer">
                                    <Card>
                                        <CardHeader>
                                            <div className="flex items-center justify-between">
                                                <div className="space-y-1">
                                                    <CardTitle>Printer</CardTitle>
                                                    <CardDescription>Konfigurasi printer thermal.</CardDescription>
                                                </div>
                                                <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
                                            </div>
                                        </CardHeader>
                                        <CardContent className={cn("space-y-6", !isEnabled && "opacity-50 pointer-events-none")}>
                                            <div className="p-4 rounded-lg border bg-muted/50">
                                                {availablePrinters.length > 0 ? (
                                                    <div className="space-y-2">
                                                        {availablePrinters.map(p => (
                                                            <div key={p.address} className={cn("flex items-center justify-between p-3 rounded-md border bg-background cursor-pointer", savedPrinter === p.address && "border-primary ring-1 ring-primary")} onClick={() => savePrinter(p.address, p.baud_rate)}>
                                                                <div className="flex items-center gap-2">
                                                                    {p.kind === 'bluetooth' ? <Bluetooth className="h-4 w-4" /> : <Usb className="h-4 w-4" />}
                                                                    <span className="text-sm font-medium">{p.name}</span>
                                                                    {savedPrinter === p.address && <Badge variant={isOnline ? "success" : "destructive"} className="text-[10px]">{isOnline ? "Online" : "Offline"}</Badge>}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : <p className="text-sm text-muted-foreground">Tidak ada printer terdeteksi.</p>}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </TabsContent>

                                <TabsContent value="access" className="space-y-6">
                                    {isSyncAvailable && (
                                        <>
                                            <CustomizeAccess />
                                        </>
                                    )}
                                </TabsContent>

                                {/* GABUNGAN DATABASE & DANGER ZONE */}
                                <TabsContent value="maintenance">
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Pemeliharaan Sistem</CardTitle>
                                            <CardDescription>Cadangkan data atau reset aplikasi.</CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-8">
                                            {/* Bagian Backup */}
                                            <div className="space-y-4">
                                                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                                    <Download className="h-4 w-4" /> Ekspor Data
                                                </div>
                                                <Button variant="outline" onClick={handleBackup} className="w-full md:w-auto px-8">
                                                    Buat Cadangan (.zip)
                                                </Button>
                                                <p className="text-xs text-muted-foreground">
                                                    Disarankan untuk mencadangkan data secara rutin ke penyimpanan eksternal.
                                                </p>
                                            </div>

                                            <Separator />

                                            {/* Bagian Danger Zone */}
                                            <div className="space-y-4">
                                                <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                                                    <AlertTriangle className="h-4 w-4" /> Zona Berbahaya
                                                </div>
                                                <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                                                    <div className="space-y-1 text-center md:text-left">
                                                        <p className="text-sm font-bold text-destructive">Hapus Semua Data Bisnis</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            Menghapus permanen semua produk, transaksi, dan laporan.
                                                        </p>
                                                    </div>
                                                    <Button variant="destructive" size="sm" onClick={() => setIsResetAlertOpen(true)}>
                                                        <Trash2 className="mr-2 h-4 w-4" /> Reset Sekarang
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </TabsContent>
                            </Tabs>
                        </div>
                    </ScrollArea>
                </section>
            </main>

            <AlertDialog open={isResetAlertOpen} onOpenChange={setIsResetAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Hapus semua data?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tindakan ini tidak dapat dibatalkan. Semua transaksi dan produk akan hilang permanen.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction onClick={handleResetData} className="bg-destructive hover:bg-destructive/90 text-white">
                            Ya, Hapus Semua
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}