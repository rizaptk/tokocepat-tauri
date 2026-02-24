
"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";
import { ShoppingCart } from "lucide-react";
import { useStore } from "@/lib/store";
import { CartDisplay } from "./CartDisplay";

export function MobileCart() {
    const cart = useStore((state) => state.cart);
    const [isOpen, setIsOpen] = useState(false);

    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

    return (
        <div className="md:hidden">
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
                <SheetTrigger asChild>
                    <Button className="fixed bottom-20 right-4 z-30 h-14 w-14 rounded-full shadow-lg">
                        <ShoppingCart className="h-6 w-6" />
                        {totalItems > 0 && (
                            <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary-foreground text-sm font-bold text-primary border-2 border-primary">
                                {totalItems}
                            </span>
                        )}
                        <span className="sr-only">View Cart</span>
                    </Button>
                </SheetTrigger>
                <SheetContent className="flex flex-col p-0">
                    <CartDisplay onCheckout={() => setIsOpen(false)} />
                </SheetContent>
            </Sheet>
        </div>
    )
}
