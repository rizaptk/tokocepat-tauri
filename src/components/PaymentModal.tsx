
"use client";

import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, AlertCircle, Banknote, Delete, ReceiptText } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Transaction } from '@/lib/types';
import { generateReceiptText, printReceipt } from '@/lib/receipt';


type PaymentModalProps = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  total: number;
};

type PaymentStatus = 'pending' | 'success';

export function PaymentModal({ isOpen, setIsOpen, total }: PaymentModalProps) {
  const [cashReceived, setCashReceived] = useState<string>('');
  const [status, setStatus] = useState<PaymentStatus>('pending');
  const [transactionDetails, setTransactionDetails] = useState<Transaction | null>(null);
  
  const { checkout, storeConfig } = useStore((state) => ({ 
    checkout: state.checkout, 
    storeConfig: state.storeConfig 
  }));
  const { toast } = useToast();

  const numericCash = parseFloat(cashReceived) || 0;
  const change = numericCash - total;
  const isInsufficient = numericCash < total && numericCash > 0;

  // Professional IDR Formatter
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Common IDR Denominations for Quick-Click
  const denominations = [20000, 50000, 100000];
  
  // Suggested amounts based on total
  const suggestions = useMemo(() => {
    const sets = new Set<number>();
    if (total > 0) {
      sets.add(total); // Exact amount
      denominations.forEach(d => {
        if (d > total) sets.add(d);
      });
    }
    return Array.from(sets).sort((a, b) => a - b).slice(0, 4);
  }, [total]);

  const handlePayment = async () => {
    if (numericCash < total) {
      toast({
        variant: "destructive",
        title: "Payment Error",
        description: "Amount received is less than total due.",
      });
      return;
    }

    const transaction = await checkout(numericCash);
    if (transaction) {
      setTransactionDetails(transaction);
      setStatus('success');
    }
  };

  const resetAndClose = () => {
    setIsOpen(false);
    setTimeout(() => {
      setCashReceived('');
      setStatus('pending');
      setTransactionDetails(null);
    }, 200);
  };
  
  const handlePrint = () => {
    if (transactionDetails && storeConfig) {
      const receiptText = generateReceiptText(transactionDetails, storeConfig);
      printReceipt(receiptText);
    } else {
      toast({
        variant: "destructive",
        title: "Cannot Print",
        description: "Transaction details or store configuration is missing.",
      });
    }
  };

  useEffect(() => {
    if (status === 'success' && transactionDetails && storeConfig) {
        handlePrint();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, transactionDetails, storeConfig]);


  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && resetAndClose()}>
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden gap-0">
        {status === 'pending' ? (
          <>
            <div className="p-6 pb-4">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-xl">
                  <Banknote className="h-5 w-5 text-primary" />
                  Process Payment
                </DialogTitle>
                <DialogDescription>
                  Complete the transaction by entering the cash amount.
                </DialogDescription>
              </DialogHeader>

              <div className="mt-6 space-y-6">
                {/* Total Display */}
                <div className="bg-muted/50 rounded-xl p-4 flex justify-between items-center border">
                  <span className="text-sm font-medium text-muted-foreground">Total Amount Due</span>
                  <span className="text-2xl font-bold tracking-tight">{formatCurrency(total)}</span>
                </div>

                {/* Input Section */}
                <div className="space-y-3">
                  <Label htmlFor="cash" className="text-sm font-semibold">Cash Received</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">Rp</span>
                    <Input
                      id="cash"
                      type="number"
                      className={cn(
                        "pl-10 text-xl h-14 font-semibold transition-all",
                        isInsufficient && "border-destructive focus-visible:ring-destructive",
                        numericCash >= total && "border-green-500 focus-visible:ring-green-500"
                      )}
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                      placeholder="0"
                      autoFocus
                    />
                    {cashReceived && (
                      <button 
                        onClick={() => setCashReceived('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <Delete className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Quick Cash Suggestions */}
                <div className="grid grid-cols-2 gap-2">
                  {suggestions.map((amt) => (
                    <Button
                      key={amt}
                      variant="outline"
                      type="button"
                      className="h-12 font-semibold hover:border-primary hover:bg-primary/5"
                      onClick={() => setCashReceived(amt.toString())}
                    >
                      {amt === total ? "Exact Amount" : formatCurrency(amt)}
                    </Button>
                  ))}
                </div>

                {/* Change Calculation */}
                <div className={cn(
                  "rounded-lg p-4 transition-all border flex justify-between items-center",
                  change >= 0 ? "bg-green-50 border-green-100 dark:bg-green-950/20" : "bg-orange-50 border-orange-100 dark:bg-orange-950/20"
                )}>
                  <div className="flex items-center gap-2">
                    {change >= 0 ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-orange-600" />
                    )}
                    <span className={cn("text-sm font-medium", change >= 0 ? "text-green-700" : "text-orange-700")}>
                      {change >= 0 ? "Change to return" : "Remaining balance"}
                    </span>
                  </div>
                  <span className={cn("text-lg font-bold", change >= 0 ? "text-green-700" : "text-orange-700")}>
                    {formatCurrency(Math.abs(change))}
                  </span>
                </div>
              </div>
            </div>

            <DialogFooter className="p-6 bg-muted/30 border-t">
              <Button variant="ghost" onClick={resetAndClose} className="flex-1 hover:bg-destructive/10 h-12 hover:text-destructive">Cancel</Button>
              <Button 
                variant="default"
                onClick={handlePayment} 
                className="flex-1 h-12 text-base font-bold"
                disabled={numericCash < total}
              >
                Confirm Payment
              </Button>
            </DialogFooter>
          </>
        ) : (
          /* Success State - Professional Receipt Look */
          <div className="p-8 text-center">
            <div className="mb-6 flex flex-col items-center">
              <div className="h-20 w-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="h-12 w-12 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold">Payment Successful</h2>
              <p className="text-muted-foreground">Transaction has been recorded</p>
            </div>

            <div className="bg-muted/50 rounded-xl p-6 space-y-4 border border-dashed border-muted-foreground/50">
               <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Amount</span>
                  <span className="font-semibold">{formatCurrency(transactionDetails?.total || 0)}</span>
               </div>
               <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Cash Received</span>
                  <span className="font-semibold">{formatCurrency(numericCash)}</span>
               </div>
               <Separator />
               <div className="flex justify-between items-center">
                  <span className="font-bold text-lg">Change</span>
                  <span className="text-2xl font-black text-primary">
                    {formatCurrency(transactionDetails?.change || 0)}
                  </span>
               </div>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-3">
              <Button variant="outline" className="gap-2" onClick={handlePrint}>
                <ReceiptText className="h-4 w-4" /> Print Receipt
              </Button>
              <Button onClick={resetAndClose} className="font-bold">
                New Order
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
