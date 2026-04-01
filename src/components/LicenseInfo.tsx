import { useLicense } from "@/hooks/useLicense"
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { AlertTriangle, CheckCircle, Clock, Loader2, ShieldOff, XCircle } from "lucide-react";
import { Badge } from "./ui/badge";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Link } from "react-router-dom";
import { formatDistanceToNowShort } from "@/lib/utils";

export const LicenseInfo = () => {

    const { status, licenseDetails } =  useLicense();

    if (status === 'LOADING') return (
        <div className="flex items-center justify-center p-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
    ) 

    if (status === 'VALID' || status === 'EXPIRES_SOON') {
        const expireAt = new Date(licenseDetails.expiresAt);
        const remaining = formatDistanceToNowShort(expireAt);
        return (
             <div className="space-y-4">
                  {status === 'EXPIRES_SOON' && licenseDetails?.daysRemaining != null && (
                    <Alert variant="destructive" className="bg-orange-50 border-orange-200 text-orange-800 dark:bg-orange-950/30 dark:border-orange-800 dark:text-orange-300 [&>svg]:text-orange-600">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Lisensi Segera Berakhir</AlertTitle>
                        <AlertDescription>
                            Lisensi berakhir dalam {licenseDetails.daysRemaining === 0 ? remaining : licenseDetails.daysRemaining + ' hari'}. Perbarui langganan agar layanan tidak terputus.
                        </AlertDescription>
                    </Alert>
                  )}
                  <Card>
                    <CardContent className="flex flex-col gap-2 pt-6">
                        <div className="flex items-center gap-2">
                            <CheckCircle className="h-5 w-5 text-green-600" />
                            <p className="font-semibold text-green-600">Lisensi Aktif</p>
                            <Link to="/license" className="ms-auto text-sm font-medium text-primary hover:underline">
                                Kelola &rarr;
                            </Link>
                        </div>
                        <div className="text-sm space-y-1">
                            <p>Paket: <Badge variant="secondary">{licenseDetails.plan}</Badge></p>
                            <p>Berakhir: <span className="font-medium">{licenseDetails.expiresAt === 'Never' ? 'Selamanya' : new Date(licenseDetails.expiresAt).toLocaleDateString()}</span></p>
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
                return { icon: XCircle, title: "Lisensi Tidak Valid", description: "Data lisensi rusak. Silakan aktivasi ulang." };
            case 'EXPIRED':
                return { icon: Clock, title: "Lisensi Kedaluwarsa", description: "Perbarui lisensi untuk terus menggunakan aplikasi." };
            case 'TAMPERED':
                return { icon: ShieldOff, title: "Manipulasi Waktu", description: "Waktu sistem tidak akurat. Mohon atur jam dengan benar." };
            case 'CLONED':
                return { icon: ShieldOff, title: "Perangkat Berbeda", description: "Lisensi terdaftar di perangkat lain. Deaktivasi perangkat lama dahulu." };
            default:
                return null;
        }
    }
    const errorContent = getErrorContent();

    return (
        <>
        <div className="space-y-4">
            {errorContent && (
                <Alert variant="destructive">
                    <errorContent.icon className="h-4 w-4" />
                    <AlertTitle>{errorContent.title}</AlertTitle>
                    <AlertDescription className="flex flex-col gap-3">
                        <p>{errorContent.description}</p>
                        <Link to="/license">
                            <Button size="sm" variant="outline" className="w-full">Kelola Lisensi</Button>
                        </Link>
                    </AlertDescription>
                </Alert>
            )}
            {!errorContent && status === 'NOT_FOUND' && (
                <Alert variant="destructive">
                    <ShieldOff className="h-4 w-4" />
                    <AlertTitle>Belum Ada Lisensi</AlertTitle>
                    <AlertDescription className="flex flex-col gap-3">
                        <p>Aplikasi belum diaktivasi. Beberapa fitur mungkin dibatasi.</p>
                        <Link to="/license">
                            <Button size="sm" className="w-full">Aktivasi Sekarang</Button>
                        </Link>
                    </AlertDescription>
                </Alert>
            )}
        </div>
        </>
    )
}