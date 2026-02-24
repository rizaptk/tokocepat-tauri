
"use client";

import Link from "next/link";
import { Barcode, LogOut, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TokoCepatLogo } from "@/components/TokoCepatLogo";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { useState } from "react";
import { Label } from "./ui/label";


type HeaderProps = {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
};

export function Header({ searchTerm, setSearchTerm }: HeaderProps) {
  const [declaredCash, setDeclaredCash] = useState(0);
  const activeShift = useStore((state) => state.activeShift);
  const transactions = useStore((state) => state.transactions);
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
  
  const handleCloseShift = () => {
    closeShift(declaredCash);
    setDeclaredCash(0);
  }

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
      <Link href="/">
        <TokoCepatLogo />
      </Link>
      <div className="flex flex-1 items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search products..."
            className="pl-8 sm:w-[300px] md:w-[200px] lg:w-[300px]"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="icon" className="h-9 w-9">
              <Barcode className="h-4 w-4" />
              <span className="sr-only">Scan Barcode</span>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Barcode Scanner</DialogTitle>
              <DialogDescription>
                This feature is for demonstration purposes. In a real app, this would open the device's camera to scan product barcodes.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center justify-center gap-4 py-8">
              <Barcode className="h-24 w-24 text-muted-foreground" />
              <p className="text-muted-foreground">Ready to scan</p>
            </div>
          </DialogContent>
        </Dialog>

        <AlertDialog>
          <AlertDialogTrigger asChild>
              <Button variant="destructive">
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
  );
}
