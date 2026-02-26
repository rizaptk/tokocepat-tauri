
"use client";

// This file contains placeholder logic for client-side security.
// In a real application, this would be more complex and involve
// server-side validation and robust cryptographic libraries.

const ENCLAVE_KEY = 'tokoc_secure_enclave';
const PEPPER = 'a_very_secret_pepper_string_for_hmac'; // In a real app, this would be obfuscated or handled differently.

export type EnclaveData = {
    licenseKey: string; // The signed JWT from the server
    lastKnownTime: string; // ISO string
};

export type Enclave = {
    data: EnclaveData;
    signature: string; // HMAC of data string
};

// --- Device Fingerprinting ---

/**
 * Generates a stable device fingerprint using various browser APIs.
 */
export async function generateDeviceFingerprint(): Promise<string> {
    if (typeof window === 'undefined') return 'server-side-fingerprint';

    const getPlugins = () => {
        if (!navigator.plugins) return [];
        const plugins = [];
        for (let i = 0; i < navigator.plugins.length; i++) {
            const plugin = navigator.plugins[i];
            if (plugin) {
               plugins.push(plugin.name);
            }
        }
        return plugins.sort();
    };

    const components = {
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        colorDepth: window.screen.colorDepth,
        timezone: new Date().getTimezoneOffset(),
        deviceMemory: (navigator as any).deviceMemory || -1,
        hardwareConcurrency: navigator.hardwareConcurrency || -1,
        devicePixelRatio: window.devicePixelRatio || -1,
        plugins: getPlugins(),
    };
    
    const json = JSON.stringify(components);
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(json));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}


// --- Secure Enclave for storing license data ---

async function getHmacKey(pepper: string): Promise<CryptoKey> {
    return crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(pepper),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign', 'verify']
    );
}

/**
 * Signs a string of data with an HMAC signature.
 */
async function signData(data: string): Promise<string> {
    const key = await getHmacKey(PEPPER);
    const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
    return btoa(String.fromCharCode(...new Uint8Array(signature))); // Base64 encode
}

/**
 * Writes the license data and its signature to localStorage.
 */
export async function writeSecureEnclave(data: EnclaveData): Promise<void> {
    if (typeof window === 'undefined') return;

    const dataString = JSON.stringify(data);
    const signature = await signData(dataString);
    const enclave: Enclave = {
        data,
        signature
    };
    localStorage.setItem(ENCLAVE_KEY, JSON.stringify(enclave));
}

/**
 * Reads and verifies the license data from localStorage.
 * Returns the data only if the signature is valid.
 */
export async function readSecureEnclave(): Promise<EnclaveData | null> {
     if (typeof window === 'undefined') return null;

    const enclaveString = localStorage.getItem(ENCLAVE_KEY);
    if (!enclaveString) return null;

    try {
        const enclave: Enclave = JSON.parse(enclaveString);
        const dataString = JSON.stringify(enclave.data);
        
        const key = await getHmacKey(PEPPER);
        const sigBytes = Uint8Array.from(atob(enclave.signature), c => c.charCodeAt(0));
        const isValid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(dataString));

        if (!isValid) {
            console.error("Secure enclave signature is invalid! Tampering detected.");
            // In a real app, you might want to delete the invalid enclave or phone home.
            // localStorage.removeItem(ENCLAVE_KEY);
            return null;
        }

        return enclave.data;

    } catch (e) {
        console.error("Failed to read or verify secure enclave:", e);
        return null;
    }
}
