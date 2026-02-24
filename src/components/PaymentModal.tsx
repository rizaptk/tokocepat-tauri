"use client";

import { useState, useEffect } from 'react';
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
import { useStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, XCircle } from 'lucide-react';
import { Transaction } from '@/lib/types';

type PaymentModalProps = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  total: number;
};

type PaymentStatus = 'pending' | 'success' | 'insufficient';

export function PaymentModal({ isOpen, setIsOpen, total }: PaymentModalProps) {
  const [cashReceived, setCashReceived] = useState('');
  const [status, setStatus] = useState<PaymentStatus>('pending');
  const [transactionDetails, setTransactionDetails] = useState<{ change: number; total: number} | null>(null);
  const checkout = useStore((state) => state.checkout);
  const { toast } = useToast();
  
  const change = parseFloat(cashReceived) - total;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handlePayment = async () => {
    const cash = parseFloat(cashReceived);
    if (isNaN(cash) || cash < total) {
      toast({
        variant: "destructive",
        title: "Insufficient Payment",
        description: "Cash received is less than the total amount.",
      });
      setStatus('insufficient');
      return;
    }

    const transaction = await checkout(cash);
    if (transaction) {
      setStatus('success');
      setTransactionDetails({ change: transaction.change, total: transaction.total });
    }
  };
  
  const resetAndClose = () => {
    setCashReceived('');
    setStatus('pending');
    setTransactionDetails(null);
    setIsOpen(false);
  }
  
  // Reset state when modal is closed
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setCashReceived('');
        setStatus('pending');
        setTransactionDetails(null);
      }, 300);
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
        {status === 'pending' && (
           <>
            <DialogHeader>
              <DialogTitle>Cash Payment</DialogTitle>
              <DialogDescription>Enter the amount of cash received from the customer.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Total Amount Due</p>
                <p className="text-4xl font-bold">{formatCurrency(total)}</p>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="cash-received" className="text-right">
                  Cash
                </Label>
                <Input
                  id="cash-received"
                  type="number"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  className="col-span-3"
                  placeholder="e.g. 100000"
                  autoFocus
                />
              </div>
              {change >= 0 && (
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Change Due</p>
                  <p className="text-2xl font-semibold text-primary">{formatCurrency(change)}</p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" onClick={handlePayment}>Confirm Payment</Button>
            </DialogFooter>
           </>
        )}
        
        {status === 'success' && transactionDetails && (
          <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
            <CheckCircle className="h-20 w-20 text-green-500" />
            <h2 className="text-2xl font-bold">Payment Successful</h2>
            <div className="w-full space-y-2 text-left text-sm">
                <div className="flex justify-between"><span>Total:</span> <span>{formatCurrency(transactionDetails.total)}</span></div>
                <div className="flex justify-between"><span>Cash Paid:</span> <span>{formatCurrency(parseFloat(cashReceived))}</span></div>
                <div className="flex justify-between font-bold text-lg text-primary"><span>Change:</span> <span>{formatCurrency(transactionDetails.change)}</span></div>
            </div>
            <Button onClick={resetAndClose} className="mt-4 w-full">New Transaction</Button>
          </div>
        )}
        
        {status === 'insufficient' && (
          <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
              <XCircle className="h-20 w-20 text-destructive" />
              <h2 className="text-2xl font-bold">Insufficient Funds</h2>
              <p className="text-muted-foreground">The cash provided is not enough to cover the total amount.</p>
              <Button onClick={() => setStatus('pending')} className="mt-4 w-full">Try Again</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
