"use client";

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Product, CartItem, Transaction } from '@/lib/types';
import { initialProducts } from '@/lib/products';
import { toast } from '@/hooks/use-toast';

const TAX_RATE = 0.11; // PPN 11%

interface StoreState {
  products: Product[];
  cart: CartItem[];
  transactions: Transaction[];
  beginningBalance: number;
  addToCart: (product: Product) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  checkout: (cashReceived: number) => Transaction | null;
  setBeginningBalance: (amount: number) => void;
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      products: initialProducts,
      cart: [],
      transactions: [],
      beginningBalance: 0,
    
      addToCart: (product: Product) => {
        const { products, cart } = get();
        const productInState = products.find(p => p.id === product.id);
        if (!productInState || productInState.stock <= 0) {
          toast({ variant: 'destructive', description: `${product.name} is out of stock.` });
          return;
        }
    
        const existingItem = cart.find(item => item.id === product.id);
        if (existingItem) {
            if (existingItem.quantity < productInState.stock) {
                set({
                    cart: cart.map(item =>
                        item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
                    )
                });
            } else {
                toast({ variant: 'destructive', description: `No more stock for ${product.name}.` });
            }
        } else {
            set({
                cart: [...cart, { ...product, quantity: 1 }]
            });
        }
      },
    
      removeFromCart: (productId: string) => {
        set(state => ({
            cart: state.cart.filter(item => item.id !== productId)
        }));
      },
    
      updateQuantity: (productId: string, quantity: number) => {
        const { products, cart } = get();
        const product = products.find(p => p.id === productId);
        if (!product) return;
    
        if (isNaN(quantity) || quantity < 1) {
            set({
                cart: cart.filter(item => item.id !== productId)
            });
            return;
        }
    
        let newQuantity = quantity;
        if (quantity > product.stock) {
            toast({ variant: 'destructive', description: `Only ${product.stock} items of ${product.name} in stock.`});
            newQuantity = product.stock;
        }
        
        set({
            cart: cart.map(item =>
                item.id === productId ? { ...item, quantity: newQuantity } : item
            )
        });
      },
    
      clearCart: () => {
        set({ cart: [] });
      },
      
      setBeginningBalance: (amount: number) => {
        set({ beginningBalance: amount < 0 ? 0 : amount });
      },
    
      checkout: (cashReceived: number): Transaction | null => {
        const { cart, products } = get();
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
    
        const updatedProducts = [...products];
        cart.forEach(cartItem => {
            const productIndex = updatedProducts.findIndex(p => p.id === cartItem.id);
            if (productIndex !== -1) {
                updatedProducts[productIndex].stock -= cartItem.quantity;
            }
        });
        
        set(state => ({
            transactions: [newTransaction, ...state.transactions],
            products: updatedProducts,
            cart: []
        }));
        
        return newTransaction;
      },
    }),
    {
      name: 'tokoc-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
