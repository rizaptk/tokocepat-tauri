import { useLicense } from '@/hooks/useLicense';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Skeleton } from './ui/skeleton';
import { Badge } from './ui/badge';
import { CheckCircle, XCircle, Clock, ShieldOff, Loader2, AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
// import { generateDeviceFingerprint } from '@/lib/security';
// import { saveLicenseData } from '@/services/dataService';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
// import { apiFetch } from '@/lib/api-client';
import { invoke } from '@tauri-apps/api/core';

export function LicenseManager() {
    const { status, licenseDetails, deactivate } = useLicense();
    const [licenseKey, setLicenseKey] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    // LicenseManager.tsx snippet
    const handleActivate = async () => {
        if (!licenseKey.trim()) {
            toast({ variant: 'destructive', title: 'Kode lisensi tidak boleh kosong.' });
            return;
        }
        setIsLoading(true);

        try {
            // Simple call to Rust - no deviceId or apiFetch needed here
            await invoke('activate_manual_license', { licenseKey });

            toast({ title: 'Aktivasi Berhasil!', description: 'Aplikasi akan dimuat ulang.' });
            setTimeout(() => window.location.reload(), 1500);

        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Aktivasi Gagal', description: error });
            setIsLoading(false);
        }
    };

    // handleDeactivate stays mostly the same but now triggers the Rust-powered hook method
    const handleDeactivate = async () => {
        setIsLoading(true);
        try {
            await deactivate(); 
            toast({ title: 'Deaktivasi Berhasil!' });
            setTimeout(() => window.location.reload(), 1500);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Deaktivasi Gagal', description: error });
        } finally {
            setIsLoading(false);
        }
    };

    if (status === 'LOADING') {
        return (
             <div className="space-y-4">
                  <Skeleton className="h-8 w-1/4" />
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-10 w-full" />
              </div>
        )
    }

    if (status === 'VALID' || status === 'EXPIRES_SOON') {
        return (
             <div className="space-y-4">
                  {status === 'EXPIRES_SOON' && licenseDetails?.daysRemaining != null && (
                    <Alert variant="destructive" className="bg-orange-50 border-orange-200 text-orange-800 dark:bg-orange-950/30 dark:border-orange-800 dark:text-orange-300 [&>svg]:text-orange-600">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Lisensi Segera Berakhir</AlertTitle>
                        <AlertDescription>
                            Lisensi berakhir dalam {licenseDetails.daysRemaining} hari. Perbarui langganan agar layanan tidak terputus.
                        </AlertDescription>
                    </Alert>
                  )}
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <p className="font-semibold text-green-600">Lisensi Aktif</p>
                  </div>
                  <div className="text-sm space-y-1">
                    <p>Paket: <Badge variant="secondary">{licenseDetails.plan}</Badge></p>
                    <p>Berakhir: <span className="font-medium">{licenseDetails.expiresAt === 'Never' ? 'Selamanya' : new Date(licenseDetails.expiresAt).toLocaleDateString()}</span></p>
                    <p className="text-xs text-muted-foreground pt-1 break-all">Device ID: {licenseDetails.deviceId}</p>
                  </div>
                  <Button variant="outline" className="w-full" onClick={handleDeactivate} disabled={isLoading}>
                    {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Memproses...</> : 'Deaktivasi Perangkat Ini'}
                  </Button>
              </div>
        )
    }

    // Default to activation form for NOT_FOUND, EXPIRED, INVALID, etc.
    const getErrorContent = () => {
        switch (status) {
            case 'INVALID':
                return { icon: XCircle, title: "Lisensi Tidak Valid", description: "Data lisensi rusak. Silakan aktivasi ulang." };
            case 'EXPIRED':
                return { icon: Clock, title: "Lisensi Kedaluwarsa", description: "Perbarui lisensi untuk terus menggunakan aplikasi." };
            case 'TAMPERED':
                return { icon: ShieldOff, title: "Manipulasi Waktu", description: "Waktu sistem tidak akurat. Mohon atur jam dengan benar." };
            case 'CLONED':
                return { icon: ShieldOff, title: "Perangkat Berbeda", description: "Lisensi terdaftar di perangkat lain. Deaktivasi perangkat lama dahulu." };
            default:
                return null;
        }
    }
    const errorContent = getErrorContent();

    return (
        <div className="space-y-4">
            {errorContent && (
                <div className="flex items-start gap-3 text-destructive font-medium p-3 bg-destructive/10 rounded-md">
                    <errorContent.icon className="h-5 w-5 mt-0.5 shrink-0" />
                    <div>
                        <p>{errorContent.title}</p>
                        <p className="text-xs font-normal text-destructive/80">{errorContent.description}</p>
                    </div>
                </div>
            )}
            <div className="space-y-2">
                <Label htmlFor="license-key">Kode Lisensi</Label>
                <Input id="license-key" placeholder="Tempel kode lisensi di sini" value={licenseKey} onChange={(e) => setLicenseKey(e.target.value)} disabled={isLoading} />
            </div>
            <Button className="w-full" onClick={handleActivate} disabled={isLoading}>
                {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Mengaktifkan...</> : 'Aktivasi'}
            </Button>
        </div>
    )
}
