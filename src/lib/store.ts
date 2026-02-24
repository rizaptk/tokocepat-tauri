
"use client";

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Product, CartItem, Transaction, Category, ModifierGroup, ProductVariant, Shift, StoreConfig, SelectedModifier } from '@/lib/types';
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
  activeShift: Shift | null | undefined;
  storeConfig: StoreConfig | null;
  
  // Actions
  setProducts: (products: Product[]) => void;
  setCategories: (categories: Category[]) => void;
  setModifierGroups: (modifierGroups: ModifierGroup[]) => void;
  setProductVariants: (productVariants: ProductVariant[]) => void;
  setTransactions: (transactions: Transaction[]) => void;
  setShifts: (shifts: Shift[]) => void;
  setStoreConfig: (config: StoreConfig) => void;
  saveItemToCart: (itemData: Product | CartItem, selectedModifiers?: SelectedModifier[]) => void;
  removeFromCart: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
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
      activeShift: undefined,
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
    
      saveItemToCart: (itemData: Product | CartItem, selectedModifiers: SelectedModifier[] = []) => {
        const { products, cart, activeShift } = get();

        if (!activeShift) {
          toast({
            variant: 'destructive',
            title: 'Shift Not Open',
            description: 'Please open a shift before making a sale.',
          });
          return;
        }

        const isEditing = 'cartItemId' in itemData;

        // For simple products (no modifiers), check if it already exists and stack it.
        const isModified = selectedModifiers.length > 0;
        if (!isModified && !isEditing) {
            const existingItem = cart.find(item => item.id === itemData.id && (!item.selectedModifiers || item.selectedModifiers.length === 0));
            if (existingItem) {
                get().updateQuantity(existingItem.cartItemId, existingItem.quantity + 1);
                toast({
                  title: "Quantity Updated",
                  description: `${itemData.name} quantity increased to ${existingItem.quantity + 1}.`,
                });
                return;
            }
        }
        
        let finalPrice = itemData.price;
        if ('cartItemId' in itemData) { // If editing, use the base product price, not the old cart item price
            const originalProduct = products.find(p => p.id === itemData.id);
            finalPrice = originalProduct?.price || itemData.price;
        } else {
            finalPrice = itemData.price;
        }

        if (isModified) {
            finalPrice += selectedModifiers.reduce((sum, mod) => sum + mod.item.additional_price, 0);
        }

        if (isEditing) {
             set(state => ({
                cart: state.cart.map(item =>
                    item.cartItemId === (itemData as CartItem).cartItemId
                    ? { ...item, selectedModifiers, price: finalPrice }
                    : item
                ),
            }));
            toast({
              title: "Item Updated",
              description: `${itemData.name} has been updated in your cart.`,
            });
        } else {
            const productInState = products.find(p => p.id === itemData.id);
            if (!productInState || !productInState.is_active) {
              toast({ variant: 'destructive', description: `${itemData.name} is not available.` });
              return;
            }
            if (productInState.track_stock && productInState.stock <= 0) {
              toast({ variant: 'destructive', description: `${itemData.name} is out of stock.` });
              return;
            }

            const newCartItem: CartItem = {
                ...productInState,
                cartItemId: `cart-item-${new Date().getTime()}-${Math.random()}`,
                quantity: 1,
                price: finalPrice,
                selectedModifiers: selectedModifiers,
            };
            set({ cart: [...cart, newCartItem] });
            toast({
              title: "Added to cart",
              description: `${itemData.name} has been added to your cart.`,
            });
        }
      },
    
      removeFromCart: (cartItemId: string) => {
        set(state => ({
            cart: state.cart.filter(item => item.cartItemId !== cartItemId)
        }));
      },
    
      updateQuantity: (cartItemId: string, quantity: number) => {
        const { cart } = get();
        const itemToUpdate = cart.find(item => item.cartItemId === cartItemId);
        if (!itemToUpdate) return;
    
        if (isNaN(quantity) || quantity < 1) {
            get().removeFromCart(cartItemId);
            return;
        }
    
        let newQuantity = quantity;
        if (itemToUpdate.track_stock && quantity > itemToUpdate.stock) {
            toast({ variant: 'destructive', description: `Only ${itemToUpdate.stock} items of ${itemToUpdate.name} in stock.`});
            newQuantity = itemToUpdate.stock;
        }
        
        set({
            cart: cart.map(item =>
                item.cartItemId === cartItemId ? { ...item, quantity: newQuantity } : item
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
