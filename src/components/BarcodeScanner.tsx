"use client";

import { useState } from 'react';
import { BarcodeScanner as Scanner } from 'react-zxing';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Camera } from 'lucide-react';

interface BarcodeScannerProps {
    onScanSuccess: (result: string) => void;
}

export function BarcodeScanner({ onScanSuccess }: BarcodeScannerProps) {
    const { toast } = useToast();
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);

    const handleScan = (result: any) => {
        if (result) {
            onScanSuccess(result.getText());
        }
    };

    const handleError = (error: any) => {
        // The 'NotAllowedError' is the one we most care about for permissions.
        if (error.name === 'NotAllowedError') {
            setHasPermission(false);
        } else {
            // For other errors, we can show a generic toast.
            console.error(error);
            toast({
                variant: 'destructive',
                title: 'Scanner Error',
                description: error.message || 'An unknown error occurred with the camera.',
            });
        }
    };

    return (
        <div className="flex flex-col items-center justify-center gap-4 py-4">
            {hasPermission === false ? (
                 <Alert variant="destructive">
                    <Camera className="h-4 w-4" />
                    <AlertTitle>Camera Access Denied</AlertTitle>
                    <AlertDescription>
                        Please grant camera permissions in your browser settings to use the scanner.
                    </AlertDescription>
                </Alert>
            ) : (
                <div className="relative w-full max-w-sm aspect-square bg-muted rounded-lg overflow-hidden">
                    <Scanner
                        onResult={handleScan}
                        onError={handleError}
                        constraints={{
                            video: {
                                facingMode: 'environment'
                            }
                        }}
                    />
                    <div className="absolute inset-0 border-4 border-primary/50 rounded-lg pointer-events-none" />
                </div>
            )}
             <p className="text-sm text-muted-foreground">Point the camera at a barcode</p>
        </div>
    );
}
