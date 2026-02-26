"use client";

import { useState, useEffect, useCallback } from 'react';
import { readSecureEnclave, generateDeviceFingerprint, writeSecureEnclave } from '@/lib/security';
import { decodeJwt } from 'jose';
import { useToast } from './use-toast';

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
const HEARTBEAT_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes

export function useLicense() {
    const { toast } = useToast();
    const [status, setStatus] = useState<LicenseStatus>('LOADING');
    const [licenseDetails, setLicenseDetails] = useState<any>(null);

    const sendHeartbeat = useCallback(async () => {
        if (!navigator.onLine) {
            return;
        }

        try {
            const enclave = await readSecureEnclave();
            const currentDeviceId = await generateDeviceFingerprint();

            const response = await fetch('/api/heartbeat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token: enclave?.licenseKey,
                    deviceId: currentDeviceId
                }),
            });
            const data = await response.json();
            
            if (data.token) {
                await writeSecureEnclave({ licenseKey: data.token, lastKnownTime: new Date().toISOString() });
                toast({ title: "License Activated!", description: "Your new license is active. The app will now reload." });
                setTimeout(() => window.location.reload(), 1500);
            }
        } catch (error) {
            console.warn("Heartbeat failed. This can happen when offline.", error);
        }
    }, [toast]);

    useEffect(() => {
        const checkLicense = async () => {
            // First, send an immediate heartbeat on load
            await sendHeartbeat();
            
            const enclave = await readSecureEnclave();
            const currentDeviceId = await generateDeviceFingerprint();

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

            if (currentDeviceId !== payload.deviceId) {
                setStatus('CLONED');
                return;
            }
            
            let finalStatus: LicenseStatus = 'VALID';
            const details: any = {
                ...payload,
                expiresAt: expiryDate ? expiryDate.toISOString() : 'Never'
            };

            if (expiryDate) {
                const daysRemaining = Math.ceil((expiryDate.getTime() - currentTime.getTime()) / (1000 * 60 * 60 * 24));
                if (daysRemaining <= EXPIRY_WARNING_DAYS) {
                    finalStatus = 'EXPIRES_SOON';
                    details.daysRemaining = daysRemaining;
                }
            }
            
            setStatus(finalStatus);
            setLicenseDetails(details);
            
            if (payload.isTrial) {
                localStorage.setItem('tokoc_trial_activated_on_device', 'true');
            }

            await writeSecureEnclave({ ...enclave, lastKnownTime: currentTime.toISOString() });
        };

        checkLicense();
    }, [sendHeartbeat, toast]);

    useEffect(() => {
        const intervalId = setInterval(() => {
            sendHeartbeat();
        }, HEARTBEAT_INTERVAL_MS);

        return () => clearInterval(intervalId);
    }, [sendHeartbeat]);

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
