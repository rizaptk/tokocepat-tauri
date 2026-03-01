
"use client";
    
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ParkingSquare, ShoppingCart } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PaymentModal } from "./PaymentModal";
import { useToast } from "@/hooks/use-toast";
import { CartItem } from "@/lib/types";
import { AnimatePresence } from 'framer-motion';
import { CartItemRow } from './CartItemRow';

interface CartDisplayProps {
    onEditItem?: (item: CartItem) => void;
}

export function CartDisplay({ onEditItem }: CartDisplayProps) {
  const cart = useStore((state) => state.cart);
  const activeShift = useStore((state) => state.activeShift);
  const storeConfig = useStore((state) => state.storeConfig);
  const parkCart = useStore(state => state.parkCart);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const { toast } = useToast();

  const cartContainer = useRef<HTMLDivElement>(null);

  const taxRate = storeConfig?.tax_rate ?? 0.11;
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const tax = subtotal * taxRate;
  const total = subtotal + tax;
  
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

  useEffect(() => {
    if (!cartContainer.current) return;
    
    const viewPort = cartContainer.current.querySelector("[data-radix-scroll-area-viewport]") as HTMLDivElement;
    if (!viewPort) return;
    
    setTimeout(() => {
      if (cart.length > 3) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            viewPort.scrollTop = viewPort.scrollHeight;
          })
        });
      } 
    },150)

  },[cart.length, cartContainer.current])

  return (
    <div className="flex flex-col flex-1 h-full min-h-0">
      <header className="hidden md:flex h-16 items-center justify-between px-6 shrink-0">
        <h2 className="text-lg font-semibold">Cart</h2>
        <div className="relative">
          <ShoppingCart className="h-6 w-6" />
          {cart.length > 0 && (
            <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
              {cart.reduce((sum, item) => sum + item.quantity, 0)}
            </span>
          )}
        </div>
      </header>
      
      {cart.length === 0 ? (
        <div className="py-6 px-6 flex-1 flex">
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center bg-card border rounded-lg">
            <ShoppingCart className="h-16 w-16 text-muted-foreground" />
            <h3 className="text-xl font-semibold">Your cart is empty</h3>
            <p className="text-muted-foreground">Tap on products to add them to the cart.</p>
          </div>
        </div>
      ) : (
        <>
        <div className="flex-1 min-h-0 px-4">
          <ScrollArea className="h-full min-h-0 border border-border bg-card rounded-lg"  ref={cartContainer}>
            <div className="flex flex-col gap-0 divide-y divide-border/40">
                <AnimatePresence initial={false}>
                    {cart.map(item => (
                       <CartItemRow key={item.cartItemId} item={item} onEditItem={onEditItem} />
                    ))}
                </AnimatePresence>
            </div>
          </ScrollArea>
        </div>
          <footer className="p-4 md:p-6 shrink-0">
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
                <Button variant="outline" size="lg" className="flex-1" onClick={parkCart} disabled={cart.length === 0}>
                    <ParkingSquare /> Park
                </Button>
                <Button className="flex-1" size="lg" onClick={handleProcessPayment} disabled={!activeShift || cart.length === 0}>
                    Process Payment
                </Button>
            </div>
          </footer>
        </>
      )}
      <PaymentModal isOpen={isPaymentModalOpen} setIsOpen={setIsPaymentModalOpen} total={total} />
    </div>
  );
}
