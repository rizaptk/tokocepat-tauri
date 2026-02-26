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
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, XCircle } from 'lucide-react';


async function getPayments() {
    try {
        const paymentsSnapshot = await db.collection('payments').orderBy('createdAt', 'desc').get();
        if (paymentsSnapshot.empty) {
            return [];
        }
        return paymentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error: any) {
        console.error("Error fetching payments: ", error);
        return { error: "Could not fetch payment data from Firestore. Please ensure the service is enabled and check server logs for detailed errors." };
    }
}


const getStatusInfo = (status: string) => {
    switch (status.toLowerCase()) {
        case 'completed':
            return { variant: 'default' as const, className: 'bg-green-600 hover:bg-green-600/80', icon: CheckCircle, label: 'Completed' };
        case 'pending':
            return { variant: 'secondary' as const, className: 'bg-yellow-500 hover:bg-yellow-500/80', icon: Clock, label: 'Pending' };
        case 'failed':
            return { variant: 'destructive' as const, className: '', icon: XCircle, label: 'Failed' };
        default:
            return { variant: 'secondary' as const, className: '', icon: Clock, label: 'Unknown' };
    }
};

const formatCurrency = (amount: number, currency: string = 'IDR') => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
    }).format(amount);
};


export default async function AdminPaymentsPage() {
    const payments = await getPayments();
    const hasError = !Array.isArray(payments);

    return (
        <>
            <div className="flex items-center">
                <h1 className="text-lg font-semibold md:text-2xl">Payments</h1>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Payment History</CardTitle>
                    <CardDescription>A log of all payment transactions from the payment gateway.</CardDescription>
                </CardHeader>
                <CardContent>
                     {hasError ? (
                         <div className="border border-destructive/50 bg-destructive/10 rounded-lg p-8 text-center">
                            <p className="font-semibold text-destructive">Connection Error</p>
                            <p className="text-destructive/80 mt-2">{(payments as any).error}</p>
                        </div>
                    ) : payments.length === 0 ? (
                        <div className="border border-dashed rounded-lg p-8 text-center">
                            <p className="text-muted-foreground">No payment history found.</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Customer</TableHead>
                                    <TableHead>Amount</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Gateway ID</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {payments.map((payment: any) => {
                                    const statusInfo = getStatusInfo(payment.status || 'unknown');
                                    return (
                                        <TableRow key={payment.id}>
                                            <TableCell>
                                                <div className="font-medium">{new Date(payment.createdAt.toDate()).toLocaleDateString()}</div>
                                                <div className="text-xs text-muted-foreground">{new Date(payment.createdAt.toDate()).toLocaleTimeString()}</div>
                                            </TableCell>
                                            <TableCell>{payment.customerEmail || 'N/A'}</TableCell>
                                            <TableCell>{formatCurrency(payment.amount, payment.currency)}</TableCell>
                                            <TableCell>
                                                 <Badge variant={statusInfo.variant} className={statusInfo.className}>
                                                    <statusInfo.icon className="mr-1.5 h-3 w-3" />
                                                    {statusInfo.label}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="font-mono text-xs">{payment.gatewayTransactionId || 'N/A'}</TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </>
    );
}