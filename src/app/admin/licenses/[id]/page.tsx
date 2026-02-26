'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, notFound } from 'next/navigation';
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
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, KeyRound, User, Laptop, CheckCircle, CircleOff, AlertTriangle } from 'lucide-react';
import { DeactivateButton } from './_components/DeactivateButton';
import { getLicenseDetailsAction } from '../_actions';

// Define a type for the serialized license data
type LicenseDetails = {
    id: string;
    key: string;
    plan: string;
    status: string;
    createdAt: string;
    expiresAt: string | null;
    activations: {
        deviceId: string;
        activatedAt: string;
        isActive: boolean;
    }[];
    maxSeats: number;
    customer: {
        name: string;
        email: string;
    } | null;
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


function LicenseDetailsSkeleton() {
    return (
        <>
            <div className="flex items-center gap-4">
                 <Skeleton className="h-7 w-7 rounded-md" />
                <Skeleton className="h-7 w-48" />
                <div className="flex-grow" />
                <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <div className="grid gap-4 md:grid-cols-[1fr_250px] lg:grid-cols-3 lg:gap-8">
                <div className="grid auto-rows-max items-start gap-4 lg:col-span-2 lg:gap-8">
                    <Card>
                        <CardHeader> <Skeleton className="h-6 w-40" /> </CardHeader>
                        <CardContent className="grid gap-4 sm:grid-cols-2">
                             <div className="space-y-2"> <Skeleton className="h-4 w-20" /> <Skeleton className="h-6 w-full" /> </div>
                             <div className="space-y-2"> <Skeleton className="h-4 w-12" /> <Skeleton className="h-6 w-24" /> </div>
                             <div className="space-y-2"> <Skeleton className="h-4 w-24" /> <Skeleton className="h-6 w-32" /> </div>
                             <div className="space-y-2"> <Skeleton className="h-4 w-24" /> <Skeleton className="h-6 w-32" /> </div>
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader> <Skeleton className="h-6 w-56" /> </CardHeader>
                        <CardContent> <Skeleton className="h-40 w-full" /> </CardContent>
                    </Card>
                </div>
                <div className="grid auto-rows-max items-start gap-4 lg:gap-8">
                    <Card>
                         <CardHeader> <Skeleton className="h-6 w-24" /> </CardHeader>
                         <CardContent> <Skeleton className="h-12 w-full" /> </CardContent>
                    </Card>
                    <Card>
                         <CardHeader> <Skeleton className="h-6 w-20" /> </CardHeader>
                         <CardContent> <Skeleton className="h-10 w-full" /> </CardContent>
                    </Card>
                </div>
            </div>
        </>
    )
}

export default function LicenseDetailsPage() {
    const params = useParams();
    const id = params.id as string;

    const [license, setLicense] = useState<LicenseDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!id) {
            setError("No license ID provided.");
            setLoading(false);
            return;
        };

        async function fetchData() {
            setLoading(true);
            const result = await getLicenseDetailsAction(id);
            if (result.error) {
                setError(result.error);
            } else if (result.license) {
                setLicense(result.license as LicenseDetails);
            }
            setLoading(false);
        }
        fetchData();
    }, [id]);

    if (loading) {
        return <LicenseDetailsSkeleton />;
    }

    if (error) {
        return (
             <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm">
                <div className="flex flex-col items-center gap-2 text-center p-8">
                    <AlertTriangle className="h-12 w-12 text-destructive" />
                    <h3 className="text-2xl font-bold tracking-tight text-destructive">Error Loading License</h3>
                    <p className="text-muted-foreground">{error}</p>
                    <Button asChild variant="outline" className="mt-4">
                        <Link href="/admin/licenses">Go Back</Link>
                    </Button>
                </div>
             </div>
        );
    }
    
    if (!license) {
        // This will be caught by Next.js and render the not-found.js file.
        notFound();
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
                                <p className="font-medium">
                                    {license.createdAt ? new Date(license.createdAt).toLocaleDateString() : 'N/A'}
                                </p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-muted-foreground">Expires On</p>
                                <p className="font-medium">
                                    {license.expiresAt ? new Date(license.expiresAt).toLocaleDateString() : 'Never'}
                                </p>
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
                                        {license.activations.map((act) => (
                                            <TableRow key={act.deviceId}>
                                                <TableCell className="font-mono text-xs">{act.deviceId.substring(0, 12)}...</TableCell>
                                                <TableCell>
                                                    {act.activatedAt ? new Date(act.activatedAt).toLocaleDateString() : 'N/A'}
                                                </TableCell>
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
