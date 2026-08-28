import { useLicense } from '@/hooks/useLicense';
import { TokoCepatLogo } from "./TokoCepatLogo";
import { ShieldOff, Zap, CreditCard, KeyRound, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { useEffect, useMemo, useState } from 'react';
import { initializeSyncService } from '@/services/syncService';
import { useSyncStore } from '@/lib/sync-store';
import { invoke } from '@tauri-apps/api/core';
import { useDbStore } from '@/lib/db-store';
import { TrialConsent } from './TrialConsent';

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
    const [hasDeclinedTrial, setHasDeclinedTrial] = useState(() => {
        try { return localStorage.getItem('kastoko_declined_trial') === '1'; } catch { return false; }
    });
    const [isApplyingTrial, setIsApplyingTrial] = useState(false);
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

    // Eligible device that hasn't accepted terms: show TrialConsent unless user declined
    if (status === 'TRIAL_PENDING' && !hasDeclinedTrial && !isAllowedUnlicensedPage) {
        return <TrialConsent onDecline={() => {
            try { localStorage.setItem('kastoko_declined_trial', '1'); } catch {}
            setHasDeclinedTrial(true);
        }} />;
    }
    
    if (!isLicensed && !isAllowedUnlicensedPage) {
        const message = statusMessages[status] || "Terjadi kesalahan lisensi tidak dikenal.";
        const isNotFound = status === 'NOT_FOUND';
        const handleWelcomeTrial = async () => {
            if (isApplyingTrial) return;
            setIsApplyingTrial(true);
            try {
                await invoke('start_trial');
                try { localStorage.removeItem('kastoko_declined_trial'); } catch {}
                window.location.reload();
            } catch (e: any) {
                const msg = String(e ?? '');
                if (msg.toLowerCase().includes('already used')) {
                    window.location.href = '/license';
                } else {
                    // fallback: reload to show TrialConsent again
                    try { localStorage.removeItem('kastoko_declined_trial'); } catch {}
                    window.location.reload();
                }
            } finally {
                setIsApplyingTrial(false);
            }
        };
        const openPricing = () => invoke('open_pricing');
        return (
             <div className="flex h-screen w-full items-center justify-center bg-muted/40 p-4">
                 <div className="w-full max-w-md text-center bg-card p-8 rounded-lg shadow-lg">
                    <ShieldOff className="mx-auto h-16 w-16 text-destructive mb-4" />
                    <h1 className="text-2xl font-bold">Lisensi Diperlukan</h1>
                    <p className="text-muted-foreground mt-2 mb-6">
                       {message}
                    </p>
                    <div className="space-y-3">
                        <Button onClick={() => window.location.href = '/dashboard/settings'} className="w-full">Buka Pengaturan</Button>
                        {isNotFound && (
                            <>
                                <Button className="w-full h-11" onClick={handleWelcomeTrial} disabled={isApplyingTrial}>
                                    {isApplyingTrial ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
                                    {isApplyingTrial ? 'Menerapkan...' : 'Gunakan Masa Uji Coba (30 Hari)'}
                                </Button>
                                <Button variant="outline" className="w-full h-11" onClick={() => window.location.href = '/license'}>
                                    <KeyRound className="mr-2 h-4 w-4" /> Aktivasi dengan Kode Lisensi
                                </Button>
                                <Button variant="outline" className="w-full h-11" onClick={openPricing}>
                                    <CreditCard className="mr-2 h-4 w-4" /> Beli Lisensi
                                </Button>
                            </>
                        )}
                    </div>
                </div>
             </div>
        );
    }
    
    return <>{children}</>;
}
