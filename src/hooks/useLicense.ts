import { useState, useEffect} from 'react';
import { useDbStore } from '@/lib/db-store';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export type LicenseStatus = 
    | 'VALID'       // Everything is OK
    | 'EXPIRES_SOON' // Nearing expiry date
    | 'INVALID'     // Token is malformed or signature is bad
    | 'EXPIRED'     // Token has expired
    | 'NOT_FOUND'   // No license token found locally
    | 'LOADING'     // Initial state
    | 'TAMPERED'    // Clock has been moved backwards
    | 'CLONED'      // Device ID does not match the one in the token
    | 'TRIAL_PENDING'; // Eligible device, trial not yet applied (awaiting terms acceptance)

export function useLicense() {
    const { isInitialized } = useDbStore();
    const [status, setStatus] = useState<LicenseStatus>('LOADING');
    const [licenseDetails, setLicenseDetails] = useState<any>(null);

    useEffect(() => {
        if (!isInitialized) return;

        const performCheck = async () => {
            try {
                // Call Rust to do the heavy lifting
                const [newStatus, details] = await invoke<[LicenseStatus, any]>('check_license');
                setStatus(newStatus);
                setLicenseDetails(details);
            } catch (err) {
                setStatus('INVALID');
            }
        };

        performCheck();

        // Listen for heartbeat "activation_required" events from Rust
        const unlisten = listen('license-reverify', (event) => {
            const ticketId = event.payload;
            window.location.href = `/aktivasi?ticket=${ticketId}`;
        });

        // Remote revocation: the server asked to kill this license. Clear local
        // state so the app falls back to the trial/activation screen.
        const unlistenRevoked = listen('license-revoked', () => {
            setStatus('NOT_FOUND');
            setLicenseDetails(null);
            window.location.reload();
        });

        return () => {
            unlisten.then(f => f());
            unlistenRevoked.then(f => f());
        };
    }, [isInitialized]);

    // useLicense.ts snippet
    const deactivate = async (): Promise<void> => {
        try {
            await invoke('deactivate_license');
            setStatus('NOT_FOUND');
            setLicenseDetails(null);
        } catch (error: any) {
            throw new Error(error); // This will be caught by LicenseManager
        }
    };

    return { status, licenseDetails, deactivate };
}
