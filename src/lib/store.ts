
"use client";

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Product, CartItem, Transaction, Category, ModifierGroup, ProductVariant, Shift, StoreConfig } from '@/lib/types';
import { toast } from '@/hooks/use-toast';
import { openShift as openShiftService, closeShift as closeShiftService } from '@/services/shiftService';
import { createTransaction } from '@/services/transactionService';

interface StoreState {
  products: Product[];
  categories: Category[];
  modifierGroups: ModifierGroup[];
  productVariants: ProductVariant[];
  cart: CartItem[];
  transactions: Transaction[];
  shifts: Shift[];
  activeShift: Shift | null;
  storeConfig: StoreConfig | null;
  
  // Actions
  setProducts: (products: Product[]) => void;
  setCategories: (categories: Category[]) => void;
  setModifierGroups: (modifierGroups: ModifierGroup[]) => void;
  setProductVariants: (productVariants: ProductVariant[]) => void;
  setTransactions: (transactions: Transaction[]) => void;
  setShifts: (shifts: Shift[]) => void;
  setStoreConfig: (config: StoreConfig) => void;
  addToCart: (product: Product) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  checkout: (cashReceived: number) => Promise<Transaction | null>;
  openShift: (openingCash: number) => Promise<void>;
  closeShift: (declaredCash: number) => Promise<void>;
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      products: [],
      categories: [],
      modifierGroups: [],
      productVariants: [],
      cart: [],
      transactions: [],
      shifts: [],
      activeShift: null,
      storeConfig: null,
    
      setProducts: (products) => set({ products }),
      setCategories: (categories) => set({ categories }),
      setModifierGroups: (modifierGroups) => set({ modifierGroups }),
      setProductVariants: (productVariants) => set({ productVariants }),
      setTransactions: (transactions) => set({ transactions: transactions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) }),
      setShifts: (shifts) => {
        const sortedShifts = shifts.sort((a, b) => new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime());
        const activeShift = sortedShifts.find(s => s.status === 'open') || null;
        set({ shifts: sortedShifts, activeShift });
      },
      setStoreConfig: (config) => set({ storeConfig: config }),
    
      addToCart: (product: Product) => {
        const { products, cart, activeShift } = get();

        if (!activeShift) {
          toast({
            variant: 'destructive',
            title: 'Shift Not Open',
            description: 'Please open a shift before making a sale.',
          });
          return;
        }

        const productInState = products.find(p => p.id === product.id);

        if (!productInState || !productInState.is_active) {
          toast({ variant: 'destructive', description: `${product.name} is not available.` });
          return;
        }
    
        if (productInState.track_stock && productInState.stock <= 0) {
          toast({ variant: 'destructive', description: `${product.name} is out of stock.` });
          return;
        }
    
        const existingItem = cart.find(item => item.id === product.id);
        if (existingItem) {
            if (!productInState.track_stock || existingItem.quantity < productInState.stock) {
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
        if (product.track_stock && quantity > product.stock) {
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
      
      openShift: async (openingCash: number) => {
        if (get().activeShift) return;
        try {
            await openShiftService(openingCash);
        } catch (error) {
            console.error("Failed to open shift:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not open a new shift." });
        }
      },
      
      closeShift: async (declaredCash: number) => {
        const { activeShift, transactions } = get();
        if (!activeShift) return;

        try {
            await closeShiftService(activeShift, transactions, declaredCash);
        } catch (error) {
            console.error("Failed to close shift:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not close the shift." });
        }
      },

      checkout: async (cashReceived: number): Promise<Transaction | null> => {
        const { cart, activeShift, storeConfig } = get();
        
        if (!activeShift || !storeConfig) {
            toast({ variant: 'destructive', title: 'Error', description: 'Cannot process payment. Shift or store config is missing.' });
            return null;
        }

        try {
            const newTransaction = await createTransaction(cart, activeShift, storeConfig, cashReceived);
            if (newTransaction) {
                set({ cart: [] }); // Clear cart on successful transaction
            }
            return newTransaction;
        } catch(error) {
            console.error("Checkout failed:", error);
            toast({ variant: "destructive", title: "Checkout Error", description: "The transaction could not be completed." });
            return null;
        }
      },
    }),
    {
      name: 'tokoc-storage',
      storage: createJSONStorage(() => localStorage),
       partialize: (state) =>
        Object.fromEntries(
          Object.entries(state).filter(([key]) => !['products', 'transactions', 'modifierGroups', 'productVariants', 'categories', 'shifts', 'activeShift', 'storeConfig'].includes(key))
        ),
    }
  )
);
