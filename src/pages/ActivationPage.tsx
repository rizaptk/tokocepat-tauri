
import { Suspense, useState, useEffect, useTransition } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { generateDeviceFingerprint } from '@/lib/security';
// import { saveLicenseData } from '@/services/dataService';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, ShieldCheck, AlertTriangle } from 'lucide-react';
import { KastokoLogo } from '@/components/KastokoLogo';
// import { apiFetch } from '@/lib/api-client';
import { invoke } from '@tauri-apps/api/core';


function ActivationComponent() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const ticketId = searchParams.get('ticket');
    
    const [deviceId, setDeviceId] = useState<string | null>(null);
    const [isActivating, startActivation] = useTransition();
    const { toast } = useToast();

    useEffect(() => {
        generateDeviceFingerprint().then(setDeviceId);
    }, []);

    // const handleActivation = () => {
    //     if (!ticketId) {
    //          toast({ variant: 'destructive', title: 'Error', description: 'Activation ticket is missing.' });
    //          return;
    //     }
    //     if (!deviceId) {
    //         toast({ variant: 'destructive', title: 'Error', description: 'Could not identify this device.' });
    //         return;
    //     }
        
    //     startActivation(async () => {
    //          try {
    //             const response = await apiFetch('/api/license/claim', {
    //                 method: 'POST',
    //                 body: JSON.stringify({ ticketId, deviceId }),
    //             });

    //             const result = await response.json();

    //             if (!response.ok) {
    //                 throw new Error(result.error || 'An unknown error occurred.');
    //             }
                
    //             await saveLicenseData(result.token, deviceId);
    //             toast({ title: 'Activation Successful!', description: 'Your license is now active. Redirecting...' });
    //             setTimeout(() => {
    //                 window.location.href = '/dashboard';
    //             }, 1500);

    //         } catch (error: any) {
    //             toast({ variant: 'destructive', title: 'Activation Failed', description: error.message });
    //         }
    //     });
    // };
    
    const handleActivation = () => {
        if (!ticketId) return;
        
        startActivation(async () => {
            try {
                // Call Rust instead of apiFetch
                await invoke('claim_license', { ticketId });

                toast({ title: 'Activation Successful!' });
                setTimeout(() => {
                    window.location.href = '/dashboard';
                }, 1500);

            } catch (error: any) {
                toast({ variant: 'destructive', title: 'Activation Failed', description: error });
            }
        });
    };

    if (!ticketId) {
        return (
            <Card className="w-full max-w-lg">
                <CardHeader className="text-center">
                    <AlertTriangle className="h-10 w-10 text-destructive mx-auto mb-2" />
                    <CardTitle>Link Aktivasi Tidak Valid</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground text-center">Link aktivasi yang Anda gunakan salah atau tidak lengkap. Silakan kembali ke halaman pengaturan.</p>
                </CardContent>
                 <CardFooter>
                    <Button className="w-full" onClick={() => navigate('/dashboard/settings')}>Kembali</Button>
                </CardFooter>
            </Card>
        )
    }

    return (
        <Card className="w-full max-w-lg">
            <CardHeader>
                <div className="flex justify-center mb-4">
                     <KastokoLogo withSlogan />
                </div>
                <CardTitle className="text-center">Perjanjian Layanan Kastoko</CardTitle>
                <CardDescription className="text-center">
                    Harap baca dan setujui syarat dan ketentuan di bawah ini untuk mengaktifkan lisensi Anda.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-64 border rounded-md p-4 bg-muted/50 text-sm">
                    <h3 className="font-bold mb-2">1. PENGGUNAAN LISENSI</h3>
                    <p className="mb-4">Lisensi yang diberikan bersifat non-eksklusif dan tidak dapat dipindahtangankan. Lisensi ini hanya berlaku untuk jumlah perangkat yang telah ditentukan dalam paket langganan Anda. Dilarang keras menyalin, mendistribusikan, atau merekayasa balik perangkat lunak ini.</p>
                    
                    <h3 className="font-bold mb-2">2. KEAMANAN DATA</h3>
                    <p className="mb-4">Aplikasi ini beroperasi secara offline-first. Semua data transaksional Anda (penjualan, produk, shift) disimpan secara lokal di perangkat Anda dalam basis data terenkripsi. Kami tidak memiliki akses ke data operasional Anda. Anda bertanggung jawab penuh untuk melakukan pencadangan (backup) data secara berkala menggunakan fitur yang telah disediakan.</p>
                    
                    <h3 className="font-bold mb-2">3. PEMBARUAN & DUKUNGAN</h3>
                    <p className="mb-4">Selama lisensi Anda aktif, Anda berhak menerima pembaruan perangkat lunak dan perbaikan bug. Dukungan teknis disediakan sesuai dengan paket langganan yang Anda pilih.</p>
                    
                    <h3 className="font-bold mb-2">4. BATASAN TANGGUNG JAWAB</h3>
                    <p>Kami tidak bertanggung jawab atas kehilangan data yang disebabkan oleh kegagalan perangkat keras, kelalaian pengguna dalam melakukan backup, atau faktor eksternal lainnya. Kewajiban kami terbatas pada nilai lisensi yang telah Anda bayarkan.</p>
                </ScrollArea>
            </CardContent>
            <CardFooter>
                <Button className="w-full" size="lg" onClick={handleActivation} disabled={isActivating || !deviceId}>
                    {isActivating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                    Saya Setuju & Aktifkan Lisensi
                </Button>
            </CardFooter>
        </Card>
    );
}

export default function AktivasiPage() {
    return (
        <div className="flex min-h-screen w-full items-center justify-center bg-muted/40 p-4">
             <Suspense fallback={<Loader2 className="h-10 w-10 animate-spin" />}>
                <ActivationComponent />
            </Suspense>
        </div>
    )
}
