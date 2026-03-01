
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, ParkingSquare, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TokoCepatLogo } from "@/components/TokoCepatLogo";
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
} from "@/components/ui/alert-dialog";
import { useStore } from "@/lib/store";
import { useState, useMemo, useCallback } from "react";
import { Label } from "./ui/label";
import { PendingCartsDialog } from "./PendingCartsDialog";


export function Header() {
  const router = useRouter();
  const [declaredCash, setDeclaredCash] = useState(0);
  const [isPendingCartDialogOpen, setIsPendingCartDialogOpen] = useState(false);
  const activeShift = useStore((state) => state.activeShift);
  const transactions = useStore((state) => state.transactions);
  const pendingCarts = useStore(state => state.pendingCarts);
  const closeShift = useStore((state) => state.closeShift);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };
  
  const { shiftRevenue, expectedCash } = useMemo(() => {
    const activeShiftTransactions = activeShift ? transactions.filter(t => t.shift_id === activeShift.id && t.status === 'paid') : [];
    const revenue = activeShiftTransactions.reduce((sum, t) => sum + t.total, 0);
    return { shiftRevenue: revenue, expectedCash: activeShift ? activeShift.opening_cash + revenue : 0 };
  }, [activeShift, transactions]);
  
  const handleCloseShift = useCallback(() => {
    closeShift(declaredCash);
    setDeclaredCash(0);
    router.push('/dashboard');
  }, [closeShift, declaredCash, router]);

  return (
    <>
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-4 bg-transparent px-4 md:px-6">
      <Link href="/">
        <TokoCepatLogo />
      </Link>
      
      <div className="flex items-center gap-2">
         {pendingCarts.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setIsPendingCartDialogOpen(true)}>
                <ParkingSquare className="mr-2 h-4 w-4"/> Parked ({pendingCarts.length})
            </Button>
        )}
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                    <LogOut className="mr-2 h-4 w-4"/> Close Shift
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
                        <span className="text-muted-foreground">Opening Cash</span>
                        <span className="font-medium">{formatCurrency(activeShift?.opening_cash || 0)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Shift Revenue</span>
                        <span className="font-medium">{formatCurrency(shiftRevenue)}</span>
                    </div>
                    <div className="flex justify-between items-center font-semibold text-base">
                        <span>Expected Cash</span>
                        <span>{formatCurrency(expectedCash)}</span>
                    </div>
                    <div>
                        <Label htmlFor="declared-cash">Declared Cash Amount</Label>
                        <div className="relative mt-1">
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
                    {declaredCash > 0 && (
                        <div className="flex justify-between items-center font-semibold text-base">
                            <span>Variance</span>
                            <span className={`font-medium ${declaredCash - expectedCash !== 0 ? 'text-destructive' : 'text-green-600'}`}>{formatCurrency(declaredCash - expectedCash)}</span>
                        </div>
                    )}
                </div>
                <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleCloseShift} disabled={declaredCash <= 0}>Confirm & Close Shift</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
            </AlertDialog>
        </div>
    </header>
    <PendingCartsDialog isOpen={isPendingCartDialogOpen} onOpenChange={setIsPendingCartDialogOpen} />
    </>
  );
}
