

"use client";

import { useState, useEffect, useCallback } from 'react';
import { generateDeviceFingerprint } from '@/lib/security';
import { getLicenseData, saveLicenseData, deleteLicenseData } from '@/services/dataService';
import { decodeJwt } from 'jose';
import { useToast } from './use-toast';
import { useDbStore } from '@/lib/db-store';

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
            console.log('[useLicense/sendHeartbeat] Skipping heartbeat, user is offline.');
            return;
        }

        try {
            const licenseData = await getLicenseData();
            const currentDeviceId = await generateDeviceFingerprint();

            const body = {
                token: licenseData?.jwt,
                deviceId: currentDeviceId
            };
            console.log('[useLicense/sendHeartbeat] Sending heartbeat with body:', { ...body, token: body.token ? 'JWT_PRESENT' : null });


            const response = await fetch('/api/heartbeat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await response.json();
            console.log('[useLicense/sendHeartbeat] Received response from server:', data);
            
            if (data.status === 'activation_required' && data.ticketId) {
                console.log(`[useLicense/sendHeartbeat] Server indicated activation is required for ticket ${data.ticketId}. Redirecting...`);
                window.location.href = `/aktivasi?ticket=${data.ticketId}`;
            }

        } catch (error) {
            console.warn("[useLicense/sendHeartbeat] Heartbeat failed. This is expected when offline.", error);
        }
    }, []);

    useEffect(() => {
        if (!isInitialized) return;

        const checkLicense = async () => {
            console.log('[useLicense/checkLicense] Starting license check...');
            
            const licenseData = await getLicenseData();
            
            // If there's no local license, send a heartbeat immediately to check for pending activations.
            // This is the primary trigger for a new user.
            if (!licenseData || !licenseData.jwt) {
                 await sendHeartbeat();
            }
            
            const currentDeviceId = await generateDeviceFingerprint();

            console.log('[useLicense/checkLicense] Local license data found:', licenseData ? { ...licenseData, jwt: 'JWT_PRESENT' } : null);
            console.log('[useLicense/checkLicense] Current Device ID:', `${currentDeviceId.substring(0, 10)}...`);

            if (!licenseData || !licenseData.jwt || !licenseData.deviceId) {
                console.log('[useLicense/checkLicense] Determined Status: NOT_FOUND');
                setStatus('NOT_FOUND');
                return;
            }
            
            if (currentDeviceId !== licenseData.deviceId) {
                 console.log('[useLicense/checkLicense] Determined Status: CLONED (Device ID mismatch)');
                setStatus('CLONED');
                return;
            }

            let payload;
            try {
                payload = decodeJwt(licenseData.jwt);
                 console.log('[useLicense/checkLicense] JWT Decoded Payload:', payload);
            } catch (e) {
                 console.error("[useLicense/checkLicense] Failed to decode JWT:", e);
                 console.log('[useLicense/checkLicense] Determined Status: INVALID');
                 setStatus('INVALID');
                 return;
            }
            
            if (!payload) {
                console.log('[useLicense/checkLicense] Determined Status: INVALID (Payload is null)');
                setStatus('INVALID');
                return;
            }
            
            const currentTime = new Date();
            const lastKnownTime = new Date(licenseData.lastKnownTime);
            if (currentTime < lastKnownTime) {
                console.log('[useLicense/checkLicense] Determined Status: TAMPERED (Clock moved backwards)');
                setStatus('TAMPERED');
                return;
            }

            const expiryDate = payload.exp ? new Date(payload.exp * 1000) : null;

            if (expiryDate && currentTime > expiryDate) {
                 console.log('[useLicense/checkLicense] Determined Status: EXPIRED');
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
            
            console.log(`[useLicense/checkLicense] Determined Final Status: ${finalStatus}`, details);
            setStatus(finalStatus);
            setLicenseDetails(details);
            
            if (payload.isTrial) {
                localStorage.setItem('tokoc_trial_activated_on_device', 'true');
            }

            // Save updated lastKnownTime to DB
            console.log('[useLicense/checkLicense] Updating lastKnownTime in local DB.');
            await saveLicenseData(licenseData.jwt, currentDeviceId);
        };

        checkLicense();
    }, [isInitialized, sendHeartbeat, toast]);

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

        const response = await fetch('/api/license/deactivate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
