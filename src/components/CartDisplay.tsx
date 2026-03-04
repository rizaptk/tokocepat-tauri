
"use client";
    
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollAreaHandle } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ParkingSquare, ShoppingCart, ReceiptText, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState, useMemo } from "react";
import { PaymentModal } from "./PaymentModal";
import { useToast } from "@/hooks/use-toast";
import { CartItem, Transaction } from "@/lib/types";
import { AnimatePresence } from 'framer-motion';
import { CartItemRow } from './CartItemRow';
import { TransactionDisplay } from './TransactionDisplay';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { voidTransaction } from "@/services/transactionService";
import { Badge } from "./ui/badge";

interface CartDisplayProps {
    onEditItem?: (item: CartItem) => void;
}

export function CartDisplay({ onEditItem }: CartDisplayProps) {
  const { cart, transactions, activeShift, parkCart } = useStore();
  const { toast } = useToast();

  const [view, setView] = useState<'cart' | 'history'>('cart');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  
  // Local state for reviewing transactions from history
  const [reviewingTransaction, setReviewingTransaction] = useState<Transaction | null>(null);
  const [reviewedItems, setReviewedItems] = useState<CartItem[]>([]);
  
  const [voidReason, setVoidReason] = useState("");

  const cartContainer = useRef<ScrollAreaHandle>(null);
  
  const shiftTransactions = transactions.filter(t => t.shift_id === activeShift?.id);
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const isReviewing = reviewingTransaction !== null;
  // If reviewing, show items from local state. Otherwise, show the live cart from global state.
  const itemsToDisplay = isReviewing ? reviewedItems : cart;

  const taxRate = useStore.getState().storeConfig?.tax_rate ?? 0.11;

  // Calculate totals based on the currently displayed items (either real cart or reviewed transaction)
  const { subtotal, tax, total } = useMemo(() => {
    const currentItems = isReviewing ? reviewedItems : cart;
    const sub = currentItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const taxAmount = sub * taxRate;
    const totalAmount = sub + taxAmount;
    return { subtotal: sub, tax: taxAmount, total: totalAmount };
  }, [isReviewing, reviewedItems, cart, taxRate]);
  
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
        title: "Shift Not Open",
        description: "Please open a shift before processing a payment.",
      });
      return;
    }
    setIsPaymentModalOpen(true);
  }

  const handleReviewTransaction = (tx: Transaction) => {
    const itemsForReview = tx.items.map(txItem => ({
        ...txItem.product_snapshot,
        cartItemId: txItem.id, // Use the unique transaction item ID
        quantity: txItem.qty,
        price: txItem.price_snapshot,
        selectedModifiers: txItem.selected_modifiers_snapshot || [],
        has_variant: false, 
        has_modifier: (txItem.selected_modifiers_snapshot || []).length > 0,
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
        toast({ variant: 'destructive', title: 'Reason required', description: 'Please provide a reason for voiding.' });
        return false;
    }
    try {
        await voidTransaction(reviewingTransaction.id, voidReason);
        toast({ title: 'Transaction Voided', description: `Invoice ${reviewingTransaction.invoice_number} has been voided.` });
        handleCancelReview(); // This now clears local state
        setView('history');
        return true;
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Void Failed', description: error.message || 'An unknown error occurred.' });
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
    <div className="flex flex-col flex-1 h-full min-h-0">
      <header className="hidden md:flex h-16 items-center justify-between px-6 shrink-0 gap-2">
        <Button variant={view === 'cart' ? 'secondary' : 'ghost'} onClick={() => setView('cart')} className="flex-1">
            <ShoppingCart className="mr-2 h-4 w-4" />
            Cart
            {cartItemCount > 0 && !isReviewing && <Badge className="ml-2">{cartItemCount}</Badge>}
        </Button>
        <Button variant={view === 'history' ? 'secondary' : 'ghost'} onClick={() => setView('history')} className="flex-1">
            <ReceiptText className="mr-2 h-4 w-4" />
            History
            {shiftTransactions.length > 0 && <Badge variant="success" className="ml-2">{shiftTransactions.length}</Badge>}
        </Button>
      </header>
      
      {view === 'cart' && itemsToDisplay.length === 0 ? (
        <div className="py-6 px-6 flex-1 flex">
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center bg-card border rounded-lg">
            <ShoppingCart className="h-16 w-16 text-muted-foreground" />
            <h3 className="text-xl font-semibold">Your cart is empty</h3>
            <p className="text-muted-foreground">Tap on products to add them to the cart.</p>
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
                        <span>Tax ({Math.round(taxRate * 100)}%)</span>
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
                                            <Trash2 className="mr-2"/> Void Transaction
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Void Invoice {reviewingTransaction?.invoice_number}?</AlertDialogTitle>
                                            <AlertDialogDescription>This will reverse the sale, return items to stock, and cannot be undone.</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <div className="py-4">
                                            <Label htmlFor="void-reason">Reason for Voiding</Label>
                                            <Input id="void-reason" value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="e.g. Customer canceled" className="mt-2" />
                                        </div>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={handleVoid}>Confirm Void</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            )}
                            <Button variant="outline" size="lg" className="flex-1" onClick={handleCancelReview}>
                                <X className="mr-2"/> Close
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button variant="outline" size="lg" className="flex-1" onClick={parkCart} disabled={cart.length === 0}>
                                <ParkingSquare /> Park
                            </Button>
                            <Button className="flex-1" size="lg" onClick={handleProcessPayment} disabled={!activeShift || cart.length === 0}>
                                Process Payment
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
