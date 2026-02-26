"use client";

import { useLicense } from "@/hooks/useLicense";
import { TokoCepatLogo } from "./TokoCepatLogo";
import { ShieldOff } from "lucide-react";
import { Button } from "./ui/button";

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

    // Only 'VALID' allows access. All other states will show the lock screen.
    // The settings page is always accessible regardless of license status.
    if (status !== 'VALID' && typeof window !== 'undefined' && !window.location.pathname.startsWith('/dashboard/settings')) {
        return (
             <div className="flex h-screen w-full items-center justify-center bg-muted/40 p-4">
                 <div className="w-full max-w-md text-center bg-card p-8 rounded-lg shadow-lg">
                    <ShieldOff className="mx-auto h-16 w-16 text-destructive mb-4" />
                    <h1 className="text-2xl font-bold">License Required</h1>
                    <p className="text-muted-foreground mt-2 mb-6">
                        Your license is {status.toLowerCase()} or could not be found. Please activate your license to continue.
                    </p>
                    <Button onClick={() => window.location.href = '/dashboard/settings'}>Go to Settings</Button>
                </div>
             </div>
        );
    }
    
    return <>{children}</>;
}
