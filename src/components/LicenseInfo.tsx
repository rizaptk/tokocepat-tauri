import { useLicense } from "@/hooks/useLicense"
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { AlertTriangle, CheckCircle, Clock, ShieldOff, XCircle } from "lucide-react";
import { Badge } from "./ui/badge";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Link } from "react-router-dom";

export const LicenseInfo = () => {
    const { status, licenseDetails } = useLicense();

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
                  <Card>
                    <CardContent className="flex flex-col gap-2 pt-6">
                        <div className="flex items-center gap-2">
                            <CheckCircle className="h-5 w-5 text-green-600" />
                            <p className="font-semibold text-green-600">License Active</p>
                            <Link to="/license" className="ms-auto text-sm font-medium text-primary hover:underline">
                                Manage License &rarr;
                            </Link>
                        </div>
                        <div className="text-sm space-y-1">
                            <p>Plan: <Badge variant="secondary">{licenseDetails.plan}</Badge></p>
                            <p>Expires: <span className="font-medium">{licenseDetails.expiresAt === 'Never' ? 'Never' : new Date(licenseDetails.expiresAt).toLocaleDateString()}</span></p>
                            <p className="text-xs text-muted-foreground pt-1 break-all">Device ID: {licenseDetails.deviceId}</p>
                        </div>
                    </CardContent>
                  </Card>
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
        <>
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
            {!errorContent && status === 'NOT_FOUND' && (
                <Alert variant="destructive">
                    <ShieldOff className="h-4 w-4" />
                    <AlertTitle>No Active License</AlertTitle>
                    <AlertDescription className="flex flex-col gap-3">
                        <p>You haven't activated a license on this device yet. Some features may be restricted.</p>
                        <Link to="/license">
                            <Button size="sm" className="w-full">Activate Now</Button>
                        </Link>
                    </AlertDescription>
                </Alert>
            )}
        </div>
        </>
    )
}