
import { db } from '@/lib/firebase-admin';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, KeyRound, User, PowerOff, Laptop, CheckCircle, CircleOff } from 'lucide-react';
import { DeactivateButton } from './_components/DeactivateButton';

async function getLicenseDetails(licenseId: string) {
    if (!licenseId) {
        return null;
    }
    const licenseRef = db.collection('licenses').doc(licenseId);
    const licenseSnap = await licenseRef.get();

    if (!licenseSnap.exists) {
        return null;
    }

    const licenseData = licenseSnap.data();
    let customerData = null;

    if (licenseData?.customerId && licenseData.customerId.length > 0) {
        const customerRef = db.collection('customers').doc(licenseData.customerId);
        const customerSnap = await customerRef.get();
        if (customerSnap.exists) {
            customerData = customerSnap.data();
        }
    }

    return {
        id: licenseSnap.id,
        ...licenseData,
        customer: customerData,
    };
}


export default async function LicenseDetailsPage({ params }: { params: { licenseId: string } }) {
    const license = await getLicenseDetails(params.licenseId);

    if (!license) {
        notFound();
    }
    
    const getStatusVariant = (status: string) => {
        switch (status) {
            case 'active':
                return 'default';
            case 'expired':
                return 'destructive';
            default:
                return 'secondary';
        }
    };
    
    const getStatusClass = (status: string) => {
         if (status === 'active') return 'bg-green-600 hover:bg-green-600/80';
         return '';
    }

    return (
        <>
            <div className="flex items-center gap-4">
                 <Button variant="outline" size="icon" className="h-7 w-7" asChild>
                  <Link href="/admin/licenses">
                    <ArrowLeft className="h-4 w-4" />
                    <span className="sr-only">Back</span>
                  </Link>
                </Button>
                <h1 className="flex-1 shrink-0 whitespace-nowrap text-xl font-semibold tracking-tight sm:grow-0">
                    License Details
                </h1>
                <Badge variant={getStatusVariant(license.status)} className={getStatusClass(license.status)}>
                    {license.status}
                </Badge>
            </div>
            <div className="grid gap-4 md:grid-cols-[1fr_250px] lg:grid-cols-3 lg:gap-8">
                <div className="grid auto-rows-max items-start gap-4 lg:col-span-2 lg:gap-8">
                    <Card>
                        <CardHeader>
                             <CardTitle className="flex items-center gap-2">
                                <KeyRound className="h-5 w-5"/>
                                License Information
                             </CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-muted-foreground">License Key</p>
                                <Badge variant="outline" className="font-mono">{license.key}</Badge>
                            </div>
                             <div className="space-y-1">
                                <p className="text-sm font-medium text-muted-foreground">Plan</p>
                                <p className="font-medium">{license.plan}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-muted-foreground">Created On</p>
                                <p className="font-medium">{new Date(license.createdAt.toDate()).toLocaleDateString()}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-muted-foreground">Expires On</p>
                                <p className="font-medium">{license.expiresAt ? new Date(license.expiresAt.toDate()).toLocaleDateString() : 'Never'}</p>
                            </div>
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Laptop className="h-5 w-5" />
                                Activated Devices ({license.activations?.filter((a: any) => a.isActive).length || 0} / {license.maxSeats || 1})
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                             {(license.activations && license.activations.length > 0) ? (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Device ID</TableHead>
                                            <TableHead>Activated On</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {license.activations.map((act: any) => (
                                            <TableRow key={act.deviceId}>
                                                <TableCell className="font-mono text-xs">{act.deviceId.substring(0, 12)}...</TableCell>
                                                <TableCell>{new Date(act.activatedAt.toDate()).toLocaleDateString()}</TableCell>
                                                <TableCell>
                                                    {act.isActive ? (
                                                        <Badge variant="default" className="bg-green-600 hover:bg-green-600/80 text-xs">
                                                            <CheckCircle className="mr-1.5 h-3 w-3" />
                                                            Active
                                                        </Badge>
                                                    ) : (
                                                         <Badge variant="secondary" className="text-xs">
                                                            <CircleOff className="mr-1.5 h-3 w-3" />
                                                            Inactive
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {act.isActive && (
                                                        <DeactivateButton licenseId={license.id} deviceId={act.deviceId} />
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                             ) : (
                                <div className="text-center text-muted-foreground p-4 border border-dashed rounded-md">
                                    <p>No devices have been activated with this license yet.</p>
                                </div>
                             )}
                        </CardContent>
                    </Card>
                </div>
                <div className="grid auto-rows-max items-start gap-4 lg:gap-8">
                    <Card>
                         <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <User className="h-5 w-5"/>
                                Customer
                            </CardTitle>
                         </CardHeader>
                         <CardContent>
                             {license.customer ? (
                                <div className="space-y-2">
                                    <p className="font-semibold">{license.customer.name || 'N/A'}</p>
                                    <p className="text-sm text-muted-foreground">{license.customer.email}</p>
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">No customer associated.</p>
                            )}
                         </CardContent>
                    </Card>
                    <Card>
                         <CardHeader>
                            <CardTitle>Actions</CardTitle>
                         </CardHeader>
                         <CardContent>
                            <Button variant="outline" className="w-full">Edit License</Button>
                         </CardContent>
                    </Card>
                </div>
            </div>
        </>
    );
}
