
"use client";

import { useState, useEffect } from 'react';
import { readSecureEnclave, generateDeviceFingerprint, writeSecureEnclave } from '@/lib/security';

export type LicenseStatus = 
    | 'VALID'       // Everything is OK
    | 'INVALID'     // Token is malformed or signature is bad
    | 'EXPIRED'     // Token has expired
    | 'NOT_FOUND'   // No license token found locally
    | 'LOADING'     // Initial state
    | 'TAMPERED'    // Clock has been moved backwards
    | 'CLONED';     // Device ID does not match the one in the token


// A basic, library-free JWT payload decoder.
function decodeJwtPayload(token: string): any | null {
    try {
        const base64Url = token.split('.')[1];
        if (!base64Url) return null;
        
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error("Failed to decode JWT payload:", e);
        return null;
    }
}

export function useLicense() {
    const [status, setStatus] = useState<LicenseStatus>('LOADING');
    const [licenseDetails, setLicenseDetails] = useState<any>(null);

    useEffect(() => {
        const checkLicense = async () => {
            const enclave = await readSecureEnclave();

            // 1. Check if license exists locally. `readSecureEnclave` already verifies HMAC signature.
            // If it returns null, it means no enclave or it was tampered with.
            if (!enclave || !enclave.licenseKey) {
                setStatus('NOT_FOUND');
                return;
            }

            // In a real implementation, we would also verify the JWT's own signature here with a public key.
            // For now, we trust the HMAC-verified enclave contains a valid JWT from the server.
            
            const payload = decodeJwtPayload(enclave.licenseKey);
            if (!payload) {
                setStatus('INVALID'); // Malformed token
                return;
            }
            
            // 2. Check for clock tampering
            const currentTime = new Date();
            const lastKnownTime = new Date(enclave.lastKnownTime);
            if (currentTime < lastKnownTime) {
                setStatus('TAMPERED'); // Clock moved backwards
                return;
            }

            // 3. Check for expiration
            if (payload.exp && currentTime.getTime() / 1000 > payload.exp) {
                setStatus('EXPIRED');
                setLicenseDetails({
                    ...payload,
                    expiresAt: payload.exp ? new Date(payload.exp * 1000).toISOString() : 'Never'
                });
                return;
            }

            // 4. Check for device clone
            const currentDeviceId = await generateDeviceFingerprint();
            if (currentDeviceId !== payload.deviceId) {
                setStatus('CLONED'); // License is for a different device
                return;
            }

            // 5. All checks passed. License is valid.
            setStatus('VALID');
            setLicenseDetails({
                ...payload,
                expiresAt: payload.exp ? new Date(payload.exp * 1000).toISOString() : 'Never'
            });

            // Update the last known time to prevent clock tampering.
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
        
        // Clear local license by writing an empty enclave.
        localStorage.removeItem('tokoc_secure_enclave');
    };

    return { status, licenseDetails, deactivate };
}
