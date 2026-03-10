
"use client";

import { useState, useEffect, useCallback } from 'react';
import { generateDeviceFingerprint } from '@/lib/security';
import { getLicenseData, saveLicenseData, deleteLicenseData } from '@/services/dataService';
import { decodeJwt } from 'jose';
import { useToast } from './use-toast';
import { useDbStore } from '@/lib/db-store';
import { apiFetch } from '@/lib/api-client';
import { appStorage } from '@/lib/tauristorage';

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
    const { isInitialized } = useDbStore();
    const [status, setStatus] = useState<LicenseStatus>('LOADING');
    const [licenseDetails, setLicenseDetails] = useState<any>(null);

    const sendHeartbeat = useCallback(async () => {
        if (!navigator.onLine) {
            return;
        }

        try {
            const licenseData = await getLicenseData();
            const currentDeviceId = await generateDeviceFingerprint();

            const body = {
                token: licenseData?.jwt,
                deviceId: currentDeviceId
            };

            const response = await apiFetch('/api/heartbeat', {
                method: 'POST',
                body: JSON.stringify(body),
            });
            const data = await response.json();
            
            if (data.status === 'activation_required' && data.ticketId) {
                const currentPath = window.location.pathname;
                if (!currentPath.startsWith('/aktivasi')) {
                    window.location.href = `/aktivasi?ticket=${data.ticketId}`;
                }
            }

        } catch (error) {
            console.warn("[useLicense/sendHeartbeat] Heartbeat failed. This is expected when offline.", error);
        }
    }, []);

    useEffect(() => {
        if (!isInitialized) return;

        const checkLicense = async () => {
            const licenseData = await getLicenseData();
            
            if (!licenseData || !licenseData.jwt) {
                 await sendHeartbeat();
            }
            
            const currentDeviceId = await generateDeviceFingerprint();

            if (!licenseData || !licenseData.jwt || !licenseData.deviceId) {
                setStatus('NOT_FOUND');
                return;
            }
            
            if (currentDeviceId !== licenseData.deviceId) {
                setStatus('CLONED');
                return;
            }

            let payload;
            try {
                payload = decodeJwt(licenseData.jwt);
            } catch (e) {
                 console.error("[useLicense/checkLicense] Failed to decode JWT:", e);
                 setStatus('INVALID');
                 return;
            }
            
            if (!payload) {
                setStatus('INVALID');
                return;
            }
            
            const currentTime = new Date();
            const lastKnownTime = new Date(licenseData.lastKnownTime);
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
                appStorage.setItem('tokoc_trial_activated_on_device', 'true');
            }

            await saveLicenseData(licenseData.jwt, currentDeviceId);
        };

        checkLicense();
    }, [isInitialized, sendHeartbeat, toast]);

    // wait for fix

    useEffect(() => {
        if (!isInitialized) return;
        const intervalId = setInterval(() => {
            sendHeartbeat();
        }, HEARTBEAT_INTERVAL_MS);

        return () => clearInterval(intervalId);
    }, [isInitialized, sendHeartbeat]);

    const deactivate = async (): Promise<void> => {
        const licenseData = await getLicenseData();
        if (!licenseData) {
            throw new Error("No active license found on this device to deactivate.");
        }

        const response = await apiFetch('/api/license/deactivate', {
            method: 'POST',
            body: JSON.stringify({ token: licenseData.jwt }),
        });
        
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || "Deactivation failed.");
        }
        
        await deleteLicenseData();
    };

    return { status, licenseDetails, deactivate };
}
