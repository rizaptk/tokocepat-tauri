
'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { TokoCepatLogo } from '@/components/TokoCepatLogo';
import { ArrowLeft } from 'lucide-react';
import { formatDistance, parseISO } from 'date-fns';
import { Separator } from '@/components/ui/separator';

export default function ShiftDetailsPage() {
    const params = useParams();
    const shiftId = params.id as string;
    
    const { shifts, transactions } = useStore();
    
    const shift = shifts.find(s => s.id === shiftId);
    const shiftTransactions = transactions.filter(t => t.shift_id === shiftId);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('id-ID', {
          style: 'currency',
          currency: 'IDR',
          minimumFractionDigits: 0,
        }).format(amount);
    };

    if (!shift) {
        return (
             <div className="flex min-h-screen w-full flex-col bg-muted/40">
                <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
                    <Link href="/dashboard">
                        <TokoCepatLogo />
                    </Link>
                </header>
                <main className="flex flex-1 items-center justify-center">
                    <Card className="w-full max-w-md">
                        <CardHeader>
                            <CardTitle>Shift Not Found</CardTitle>
                            <CardDescription>The shift you are looking for does not exist.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button asChild>
                                <Link href="/dashboard">Go Back to Dashboard</Link>
                            </Button>
                        </CardContent>
                    </Card>
                </main>
             </div>
        )
    }

    const duration = shift.closed_at ? formatDistance(parseISO(shift.closed_at), parseISO(shift.opened_at)) : 'Still open';
    const totalSales = shiftTransactions.reduce((sum, t) => sum + t.total, 0);
    const transactionCount = shiftTransactions.length;
    // Voids are not implemented yet. So total void is 0.
    const totalVoid = 0;
    const expectedCash = shift.opening_cash + totalSales - totalVoid;
    
    return (
         <div className="flex min-h-screen w-full flex-col bg-muted/40">
           <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6 z-10">
                <Button variant="outline" size="icon" asChild>
                    <Link href="/dashboard">
                        <ArrowLeft />
                    </Link>
                </Button>
              <TokoCepatLogo />
           </header>
          <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 items-center">
            <div className="w-full max-w-4xl space-y-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Shift Summary</CardTitle>
                        <CardDescription>
                            Shift ID: {shift.id}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                                <p className="text-muted-foreground">Start Time</p>
                                <p className="font-medium">{new Date(shift.opened_at).toLocaleString()}</p>
                            </div>
                             <div>
                                <p className="text-muted-foreground">End Time</p>
                                <p className="font-medium">{shift.closed_at ? new Date(shift.closed_at).toLocaleString() : '-'}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">Duration</p>
                                <p className="font-medium">{duration}</p>
                            </div>
                             <div>
                                <p className="text-muted-foreground">Transactions</p>
                                <p className="font-medium">{transactionCount}</p>
                            </div>
                        </div>
                        <Separator />
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 pt-2">
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Opening Cash</span>
                                    <span className="font-medium">{formatCurrency(shift.opening_cash)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Total Sales</span>
                                    <span className="font-medium">{formatCurrency(totalSales)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Total Void</span>
                                    <span className="font-medium text-destructive">{formatCurrency(totalVoid)}</span>
                                </div>
                            </div>
                             <div className="space-y-2 text-sm">
                                <div className="flex justify-between font-semibold">
                                    <span>Expected Cash</span>
                                    <span>{formatCurrency(expectedCash)}</span>
                                </div>
                                <div className="flex justify-between font-semibold">
                                    <span>Declared Cash</span>
                                    <span>{formatCurrency(shift.declared_cash || 0)}</span>
                                </div>
                            </div>
                             <div className={`space-y-2 text-sm p-3 rounded-lg ${shift.variance !== 0 ? 'bg-destructive/10' : 'bg-green-500/10'}`}>
                                 <div className={`flex justify-between font-bold text-lg ${shift.variance !== 0 ? 'text-destructive' : 'text-green-600'}`}>
                                    <span>Variance</span>
                                    <span>{formatCurrency(shift.variance || 0)}</span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                 <Card>
                    <CardHeader>
                        <CardTitle>Transactions</CardTitle>
                        <CardDescription>All transactions recorded during this shift.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Time</TableHead>
                                    <TableHead>Invoice #</TableHead>
                                    <TableHead>Items</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {shiftTransactions.map(tx => (
                                    <TableRow key={tx.id}>
                                        <TableCell>{new Date(tx.created_at).toLocaleTimeString()}</TableCell>
                                        <TableCell className="font-mono text-xs">{tx.invoice_number}</TableCell>
                                        <TableCell>{tx.items.reduce((acc, item) => acc + item.qty, 0)}</TableCell>
                                        <TableCell className="text-right font-medium">{formatCurrency(tx.total)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                <div className="flex gap-2 pt-4">
                    <Button variant="outline" disabled>Export PDF</Button>
                    <Button asChild>
                        <Link href="/dashboard">Done</Link>
                    </Button>
                </div>
            </div>
          </main>
        </div>
    )
}
