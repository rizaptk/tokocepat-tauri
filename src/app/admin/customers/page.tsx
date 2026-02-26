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
        // This error will now mostly catch runtime issues like Firestore being disabled.
        // Initialization errors are caught on server startup.
        return { error: "Could not fetch data from Firestore. Please ensure the service is enabled and check server logs for detailed errors." };
    }
}

export default async function AdminCustomersPage() {
    const customers = await getCustomers();
    const hasError = !Array.isArray(customers);

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
                    ) : customers.length === 0 ? (
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
                                {customers.map((customer: any) => (
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
