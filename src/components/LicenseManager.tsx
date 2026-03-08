

import { useLicense } from '@/hooks/useLicense';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Skeleton } from './ui/skeleton';
import { Badge } from './ui/badge';
import { CheckCircle, XCircle, Clock, ShieldOff, Loader2, AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { generateDeviceFingerprint } from '@/lib/security';
import { saveLicenseData } from '@/services/dataService';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

export function LicenseManager() {
    const { status, licenseDetails, deactivate } = useLicense();
    const [licenseKey, setLicenseKey] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    const handleActivate = async () => {
        if (!licenseKey.trim()) {
            toast({ variant: 'destructive', title: 'License key cannot be empty.' });
            return;
        }
        setIsLoading(true);

        try {
            const deviceId = await generateDeviceFingerprint();
            const response = await fetch('/api/license/activate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ licenseKey, deviceId }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'An unknown error occurred during activation.');
            }
            
            await saveLicenseData(data.token, deviceId);

            toast({ title: 'Activation Successful!', description: 'The application will now reload.' });

            setTimeout(() => window.location.reload(), 1500);

        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Activation Failed', description: error.message });
            setIsLoading(false);
        }
    };

    const handleDeactivate = async () => {
        setIsLoading(true);
        try {
            await deactivate(); // Call deactivate from the hook
            toast({ title: 'Deactivation Successful!', description: 'This device is no longer licensed. The app will reload.'});
            setTimeout(() => window.location.reload(), 1500);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Deactivation Failed', description: error.message });
        } finally {
            setIsLoading(false);
        }
    };

    if (status === 'LOADING') {
        return (
             <div className="space-y-4">
                  <Skeleton className="h-8 w-1/4" />
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-10 w-full" />
              </div>
        )
    }

    if (status === 'VALID' || status === 'EXPIRES_SOON') {
        return (
             <div className="space-y-4">
                  {status === 'EXPIRES_SOON' && licenseDetails?.daysRemaining != null && (
                    <Alert variant="destructive" className="bg-orange-50 border-orange-200 text-orange-800 dark:bg-orange-950/30 dark:border-orange-800 dark:text-orange-300 [&>svg]:text-orange-600">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>License Expiring Soon</AlertTitle>
                        <AlertDescription>
                            Your license will expire in {licenseDetails.daysRemaining} day(s). Please renew your subscription to avoid service interruption.
                        </AlertDescription>
                    </Alert>
                  )}
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <p className="font-semibold text-green-600">License Active</p>
                  </div>
                  <div className="text-sm space-y-1">
                    <p>Plan: <Badge variant="secondary">{licenseDetails.plan}</Badge></p>
                    <p>Expires: <span className="font-medium">{licenseDetails.expiresAt === 'Never' ? 'Never' : new Date(licenseDetails.expiresAt).toLocaleDateString()}</span></p>
                    <p className="text-xs text-muted-foreground pt-1 break-all">Device ID: {licenseDetails.deviceId}</p>
                  </div>
                  <Button variant="outline" className="w-full" onClick={handleDeactivate} disabled={isLoading}>
                    {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Deactivating...</> : 'Deactivate This Device'}
                  </Button>
              </div>
        )
    }

    // Default to activation form for NOT_FOUND, EXPIRED, INVALID, etc.
    const getErrorContent = () => {
        switch (status) {
            case 'INVALID':
                return { icon: XCircle, title: "License Invalid", description: "Your license data appears to be corrupt. Please try reactivating." };
            case 'EXPIRED':
                return { icon: Clock, title: "License Expired", description: "Please renew your license to continue using the application." };
            case 'TAMPERED':
                return { icon: ShieldOff, title: "Clock Tampering Detected", description: "Your system clock has been moved backwards. Please set it to the correct time." };
            case 'CLONED':
                return { icon: ShieldOff, title: "Device Mismatch", description: "This license is registered to a different device. Please deactivate it there before activating here." };
            default:
                return null;
        }
    }
    const errorContent = getErrorContent();

    return (
        <div className="space-y-4">
            {errorContent && (
                <div className="flex items-start gap-3 text-destructive font-medium p-3 bg-destructive/10 rounded-md">
                    <errorContent.icon className="h-5 w-5 mt-0.5 shrink-0" />
                    <div>
                        <p>{errorContent.title}</p>
                        <p className="text-xs font-normal text-destructive/80">{errorContent.description}</p>
                    </div>
                </div>
            )}
            <div className="space-y-2">
                <Label htmlFor="license-key">License Key</Label>
                <Input id="license-key" placeholder="Paste your license key here" value={licenseKey} onChange={(e) => setLicenseKey(e.target.value)} disabled={isLoading} />
            </div>
            <Button className="w-full" onClick={handleActivate} disabled={isLoading}>
                {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Activating...</> : 'Activate'}
            </Button>
        </div>
    )
}
