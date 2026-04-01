import { useLicense } from '@/hooks/useLicense';
import { TokoCepatLogo } from "./TokoCepatLogo";
import { ShieldOff } from "lucide-react";
import { Button } from "./ui/button";

const statusMessages: Record<string, string> = {
    INVALID: "Data lisensi tidak valid. Silakan aktivasi ulang.",
    EXPIRED: "Masa lisensi habis. Silakan perbarui langganan.",
    NOT_FOUND: "Aktivasi lisensi diperlukan untuk melanjutkan.",
    TAMPERED: "Manipulasi waktu terdeteksi. Perbaiki jam perangkat Anda.",
    CLONED: "Lisensi ini sudah terdaftar di perangkat lain."
};

export function LicenseProvider({ children }: { children: React.ReactNode }) {
    const { status } = useLicense();

    if (status === 'LOADING') {
         return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                    <TokoCepatLogo />
                    <p className="text-muted-foreground">Memverifikasi Lisensi...</p>
                    <div className="w-48 h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary animate-pulse w-full"></div>
                    </div>
                </div>
            </div>
        )
    }

    const isLicensed = status === 'VALID' || status === 'EXPIRES_SOON';
    
    const isAllowedUnlicensedPage = typeof window !== 'undefined' && 
        (window.location.pathname.startsWith('/dashboard/settings') || 
        window.location.pathname.startsWith('/aktivasi') || 
        window.location.pathname.startsWith('/report') ||
        window.location.pathname.startsWith('/license') 
    );

    if (!isLicensed && !isAllowedUnlicensedPage) {
        const message = statusMessages[status] || "Terjadi kesalahan lisensi tidak dikenal.";
        return (
             <div className="flex h-screen w-full items-center justify-center bg-muted/40 p-4">
                 <div className="w-full max-w-md text-center bg-card p-8 rounded-lg shadow-lg">
                    <ShieldOff className="mx-auto h-16 w-16 text-destructive mb-4" />
                    <h1 className="text-2xl font-bold">Lisensi Diperlukan</h1>
                    <p className="text-muted-foreground mt-2 mb-6">
                       {message}
                    </p>
                    <Button onClick={() => window.location.href = '/dashboard/settings'}>Buka Pengaturan</Button>
                </div>
             </div>
        );
    }
    
    return <>{children}</>;
}
