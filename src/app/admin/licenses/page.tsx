
import Link from 'next/link';
import {
  MoreHorizontal,
  KeyRound,
  Trash2,
  View,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { CreateLicenseDialog } from './_components/CreateLicenseDialog';
import { db } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';


async function getLicenses() {
    if (!db) {
        return { error: "Firebase Admin SDK is not initialized." };
    }
    try {
        const licensesSnapshot = await db.collection('licenses').orderBy('createdAt', 'desc').get();
        if (licensesSnapshot.empty) {
            return [];
        }
        
        const customerIds = [...new Set(
            licensesSnapshot.docs
                .map(doc => doc.data().customerId)
                .filter((id): id is string => typeof id === 'string' && id.length > 0)
        )];
        let customersMap = new Map();

        // Firestore 'in' query is limited to 30 items in Node.js server SDK
        if (customerIds.length > 0) {
            // Chunking the customerIds array to handle more than 30 IDs
            const chunks = [];
            for (let i = 0; i < customerIds.length; i += 30) {
                chunks.push(customerIds.slice(i, i + 30));
            }

            for (const chunk of chunks) {
                 const customersSnapshot = await db.collection('customers').where(admin.firestore.FieldPath.documentId(), 'in', chunk).get();
                 customersSnapshot.forEach(doc => {
                    customersMap.set(doc.id, doc.data());
                });
            }
        }
        
        return licensesSnapshot.docs.map(doc => {
            const data = doc.data();
            const customer = data.customerId ? customersMap.get(data.customerId) : null;
            return {
                id: doc.id,
                customerEmail: customer ? customer.email : 'N/A',
                ...data
            };
        });

    } catch (error: any) {
        console.error("Error fetching licenses: ", error);
        return { error: "Could not connect to the database to fetch licenses." };
    }
}

export default async function AdminLicensesPage() {
    const licenses = await getLicenses();
    const hasError = !Array.isArray(licenses);

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
            <div className="flex items-center">
                <h1 className="text-lg font-semibold md:text-2xl">Licenses</h1>
            </div>
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle>License Management</CardTitle>
                            <CardDescription>
                                Manually create, view, and manage customer licenses.
                            </CardDescription>
                        </div>
                        <CreateLicenseDialog />
                    </div>
                </CardHeader>
                <CardContent>
                    {hasError ? (
                         <div className="border border-destructive/50 bg-destructive/10 rounded-lg p-8 text-center">
                            <p className="font-semibold text-destructive">Connection Error</p>
                            <p className="text-destructive/80 mt-2">{(licenses as any).error}</p>
                        </div>
                    ) : licenses.length === 0 ? (
                        <div className="border border-dashed rounded-lg p-8 text-center">
                            <KeyRound className="mx-auto h-12 w-12 text-muted-foreground" />
                            <h3 className="mt-4 text-lg font-semibold">No Licenses Found</h3>
                            <p className="text-muted-foreground mt-2">Create a new license to get started.</p>
                             <div className="mt-4">
                                <CreateLicenseDialog />
                            </div>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Customer</TableHead>
                                    <TableHead>License Key</TableHead>
                                    <TableHead>Plan</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Expires On</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {licenses.map((license: any) => (
                                    <TableRow key={license.id}>
                                        <TableCell className="font-medium">{license.customerEmail}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="font-mono">
                                                {license.key}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{license.plan}</TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={getStatusVariant(license.status)}
                                                className={getStatusClass(license.status)}
                                            >
                                                {license.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {license.expiresAt && typeof license.expiresAt.toDate === 'function'
                                                ? new Date(license.expiresAt.toDate()).toLocaleDateString()
                                                : 'Never'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        aria-haspopup="true"
                                                        size="icon"
                                                        variant="ghost"
                                                    >
                                                        <MoreHorizontal className="h-4 w-4" />
                                                        <span className="sr-only">Toggle menu</span>
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                    <DropdownMenuItem asChild>
                                                        <Link href={'/admin/licenses/' + license.id}>
                                                            <View className="mr-2 h-4 w-4" />
                                                            View Details
                                                        </Link>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem className="text-destructive">
                                                        <Trash2 className="mr-2 h-4 w-4" /> Deactivate License
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </>
    );
}

    