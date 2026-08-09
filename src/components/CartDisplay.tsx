import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollAreaHandle } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ParkingSquare, ShoppingCart, ReceiptText, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState, useMemo } from "react";
import { PaymentModal } from "./PaymentModal";
import { useToast } from "@/hooks/use-toast";
import { CartItem, Transaction, StoreConfig } from "@/lib/types";
import { AnimatePresence } from 'framer-motion';
import { CartItemRow } from './CartItemRow';
import { TransactionDisplay } from './TransactionDisplay';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { voidTransaction } from "@/services/transactionService";
import { Badge } from "./ui/badge";
import { useGlobalKeydown } from "@/hooks/use-global-keydown";

// Helper function for tax calculation
const getTaxRateForItem = (item: CartItem, storeConfig: StoreConfig): number => {
    const { tax_settings, tax_rate } = storeConfig;

    if (!tax_settings) {
        return tax_rate; // Fallback to old system
    }

    // 1. Check for category override
    if (item.category_id) {
        const categoryOverride = tax_settings.category_overrides.find(
            co => co.category_id === item.category_id
        );
        if (categoryOverride && typeof categoryOverride.tax_rate === 'number') {
            return categoryOverride.tax_rate;
        }
    }

    // 2. Fallback to default rate from new system
    return tax_settings.default_rate;
};

interface CartDisplayProps {
    onEditItem?: (item: CartItem) => void;
}

