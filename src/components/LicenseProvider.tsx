
"use client";

import { useLicense } from '@/hooks/useLicense';
import { TokoCepatLogo } from "./TokoCepatLogo";
import { ShieldOff } from "lucide-react";
import { Button } from "./ui/button";

const statusMessages: Record<string, string> = {
    INVALID: "Your license data is invalid. Please reactivate.",
    EXPIRED: "Your license has expired. Please renew your subscription.",
    NOT_FOUND: "Please activate your license to continue.",
    TAMPERED: "System clock tampering detected. Please correct your device time.",
    CLONED: "This license is registered to another device."
};

export function LicenseProvider({ children }: { children: React.ReactNode }) {
    const { status } = useLicense();

    if (status === 'LOADING') {
         return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                    <TokoCepatLogo />
                    <p className="text-muted-foreground">Verifying License...</p>
                    <div className="w-48 h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary animate-pulse w-full"></div>
                    </div>
                </div>
            </div>
        )
    }

    const isLicensed = status === 'VALID' || status === 'EXPIRES_SOON';
    
    const isAllowedUnlicensedPage = typeof window !== 'undefined' && 
        (window.location.pathname.startsWith('/dashboard/settings') || window.location.pathname.startsWith('/aktivasi') || window.location.pathname.startsWith('/report'));

    if (!isLicensed && !isAllowedUnlicensedPage) {
        const message = statusMessages[status] || "An unknown license error occurred.";
        return (
             <div className="flex h-screen w-full items-center justify-center bg-muted/40 p-4">
                 <div className="w-full max-w-md text-center bg-card p-8 rounded-lg shadow-lg">
                    <ShieldOff className="mx-auto h-16 w-16 text-destructive mb-4" />
                    <h1 className="text-2xl font-bold">License Required</h1>
                    <p className="text-muted-foreground mt-2 mb-6">
                       {message}
                    </p>
                    <Button onClick={() => window.location.href = '/dashboard/settings'}>Go to Settings</Button>
                </div>
             </div>
        );
    }
    
    return <>{children}</>;
}
