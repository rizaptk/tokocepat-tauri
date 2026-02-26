
"use client";

import { useState, useEffect } from 'react';
import { readSecureEnclave, generateDeviceFingerprint, writeSecureEnclave } from '@/lib/security';
import { decodeJwt } from 'jose';

export type LicenseStatus = 
    | 'VALID'       // Everything is OK
    | 'EXPIRES_SOON' // Nearing expiry date
    | 'INVALID'     // Token is malformed or signature is bad
    | 'EXPIRED'     // Token has expired
    | 'NOT_FOUND'   // No license token found locally
    | 'LOADING'     // Initial state
    | 'TAMPERED'    // Clock has been moved backwards
    | 'CLONED';     // Device ID does not match the one in the token

const EXPIRY_WARNING_DAYS = 7;

const sendHeartbeat = async (token: string) => {
    try {
        await fetch('/api/heartbeat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
        });
    } catch (error) {
        // This is a background task, so we don't need to bother the user if it fails.
        console.warn("Heartbeat failed. This can happen when offline.", error);
    }
};

export function useLicense() {
    const [status, setStatus] = useState<LicenseStatus>('LOADING');
    const [licenseDetails, setLicenseDetails] = useState<any>(null);

    useEffect(() => {
        const checkLicense = async () => {
            const enclave = await readSecureEnclave();

            if (!enclave || !enclave.licenseKey) {
                setStatus('NOT_FOUND');
                return;
            }

            let payload;
            try {
                payload = decodeJwt(enclave.licenseKey);
            } catch (e) {
                 console.error("Failed to decode JWT:", e);
                 setStatus('INVALID');
                 return;
            }
            
            if (!payload) {
                setStatus('INVALID');
                return;
            }
            
            const currentTime = new Date();
            const lastKnownTime = new Date(enclave.lastKnownTime);
            if (currentTime < lastKnownTime) {
                setStatus('TAMPERED');
                return;
            }

            const expiryDate = payload.exp ? new Date(payload.exp * 1000) : null;

            if (expiryDate && currentTime > expiryDate) {
                setStatus('EXPIRED');
                setLicenseDetails({
                    ...payload,
                    expiresAt: expiryDate.toISOString()
                });
                return;
            }

            const currentDeviceId = await generateDeviceFingerprint();
            if (currentDeviceId !== payload.deviceId) {
                setStatus('CLONED');
                return;
            }

            // If we are online, send a heartbeat
            if (navigator.onLine) {
                sendHeartbeat(enclave.licenseKey);
            }

            if (expiryDate) {
                const daysRemaining = Math.ceil((expiryDate.getTime() - currentTime.getTime()) / (1000 * 60 * 60 * 24));
                if (daysRemaining <= EXPIRY_WARNING_DAYS) {
                    setStatus('EXPIRES_SOON');
                    setLicenseDetails({
                        ...payload,
                        expiresAt: expiryDate.toISOString(),
                        daysRemaining,
                    });
                     await writeSecureEnclave({ ...enclave, lastKnownTime: currentTime.toISOString() });
                    return;
                }
            }
            
            setStatus('VALID');
            setLicenseDetails({
                ...payload,
                expiresAt: expiryDate ? expiryDate.toISOString() : 'Never'
            });

            if (payload.isTrial) {
                localStorage.setItem('tokoc_trial_activated_on_device', 'true');
            }

            await writeSecureEnclave({ ...enclave, lastKnownTime: currentTime.toISOString() });
        };

        checkLicense();
    }, []);

    const deactivate = async (): Promise<void> => {
        const enclave = await readSecureEnclave();
        if (!enclave) {
            throw new Error("No active license found on this device to deactivate.");
        }

        const response = await fetch('/api/license/deactivate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: enclave.licenseKey }),
        });
        
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || "Deactivation failed.");
        }
        
        localStorage.removeItem('tokoc_secure_enclave');
    };

    return { status, licenseDetails, deactivate };
}