export function CartDisplay({ onEditItem }: CartDisplayProps) {
  const { cart, transactions, activeShift, parkCart, storeConfig } = useStore();
  const { toast } = useToast();

  const [view, setView] = useState<'cart' | 'history'>('cart');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  
  // Local state for reviewing transactions from history
  const [reviewingTransaction, setReviewingTransaction] = useState<Transaction | null>(null);
  const [reviewedItems, setReviewedItems] = useState<CartItem[]>([]);
  
  const [voidReason, setVoidReason] = useState("");

  const cartContainer = useRef<ScrollAreaHandle>(null);
  const cartDisplayRef = useRef<HTMLDivElement>(null);
  
  const shiftTransactions = transactions.filter(t => t.shift_id === activeShift?.id);
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const isReviewing = reviewingTransaction !== null;
  // If reviewing, show items from local state. Otherwise, show the live cart from global state.
  const itemsToDisplay = isReviewing ? reviewedItems : cart;

  // Calculate totals based on the currently displayed items (either real cart or reviewed transaction)
  const { subtotal, tax, total } = useMemo(() => {
    const currentItems = isReviewing ? reviewedItems : cart;
    const sub = currentItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    
    const taxAmount = currentItems.reduce((taxSum, item) => {
        if (!storeConfig) return taxSum + (item.price * item.quantity * 0.11); // Fallback
        const itemTaxRate = getTaxRateForItem(item, storeConfig);
        const itemTotal = item.price * item.quantity;
        return taxSum + (itemTotal * itemTaxRate);
    }, 0);

    const totalAmount = sub + taxAmount;
    return { subtotal: sub, tax: taxAmount, total: totalAmount };
  }, [isReviewing, reviewedItems, cart, storeConfig]);
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleProcessPayment = () => {
    if (!activeShift) {
      toast({
        variant: "destructive",
        title: "Sif Belum Dibuka",
        description: "Silakan buka sif sebelum memproses pembayaran.",
      });
      return;
    }
    setIsPaymentModalOpen(true);
  }

  useGlobalKeydown({
    key: 'space', 
    handler: () => {
      if (view === 'cart' && !isReviewing && cart.length > 0) {
        handleProcessPayment();
      }
    }, 
    enabled: true,
    bindTo: cartDisplayRef,
  });

  const handleReviewTransaction = (tx: Transaction) => {
    const itemsForReview = tx.items.map(txItem => ({
        ...txItem.product_snapshot,
        cartItemId: txItem.id, // Use the unique transaction item ID
        quantity: txItem.qty,
        price: txItem.price_snapshot,
        has_variant: false,
        track_stock: false,
        is_active: true,
        stock: 0,
    } as CartItem));

    setReviewedItems(itemsForReview); // Use local state
    setReviewingTransaction(tx);
    setView('cart');
  };

  const handleCancelReview = () => {
    setReviewedItems([]); // Clear local state
    setReviewingTransaction(null);
  };
  
  const handleVoid = async (): Promise<boolean> => {
    if (!reviewingTransaction || !voidReason.trim()) {
        toast({ variant: 'destructive', title: 'Alasan wajib diisi', description: 'Mohon berikan alasan pembatalan.' });
        return false;
    }
    try {
        await voidTransaction(reviewingTransaction.id, voidReason);
        toast({ title: 'Transaksi Dibatalkan', description: `Invoice ${reviewingTransaction.invoice_number} berhasil di-void.` });
        handleCancelReview(); // This now clears local state
        setView('history');
        return true;
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Gagal Void', description: error.message || 'Terjadi kesalahan.' });
        return false;
    }
  };

  useEffect(() => {
    if (!cartContainer.current || !cartContainer.current.viewport) return;
    
    const viewPort = cartContainer.current.viewport as HTMLDivElement;
    if (!viewPort) return;
    
    setTimeout(() => {
      // Only auto-scroll for the real cart, not for reviewed transactions
      if (cart.length > 3 && !isReviewing) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            viewPort.scrollTop = viewPort.scrollHeight;
          })
        });
      } 
    },150)

  },[cart.length, cartContainer.current, isReviewing])

  return (
    <div ref={cartDisplayRef} className="flex flex-col flex-1 h-full min-h-0">
      <header className="hidden md:flex h-11 items-center justify-between px-3 shrink-0 gap-1.5">
        <Button variant={view === 'cart' ? 'secondary' : 'ghost'} onClick={() => setView('cart')} className="flex-1">
            <ShoppingCart className="mr-2 h-4 w-4" />
            Keranjang
            {cartItemCount > 0 && !isReviewing && <Badge className="ml-2">{cartItemCount}</Badge>}
        </Button>
        <Button variant={view === 'history' ? 'secondary' : 'ghost'} onClick={() => setView('history')} className="flex-1">
            <ReceiptText className="mr-2 h-4 w-4" />
            Riwayat
            {shiftTransactions.length > 0 && <Badge variant="success" className="ml-2">{shiftTransactions.length}</Badge>}
        </Button>
      </header>
      
      {view === 'cart' && itemsToDisplay.length === 0 ? (
        <div className="py-6 px-6 flex-1 flex">
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center bg-card border rounded-lg">
            <ShoppingCart className="h-16 w-16 text-muted-foreground" />
            <h3 className="text-xl font-semibold">Keranjang Kosong</h3>
            <p className="text-muted-foreground">Pilih produk untuk menambahkannya ke keranjang.</p>
          </div>
        </div>
      ) : view === 'cart' ? (
        <>
        <div className="flex-1 min-h-0 px-4">
          <ScrollArea className="h-full min-h-0 border border-border bg-card rounded-lg"  ref={cartContainer}>
            <div className="flex flex-col gap-0 divide-y divide-border/40">
                <AnimatePresence initial={false}>
                    {itemsToDisplay.map(item => (
                       <CartItemRow 
                            key={item.cartItemId} 
                            item={item} 
                            onEditItem={isReviewing ? undefined : onEditItem} 
                            isReadOnly={isReviewing}
                        />
                    ))}
                </AnimatePresence>
            </div>
          </ScrollArea>
        </div>
        </>
      ) : (
        <TransactionDisplay onSelectTransaction={handleReviewTransaction} />
      )}

      <footer className="p-4 md:p-6 shrink-0">
        {view === 'cart' && itemsToDisplay.length > 0 && (
            <>
                <div className="space-y-2">
                    <div className="flex justify-between">
                        <span>Subtotal</span>
                        <span>{formatCurrency(subtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Pajak</span>
                        <span>{formatCurrency(tax)}</span>
                    </div>
                    <Separator className="my-2"/>
                    <div className="flex justify-between text-lg font-bold">
                        <span>Total</span>
                        <span>{formatCurrency(total)}</span>
                    </div>
                </div>
                <div className="mt-4 flex gap-2">
                    {isReviewing ? (
                        <>
                            {reviewingTransaction?.status !== 'voided' && (
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="destructive" size="lg" className="flex-1">
                                            <Trash2 className="mr-2"/> Void Transaksi
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Void Invoice {reviewingTransaction?.invoice_number}?</AlertDialogTitle>
                                            <AlertDialogDescription>Tindakan ini akan membatalkan penjualan dan mengembalikan stok. Tidak dapat dibatalkan.</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <div className="py-4">
                                            <Label htmlFor="void-reason">Alasan Void</Label>
                                            <Input id="void-reason" value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="Cth: Pelanggan batal" className="mt-2" />
                                        </div>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Batal</AlertDialogCancel>
                                            <AlertDialogAction onClick={handleVoid}>Konfirmasi Void</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            )}
                            <Button variant="outline" size="lg" className="flex-1" onClick={handleCancelReview}>
                                <X className="mr-2"/> Tutup
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button variant="outline" size="lg" className="flex-1" onClick={parkCart} disabled={cart.length === 0}>
                                <ParkingSquare /> Parkir
                            </Button>
                            <Button className="flex-1" size="lg" onClick={handleProcessPayment} disabled={!activeShift || cart.length === 0}>
                                Bayar
                            </Button>
                        </>
                    )}
                </div>
            </>
        )}
      </footer>
      <PaymentModal isOpen={isPaymentModalOpen} setIsOpen={setIsPaymentModalOpen} total={total} />
    </div>
  );
}
