
"use client";

import { useLicense } from '@/hooks/useLicense';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Skeleton } from './ui/skeleton';
import { Badge } from './ui/badge';
import { CheckCircle, XCircle, Clock, ShieldOff } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

export function LicenseManager() {
    const { status, licenseDetails } = useLicense();
    const [licenseKey, setLicenseKey] = useState('');
    const { toast } = useToast();

    const handleActivate = async () => {
        if (!licenseKey.trim()) {
            toast({ variant: 'destructive', title: 'License key cannot be empty.' });
            return;
        }
        // Placeholder for API call
        toast({ title: 'Activating...', description: 'Please wait.' });
        console.log("Activating with key:", licenseKey);
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1500));
        toast({ title: 'Activation Successful!', description: 'Your license is now active.'});
        // Here you would refresh the useLicense hook's data, e.g. by calling a function from the hook.
    };

    const handleDeactivate = async () => {
        // Placeholder for API call
        toast({ title: 'Deactivating...', description: 'Please wait.' });
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1500));
        toast({ title: 'Deactivation Successful!', description: 'This device is no longer licensed.'});
        // Here you would refresh the useLicense hook's data.
    };

    if (status === 'LOADING') {
        return (
             <Card id="license-management">
              <CardHeader>
                <CardTitle>License Status</CardTitle>
                <CardDescription>
                  Manage your application license and activation.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                  <Skeleton className="h-8 w-1/4" />
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
        )
    }

    if (status === 'VALID' && licenseDetails) {
        return (
             <Card id="license-management" className="border-green-500/50">
              <CardHeader>
                <CardTitle>License Status</CardTitle>
                <CardDescription>
                  Your license is active on this device.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <p className="font-semibold text-green-600">License Active</p>
                  </div>
                  <div className="text-sm space-y-1">
                    <p>Plan: <Badge variant="secondary">{licenseDetails.plan}</Badge></p>
                    <p>Expires: <span className="font-medium">{new Date(licenseDetails.expiresAt).toLocaleDateString()}</span></p>
                    <p className="text-xs text-muted-foreground pt-1">Device ID: {licenseDetails.deviceId}</p>
                  </div>
                  <Button variant="outline" className="w-full" onClick={handleDeactivate}>Deactivate This Device</Button>
              </CardContent>
            </Card>
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
        <Card id="license-management" className={status !== 'VALID' && status !== 'LOADING' && status !== 'NOT_FOUND' ? 'border-destructive/50' : ''}>
            <CardHeader>
                <CardTitle>{status === 'NOT_FOUND' ? 'Activate License' : 'License Issue'}</CardTitle>
                <CardDescription>
                  {status === 'NOT_FOUND' ? 'Please enter your license key to activate the application.' : 'Please resolve the issue below or enter a new key.'}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
                    <Input id="license-key" placeholder="Paste your license key here" value={licenseKey} onChange={(e) => setLicenseKey(e.target.value)} />
                </div>
                <Button className="w-full" onClick={handleActivate}>Activate</Button>
            </CardContent>
        </Card>
    )
}
