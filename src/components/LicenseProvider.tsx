import { useLicense } from '@/hooks/useLicense';
import { TokoCepatLogo } from "./TokoCepatLogo";
import { ShieldOff } from "lucide-react";
import { Button } from "./ui/button";
import { useEffect, useMemo, useState } from 'react';
import { initializeSyncService } from '@/services/syncService';
import { useSyncStore } from '@/lib/sync-store';
import { invoke } from '@tauri-apps/api/core';
import { useDbStore } from '@/lib/db-store';

const statusMessages: Record<string, string> = {
    INVALID: "Data lisensi tidak valid. Silakan aktivasi ulang.",
    EXPIRED: "Masa lisensi habis. Silakan perbarui langganan.",
    NOT_FOUND: "Aktivasi lisensi diperlukan untuk melanjutkan.",
    TAMPERED: "Manipulasi waktu terdeteksi. Perbaiki jam perangkat Anda.",
    CLONED: "Lisensi ini sudah terdaftar di perangkat lain."
};

export function LicenseProvider({ children }: { children: React.ReactNode }) {
    const { status, licenseDetails } = useLicense();
    const [isLoad, setIsload] = useState(false);
    const [statusChecked, setStatusChecked] = useState(false);
    const syncStore = useSyncStore();
    const { db, firesqlite } = useDbStore();

    useEffect(() => {
        setIsload(true);
        return () => setIsload(false);
    },[])

    const isLicensed = useMemo(() => status === 'VALID' || status === 'EXPIRES_SOON', [status]);
    const canSync = useMemo(() => isLicensed && licenseDetails?.isSyncAvailable === true, [isLicensed, licenseDetails]);
    
    useEffect(() => {
        if (!canSync) {
            return;
        }
        invoke('get_sync_status').then((st: any) => {
            syncStore.setIsNetworkEnable(st?.status == 'connected');
            setStatusChecked(true);
        });
        return () => setStatusChecked(false);
    },[isLoad, canSync])

        // 1. Setup global event listeners once
    useEffect(() => {
        const sub = initializeSyncService();
        return () => { sub.then(cleanup => cleanup()); };
    }, []);

    useEffect(() => {
        if (status === 'LOADING' || !statusChecked || !db || !firesqlite) return;

        const {doc, getDoc} = firesqlite;

        const geSync = async () => {
            const sync = await getDoc(doc(db, 'app_state/sync_prefs'));
            return sync.data();
        }

        // SCENARIO A: License is lost or doesn't support sync, but sync is running
        if (!canSync && syncStore.isNetworkEnable) {
            syncStore.toggleSync(false); // Shuts down Rust syncer
            return;
        }

        // SCENARIO B: License is valid, user enabled it, but it's not running yet
        if (canSync && !syncStore.isNetworkEnable && syncStore.isSyncEnabled) {
            geSync().then((data: any) => {
                if (data as boolean) {
                    syncStore.toggleSync(true);
                }
            })
        }

    }, [canSync, syncStore.isNetworkEnable, syncStore.isSyncEnabled, status, statusChecked, db, firesqlite]);

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
