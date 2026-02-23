"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Product, CartItem, Transaction } from '@/lib/types';
import { initialProducts } from '@/lib/products';
import { useToast } from '@/hooks/use-toast';
import { TokoCepatLogo } from '@/components/TokoCepatLogo';

interface StoreState {
  products: Product[];
  cart: CartItem[];
  transactions: Transaction[];
  addToCart: (product: Product) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  checkout: (cashReceived: number) => Transaction | null;
  beginningBalance: number;
  setBeginningBalance: (amount: number) => void;
}

const StoreContext = createContext<StoreState | undefined>(undefined);

const TAX_RATE = 0.11; // PPN 11%

export const StoreProvider = ({ children }: { children: ReactNode }) => {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [beginningBalance, setBeginningBalanceState] = useState<number>(0);
  const [isMounted, setIsMounted] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    try {
      const storedProducts = localStorage.getItem('tokoc_products');
      setProducts(storedProducts ? JSON.parse(storedProducts) : initialProducts);
      
      const storedCart = localStorage.getItem('tokoc_cart');
      setCart(storedCart ? JSON.parse(storedCart) : []);

      const storedTransactions = localStorage.getItem('tokoc_transactions');
      setTransactions(storedTransactions ? JSON.parse(storedTransactions) : []);

      const storedBalance = localStorage.getItem('tokoc_balance');
      setBeginningBalanceState(storedBalance ? JSON.parse(storedBalance) : 0);
    } catch (error) {
      console.error("Failed to parse from localStorage", error);
    }
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted) {
      localStorage.setItem('tokoc_products', JSON.stringify(products));
      localStorage.setItem('tokoc_cart', JSON.stringify(cart));
      localStorage.setItem('tokoc_transactions', JSON.stringify(transactions));
      localStorage.setItem('tokoc_balance', JSON.stringify(beginningBalance));
    }
  }, [products, cart, transactions, beginningBalance, isMounted]);

  const addToCart = (product: Product) => {
    const productInState = products.find(p => p.id === product.id);
    if (!productInState || productInState.stock <= 0) {
      toast({ variant: 'destructive', description: `${product.name} is out of stock.` });
      return;
    }

    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.id === product.id);
      if (existingItem) {
        if (existingItem.quantity < productInState.stock) {
            return prevCart.map(item =>
                item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
            );
        } else {
            toast({ variant: 'destructive', description: `No more stock for ${product.name}.` });
            return prevCart;
        }
      } else {
         return [...prevCart, { ...product, quantity: 1 }];
      }
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prevCart => prevCart.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    setCart(prevCart => {
        const product = products.find(p => p.id === productId);
        if (!product) return prevCart;

        if (isNaN(quantity) || quantity < 1) {
            return prevCart.filter(item => item.id !== productId);
        }

        if (quantity > product.stock) {
            toast({ variant: 'destructive', description: `Only ${product.stock} items of ${product.name} in stock.`});
            quantity = product.stock;
        }
        
        return prevCart.map(item =>
            item.id === productId ? { ...item, quantity } : item
        );
    });
  };

  const clearCart = () => {
    setCart([]);
  };
  
  const setBeginningBalance = (amount: number) => {
    setBeginningBalanceState(amount < 0 ? 0 : amount);
  };

  const checkout = (cashReceived: number): Transaction | null => {
    if (cart.length === 0) return null;

    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const tax = subtotal * TAX_RATE;
    const total = subtotal + tax;

    if (cashReceived < total) {
      return null; // Insufficient cash
    }

    const newTransaction: Transaction = {
      id: new Date().toISOString(),
      items: cart,
      subtotal,
      tax,
      total,
      cashReceived,
      change: cashReceived - total,
      date: new Date().toISOString(),
    };

    setTransactions(prev => [newTransaction, ...prev]);

    setProducts(prevProducts => {
        const updatedProducts = [...prevProducts];
        cart.forEach(cartItem => {
            const productIndex = updatedProducts.findIndex(p => p.id === cartItem.id);
            if (productIndex !== -1) {
                updatedProducts[productIndex].stock -= cartItem.quantity;
            }
        });
        return updatedProducts;
    });
    
    clearCart();
    return newTransaction;
  };

  if (!isMounted) {
    return (
        <div className="flex h-screen w-full items-center justify-center">
            <TokoCepatLogo />
        </div>
    );
  }

  return (
    <StoreContext.Provider value={{ products, cart, transactions, addToCart, removeFromCart, updateQuantity, clearCart, checkout, beginningBalance, setBeginningBalance }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (context === undefined) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};
