
"use client";

import Link from "next/link";
import { History } from "lucide-react";
import { useStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TokoCepatLogo } from "@/components/TokoCepatLogo";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";

export default function DashboardPage() {
  const router = useRouter();
  const products = useStore((state) => state.products);
  const shifts = useStore((state) => state.shifts);
  const closedShifts = shifts.filter(s => s.status === 'closed');

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };
  
  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
       <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
          <Link href="/">
            <TokoCepatLogo />
          </Link>
       </header>
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="grid gap-4 md:grid-cols-2">
            <Card>
                <CardHeader>
                    <CardTitle>Stock Control</CardTitle>
                    <CardDescription>Real-time inventory levels for all products.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                            <TableHead>Product</TableHead>
                            <TableHead>Price</TableHead>
                            <TableHead className="text-right">Stock</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {products.map(product => (
                                <TableRow key={product.id}>
                                    <TableCell className="font-medium">{product.name}</TableCell>
                                    <TableCell>{formatCurrency(product.price)}</TableCell>
                                    <TableCell className={`text-right font-medium ${product.stock < 10 ? 'text-destructive' : ''}`}>{product.stock}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Shift History</CardTitle>
                    <CardDescription>Review previously closed shifts. Click a row to see details.</CardDescription>
                </CardHeader>
                <CardContent>
                   {closedShifts.length === 0 ? (
                     <div className="text-center text-muted-foreground py-8">
                       <History className="mx-auto h-10 w-10 mb-2"/>
                       <p>No closed shifts yet.</p>
                     </div>
                   ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Variance</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {closedShifts.map(shift => (
                                <TableRow key={shift.id} onClick={() => router.push(`/dashboard/shifts/${shift.id}`)} className="cursor-pointer">
                                    <TableCell>
                                        <div className="font-medium">{new Date(shift.opened_at).toLocaleDateString()}</div>
                                        <div className="text-xs text-muted-foreground">
                                            {new Date(shift.opened_at).toLocaleTimeString()} - {shift.closed_at ? new Date(shift.closed_at).toLocaleTimeString() : ''}
                                        </div>
                                    </TableCell>
                                    <TableCell><Badge variant="secondary">CLOSED</Badge></TableCell>
                                    <TableCell className={`text-right font-medium ${shift.variance && shift.variance !== 0 ? 'text-destructive' : ''}`}>
                                        {formatCurrency(shift.variance || 0)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                   )}
                </CardContent>
            </Card>
        </div>
      </main>
    </div>
  );
}
