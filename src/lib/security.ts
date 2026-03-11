
"use client";

import { appStorage } from "./tauristorage";

const FINGERPRINT_KEY = 'tokoc_device_fingerprint';

/**
 * Generates a stable device fingerprint.
 * It first checks Storage for a saved fingerprint. If not found, it calculates
 * a new one based on stable hardware/browser properties (including canvas fingerprinting),
 * saves it to Storage, and then returns it.
 */
export async function generateDeviceFingerprint(): Promise<string> {

    if (typeof window === 'undefined') return 'server-side-fingerprint';

    // 1. Check for a stored fingerprint first.
    const storedFingerprint = appStorage.getItem(FINGERPRINT_KEY);
    if (storedFingerprint) {
        return storedFingerprint;
    }

    // 2. If not found, calculate it using Canvas and other stable properties.
    const getCanvasFingerprint = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return '';
        // Draw a complex shape with colors and fonts
        ctx.textBaseline = "top";
        ctx.font = "14px 'Arial'";
        ctx.textBaseline = "alphabetic";
        ctx.fillStyle = "#f60";
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = "#069";
        ctx.fillText("TokoCepat-POS-Fingerprint", 2, 15);
        ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
        ctx.fillText("TokoCepat-POS-Fingerprint", 4, 17);
        return canvas.toDataURL();
    };

    const components = {
        // Hardware & Engine
        platform: navigator.platform,
        hardwareConcurrency: navigator.hardwareConcurrency || -1,
        deviceMemory: (navigator as any).deviceMemory || -1,
        
        // Locale & Settings (Stable)
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: navigator.language,
        
        // Graphics (The "secret sauce")
        canvas: getCanvasFingerprint(),
    };
    
    const json = JSON.stringify(components);
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(json));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const newFingerprint = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // 3. Store the newly calculated fingerprint for future use.
    appStorage.setItem(FINGERPRINT_KEY, newFingerprint);
    
    return newFingerprint;
}
