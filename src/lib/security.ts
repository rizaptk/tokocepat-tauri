
"use client";

// This file contains placeholder logic for client-side security.
// In a real application, this would be more complex and involve
// server-side validation and robust cryptographic libraries.

// --- Device Fingerprinting ---

/**
 * Generates a stable device fingerprint using various browser APIs.
 * This version uses Canvas fingerprinting for higher entropy and focuses on stable hardware/engine properties.
 */
export async function generateDeviceFingerprint(): Promise<string> {
    if (typeof window === 'undefined') return 'server-side-fingerprint';

    // 1. Canvas Fingerprinting (High Entropy)
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
        
        // We exclude UserAgent and ScreenSize because they change too often
    };
    
    const json = JSON.stringify(components);
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(json));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
