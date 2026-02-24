"use client";

import { useState } from "react";
import Link from "next/link";
import { DollarSign, Package, ShoppingCart, LogIn, LogOut, History } from "lucide-react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TokoCepatLogo } from "@/components/TokoCepatLogo";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";


export default function DashboardPage() {
  const [openingCash, setOpeningCash] = useState(0);
  const [declaredCash, setDeclaredCash] = useState(0);

  const products = useStore((state) => state.products);
  const transactions = useStore((state) => state.transactions);
  const activeShift = useStore((state) => state.activeShift);
  const shifts = useStore((state) => state.shifts);
  const openShift = useStore((state) => state.openShift);
  const closeShift = useStore((state) => state.closeShift);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };
  
  const shiftTransactions = activeShift ? transactions.filter(t => t.shift_id === activeShift.id) : [];
  const shiftRevenue = shiftTransactions.reduce((sum, t) => sum + t.total, 0);
  const expectedCash = activeShift ? activeShift.opening_cash + shiftRevenue : 0;
  const closedShifts = shifts.filter(s => s.status === 'closed');

  const handleOpenShift = () => {
    openShift(openingCash);
    setOpeningCash(0);
  }
  
  const handleCloseShift = () => {
    closeShift(declaredCash);
    setDeclaredCash(0);
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
       <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
          <Link href="/">
            <TokoCepatLogo />
          </Link>
       </header>
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        {!activeShift ? (
            <Card>
                <CardHeader>
                    <CardTitle>Open a New Shift</CardTitle>
                    <CardDescription>Enter the starting cash amount in your drawer to begin making sales.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="flex-1 w-full">
                        <Label htmlFor="opening-cash" className="sr-only">Opening Cash</Label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">Rp</span>
                            <Input 
                                id="opening-cash"
                                type="number" 
                                placeholder="Enter opening cash amount" 
                                value={openingCash || ''}
                                onChange={(e) => setOpeningCash(Number(e.target.value))}
                                className="pl-10 text-lg"
                            />
                        </div>
                    </div>
                    <Button onClick={handleOpenShift} className="w-full sm:w-auto" disabled={openingCash <= 0}>
                        <LogIn className="mr-2 h-4 w-4" /> Open Shift
                    </Button>
                </CardContent>
            </Card>
        ) : (
            <>
                <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                        Shift Revenue
                    </CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(shiftRevenue)}</div>
                    <p className="text-xs text-muted-foreground">
                        From {shiftTransactions.length} transactions
                    </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                        Opening Cash
                    </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(activeShift.opening_cash)}</div>
                        <p className="text-xs text-muted-foreground">Cash at start of shift</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Expected Cash</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(expectedCash)}</div>
                        <p className="text-xs text-muted-foreground">Opening + Revenue</p>
                    </CardContent>
                </Card>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" className="h-full text-base">
                            <LogOut className="mr-2"/> Close Shift
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                        <AlertDialogTitle>Close Current Shift</AlertDialogTitle>
                        <AlertDialogDescription>
                            Count the cash in your drawer and enter the final amount below. This action cannot be undone.
                        </AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">Expected Cash</span>
                                <span className="font-medium">{formatCurrency(expectedCash)}</span>
                            </div>
                            <div>
                                <Label htmlFor="declared-cash">Declared Cash Amount</Label>
                                <div className="relative">
                                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">Rp</span>
                                    <Input 
                                        id="declared-cash"
                                        type="number" 
                                        placeholder="Enter final cash amount" 
                                        value={declaredCash || ''}
                                        onChange={(e) => setDeclaredCash(Number(e.target.value))}
                                        className="pl-10 text-lg"
                                        autoFocus
                                    />
                                </div>
                            </div>
                        </div>
                        <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleCloseShift} disabled={declaredCash <= 0}>Confirm & Close Shift</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
                </div>
            </>
        )}

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
                    <CardDescription>Summary of previously closed shifts.</CardDescription>
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
                                <TableHead className="text-right">Variance</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {closedShifts.map(shift => (
                                <TableRow key={shift.id}>
                                    <TableCell>
                                        <div className="font-medium">{new Date(shift.opened_at).toLocaleDateString()}</div>
                                        <div className="text-xs text-muted-foreground">
                                            {new Date(shift.opened_at).toLocaleTimeString()} - {shift.closed_at ? new Date(shift.closed_at).toLocaleTimeString() : ''}
                                        </div>
                                    </TableCell>
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
