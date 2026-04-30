import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
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
import { CheckCircle2, AlertCircle, Banknote, Delete} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePrintStore } from '@/lib/print-store';
import { useGlobalKeydown } from '@/hooks/use-global-keydown';
import { useGlobalNumberInputFix } from '@/hooks/useGlobalNumberInputFix';
import { useCurrencyFormat } from '@/hooks/useCurrencyFormat';

type PaymentModalProps = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  total: number;
};

type PaymentStatus = 'pending' | 'success';

export function PaymentModal({ isOpen, setIsOpen, total }: PaymentModalProps) {
  const [cashReceived, setCashReceived] = useState<string>('');
  const [status, setStatus] = useState<PaymentStatus>('pending');
  const dialogContentRef = useRef<HTMLDivElement>(null);

  const { checkout } = useStore();
  const { addToQueue } = usePrintStore();
  const { toast } = useToast();
  const curr = useCurrencyFormat();

  const numericCash = parseFloat(cashReceived) || 0;
  const change = numericCash - total;
  const isInsufficient = numericCash < total && numericCash > 0;

  useGlobalNumberInputFix();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const suggestions = useMemo(() => {
    if (!total || total <= 0) return [];

    const ceil20 = Math.ceil(total / 20000) * 20000;
    const ceil50 = Math.ceil(total / 50000) * 50000;

    const remainder100 = total % 100000;

    if (remainder100 >= 120000 - 100000 && remainder100 < 50000) {
      return [total, ceil50];
    }

    const diffTo50 = ceil50 - total;

    if (diffTo50 <= 5000) {
      return [total, ceil50];
    }

    const result: number[] = [];

    result.push(ceil20);

    if (ceil50 !== ceil20) {
      result.push(ceil50);
    }

    const alldenom = result.slice(0, 2);
    const final = [total, ...alldenom]

    return final;
  }, [total]);

  useEffect(() => {
    setCashReceived(curr.raw);
  },[curr.raw])

  const handlePayment = useCallback(async () => {
    if (numericCash < total) {
      toast({
        variant: "destructive",
        title: "Payment Error",
        description: "Amount received is less than total due.",
      });
      return;
    }

    // fire and forget process
    checkout(numericCash);
    setStatus('success');
    resetAndClose();
  }, [checkout, numericCash, total, toast, addToQueue]);

  const resetAndClose = useCallback(() => {
    setIsOpen(false);
    setTimeout(() => {
      // setCashReceived('');
      curr.setRaw('0');
      setStatus('pending');
    }, 200);
  }, [setIsOpen]);

  const handleEnter = useCallback(() => {
    if (status === 'pending') {
      if (numericCash >= total) {
        handlePayment();
      }
    } else if (status === 'success') {
      resetAndClose();
    }
  }, [status, numericCash, total, handlePayment, resetAndClose]);

  useGlobalKeydown({
    key: 'enter',
    handler: handleEnter,
    enabled: isOpen,
    bindTo: dialogContentRef
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && resetAndClose()}>
      <DialogContent ref={dialogContentRef} className="sm:max-w-120 p-0 overflow-hidden gap-0 bg-card">
        {status === 'pending' && (
          <>
            <div className="p-6 pb-4">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-xl">
                  <Banknote className="h-5 w-5 text-primary" />
                  Proses Pembayaran
                </DialogTitle>
                <DialogDescription>
                  Selesaikan transaksi dengan memasukkan jumlah uang tunai.
                </DialogDescription>
              </DialogHeader>

              <div className="mt-6 space-y-6">
                <div className="bg-muted/50 rounded-xl p-4 flex justify-between items-center border">
                  <span className="text-sm font-medium text-muted-foreground">Total Tagihan</span>
                  <span className="text-2xl font-bold tracking-tight">{formatCurrency(total)}</span>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="cash" className="text-sm font-semibold">Uang Diterima (Bayar)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">Rp</span>
                    <Input
                      id="cash"
                      type="text"
                      inputMode='numeric'
                      className={cn(
                        "pl-10 text-xl h-14 font-semibold transition-all",
                        isInsufficient && "border-destructive focus-visible:ring-destructive",
                        numericCash >= total && "border-green-500 focus-visible:ring-green-500"
                      )}
                      value={curr.value}
                      onChange={curr.onChange}
                      placeholder="0"
                      autoFocus
                      enable-global-keydown="true"
                    />
                    {cashReceived && (
                      <button
                        onClick={() => curr.setRaw('0')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <Delete className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className={`grid ${suggestions.length > 2 ? 'grid-cols-3' : 'grid-cols-2'} gap-2`}>
                  {suggestions.map((amt) => (
                    <Button
                      key={amt}
                      variant="outline"
                      type="button"
                      className="h-12 font-semibold hover:border-primary hover:bg-primary/5"
                      onClick={() => curr.setRaw(amt.toString())}
                    >
                      {amt === total ? "Uang Pas" : formatCurrency(amt)}
                    </Button>
                  ))}
                </div>

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
                      {change >= 0 ? "Kembalian" : "Kurang"}
                    </span>
                  </div>
                  <span className={cn("text-lg font-bold", change >= 0 ? "text-green-700" : "text-orange-700")}>
                    {formatCurrency(Math.abs(change))}
                  </span>
                </div>
              </div>
            </div>

            <DialogFooter className="p-6 bg-muted/30 border-t">
              <Button variant="ghost" onClick={resetAndClose} className="flex-1 hover:bg-destructive/10 h-12 hover:text-destructive">Batal</Button>
              <Button
                variant="default"
                onClick={handlePayment}
                className="flex-1 h-12 text-base font-bold"
                disabled={numericCash < total}
              >
                Konfirmasi Bayar
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
