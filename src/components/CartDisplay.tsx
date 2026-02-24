
"use client";
    
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ShoppingCart, Trash2 } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { PaymentModal } from "./PaymentModal";
import { useToast } from "@/hooks/use-toast";

export function CartDisplay() {
  const cart = useStore((state) => state.cart);
  const activeShift = useStore((state) => state.activeShift);
  const storeConfig = useStore((state) => state.storeConfig);
  const removeFromCart = useStore((state) => state.removeFromCart);
  const updateQuantity = useStore((state) => state.updateQuantity);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const { toast } = useToast();

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

  return (
    <>
      <header className="flex h-16 items-center justify-between border-b px-6 shrink-0">
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
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
          <ShoppingCart className="h-16 w-16 text-muted-foreground" />
          <h3 className="text-xl font-semibold">Your cart is empty</h3>
          <p className="text-muted-foreground">Tap on products to add them to the cart.</p>
        </div>
      ) : (
        <>
          <ScrollArea className="flex-1">
            <div className="flex flex-col gap-4 p-4">
              {cart.map(item => (
                <div key={item.id} className="flex items-center gap-4">
                  <div className="relative h-16 w-16 overflow-hidden rounded-md">
                    <Image src={item.imageUrl} alt={item.name} fill className="object-cover" data-ai-hint={item.imageHint} />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-muted-foreground">{formatCurrency(item.price)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={item.quantity}
                      onChange={e => updateQuantity(item.id, parseInt(e.target.value))}
                      className="h-8 w-16 text-center"
                      min="1"
                      max={item.stock}
                    />
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeFromCart(item.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
          <footer className="border-t p-6 shrink-0">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax ({Math.round(taxRate * 100)}%)</span>
                <span>{formatCurrency(tax)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>
            <Button className="mt-4 w-full" size="lg" onClick={handleProcessPayment} disabled={!activeShift}>
              Process Payment
            </Button>
          </footer>
        </>
      )}
      <PaymentModal isOpen={isPaymentModalOpen} setIsOpen={setIsPaymentModalOpen} total={total} />
    </>
  );
}
