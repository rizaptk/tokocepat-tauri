import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { db } from '@/lib/firebase-admin';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

async function getCustomers() {
    try {
        const customersSnapshot = await db.collection('customers').get();
        if (customersSnapshot.empty) {
            return [];
        }
        return customersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error: any) {
        console.error("Error fetching customers: ", error);
        // Check for specific error indicating missing credentials
        if (process.env.FIREBASE_PROJECT_ID && error.message.includes('Failed to parse private key')) {
             return { error: "Firebase Admin credentials are not configured correctly. Please check your .env file and ensure the private key is correctly Base64 encoded." };
        }
        return { error: "Could not connect to the database. Please ensure your Firebase Admin credentials are set in the .env file." };
    }
}

export default async function AdminCustomersPage() {
    const customers = await getCustomers();
    const hasError = Array.isArray(customers) && 'error' in customers;

    return (
        <>
            <div className="flex items-center">
                <h1 className="text-lg font-semibold md:text-2xl">Customers</h1>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Customer Management</CardTitle>
                    <CardDescription>A list of all customers from the Firestore database.</CardDescription>
                </CardHeader>
                <CardContent>
                    {hasError ? (
                         <div className="border border-destructive/50 bg-destructive/10 rounded-lg p-8 text-center">
                            <p className="font-semibold text-destructive">Connection Error</p>
                            <p className="text-destructive/80 mt-2">{(customers as any).error}</p>
                        </div>
                    ) : Array.isArray(customers) && customers.length === 0 ? (
                        <div className="border border-dashed rounded-lg p-8 text-center">
                            <p className="text-muted-foreground">No customers found in the database.</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Customer Name</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Licenses</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {Array.isArray(customers) && customers.map((customer: any) => (
                                    <TableRow key={customer.id}>
                                        <TableCell className="font-medium">{customer.name || 'N/A'}</TableCell>
                                        <TableCell>{customer.email || 'N/A'}</TableCell>
                                        <TableCell>{customer.licenseCount || 0}</TableCell>
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
