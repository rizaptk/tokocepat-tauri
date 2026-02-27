
"use client";

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Product, CartItem, Transaction, Category, ModifierGroup, ProductVariant, Shift, StoreConfig, SelectedModifier, PendingCart, RawIngredient, Recipe, StockMovement } from '@/lib/types';
import { toast } from '@/hooks/use-toast';
import { openShift as openShiftService, closeShift as closeShiftService } from '@/services/shiftService';
import { createTransaction } from '@/services/transactionService';
import { parkCartInDb, deletePendingCartFromDb } from '@/services/pendingCartService';
import { useSettingsStore } from './settings';


// This represents an item that has had a variant selected but is not yet in the cart
type ItemWithVariant = Product & { _selectedVariant: ProductVariant };

interface StoreState {
  products: Product[];
  categories: Category[];
  modifierGroups: ModifierGroup[];
  productVariants: ProductVariant[];
  rawIngredients: RawIngredient[];
  recipes: Recipe[];
  cart: CartItem[];
  transactions: Transaction[];
  shifts: Shift[];
  activeShift: Shift | null | undefined;
  storeConfig: StoreConfig | null;
  pendingCarts: PendingCart[];
  stockMovements: StockMovement[];
  
  // Actions
  setProducts: (products: Product[]) => void;
  setCategories: (categories: Category[]) => void;
  setModifierGroups: (modifierGroups: ModifierGroup[]) => void;
  setProductVariants: (productVariants: ProductVariant[]) => void;
  setRawIngredients: (ingredients: RawIngredient[]) => void;
  setRecipes: (recipes: Recipe[]) => void;
  setTransactions: (transactions: Transaction[]) => void;
  setShifts: (shifts: Shift[]) => void;
  setStoreConfig: (config: StoreConfig) => void;
  setPendingCarts: (carts: PendingCart[]) => void;
  setStockMovements: (movements: StockMovement[]) => void;
  saveItemToCart: (itemData: Product | CartItem | ItemWithVariant, selectedModifiers?: SelectedModifier[], selectedVariant?: ProductVariant) => void;
  removeFromCart: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  clearCart: () => void;
  checkout: (cashReceived: number) => Promise<Transaction | null>;
  openShift: (openingCash: number) => Promise<void>;
  closeShift: (declaredCash: number) => Promise<void>;
  parkCart: () => Promise<void>;
  resumeCart: (cartId: string) => Promise<void>;
  deletePendingCart: (cartId: string) => Promise<void>;
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      products: [],
      categories: [],
      modifierGroups: [],
      productVariants: [],
      rawIngredients: [],
      recipes: [],
      cart: [],
      transactions: [],
      shifts: [],
      activeShift: undefined,
      storeConfig: null,
      pendingCarts: [],
      stockMovements: [],
    
      setProducts: (products) => set({ products }),
      setCategories: (categories) => set({ categories }),
      setModifierGroups: (modifierGroups) => set({ modifierGroups }),
      setProductVariants: (productVariants) => set({ productVariants }),
      setRawIngredients: (ingredients) => set({ rawIngredients: ingredients.sort((a,b) => a.name.localeCompare(b.name)) }),
      setRecipes: (recipes) => set({ recipes }),
      setTransactions: (transactions) => set({ transactions: transactions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) }),
      setShifts: (shifts) => {
        const sortedShifts = shifts.sort((a, b) => new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime());
        const activeShift = sortedShifts.find(s => s.status === 'open') || null;
        set({ shifts: sortedShifts, activeShift });
      },
      setStoreConfig: (config) => set({ storeConfig: config }),
      setPendingCarts: (carts) => set({ pendingCarts: carts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) }),
      setStockMovements: (movements) => set({ stockMovements: movements.sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) }),
    
      saveItemToCart: (itemData: Product | CartItem | ItemWithVariant, selectedModifiers: SelectedModifier[] = [], selectedVariant?: ProductVariant) => {
        const { products, cart, activeShift } = get();
        const { showToast } = useSettingsStore.getState();

        if (!activeShift) {
          toast({
            variant: 'destructive',
            title: 'Shift Not Open',
            description: 'Please open a shift before making a sale.',
          });
          return;
        }

        const isEditing = 'cartItemId' in itemData;
        const finalVariant = selectedVariant || (isEditing ? (itemData as CartItem).selectedVariant : undefined);

        // For simple products (no modifiers/variants), check if it already exists and stack it.
        const isModified = selectedModifiers.length > 0 || !!finalVariant;
        if (!isModified && !isEditing) {
            const existingItem = cart.find(item => item.id === itemData.id && !item.selectedVariant && (!item.selectedModifiers || item.selectedModifiers.length === 0));
            if (existingItem) {
                get().updateQuantity(existingItem.cartItemId, existingItem.quantity + 1);
                if (showToast.saveCart)
                    toast({
                        title: "Quantity Updated",
                        description: `${itemData.name} quantity increased to ${existingItem.quantity + 1}.`,
                    });
                return;
            }
        }
        
        let finalPrice = itemData.price;
        if ('cartItemId' in itemData) {
            const originalProduct = products.find(p => p.id === itemData.id);
            finalPrice = originalProduct?.price || itemData.price;

            // Recalculate price based on variant and modifiers
            if (finalVariant) finalPrice += finalVariant.additional_price;
            finalPrice += selectedModifiers.reduce((sum, mod) => sum + mod.item.additional_price, 0);

        } else {
            // Price is already calculated with variant in cashier page, now add modifiers
            finalPrice = itemData.price;
            finalPrice += selectedModifiers.reduce((sum, mod) => sum + mod.item.additional_price, 0);
        }

        if (isEditing) {
             set(state => ({
                cart: state.cart.map(item =>
                    item.cartItemId === (itemData as CartItem).cartItemId
                    ? { ...item, selectedModifiers, price: finalPrice, selectedVariant: finalVariant }
                    : item
                ),
            }));
            if (showToast.saveCart)
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
            if (productInState.track_stock && !finalVariant && productInState.stock <= 0) {
              toast({ variant: 'destructive', description: `${itemData.name} is out of stock.` });
              return;
            }
            if (finalVariant && finalVariant.stock <=0) {
                toast({ variant: 'destructive', description: `Variant ${finalVariant.name} is out of stock.` });
                return;
            }

            const newCartItem: CartItem = {
                ...productInState,
                cartItemId: `cart-item-${new Date().getTime()}-${Math.random()}`,
                quantity: 1,
                price: finalPrice,
                selectedVariant: finalVariant,
                selectedModifiers: selectedModifiers,
            };
            set({ cart: [...cart, newCartItem] });
            if (showToast.saveCart)
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
        const { cart, productVariants } = get();
        const itemToUpdate = cart.find(item => item.cartItemId === cartItemId);
        if (!itemToUpdate) return;
    
        if (isNaN(quantity) || quantity < 1) {
            get().removeFromCart(cartItemId);
            return;
        }
    
        let newQuantity = quantity;
        const stockLimit = itemToUpdate.selectedVariant 
            ? itemToUpdate.selectedVariant.stock 
            : itemToUpdate.stock;
        
        const isStockTracked = itemToUpdate.has_variant || itemToUpdate.track_stock;

        if (isStockTracked && quantity > stockLimit) {
            toast({ variant: 'destructive', description: `Only ${stockLimit} items of ${itemToUpdate.name} in stock.`});
            newQuantity = stockLimit;
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

      parkCart: async () => {
        const { cart } = get();
        if (cart.length === 0) return;

        const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const taxRate = get().storeConfig?.tax_rate ?? 0.11;
        const total = subtotal + (subtotal * taxRate);
        const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

        try {
            await parkCartInDb(cart, total, itemCount);
            set({ cart: [] });
        } catch (error) {
            console.error("Failed to park cart:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not park the cart.' });
        }
      },

    resumeCart: async (cartId: string) => {
        const { cart, pendingCarts } = get();
        if (cart.length > 0) {
            toast({
                variant: 'destructive',
                title: 'Active Cart is Not Empty',
                description: 'Please process or park the current cart before resuming another.',
            });
            return;
        }
        const cartToResume = pendingCarts.find(c => c.id === cartId);
        if (cartToResume) {
            try {
                await deletePendingCartFromDb(cartId);
                set({ cart: cartToResume.items });
                toast({ title: 'Cart Resumed', description: `"${cartToResume.name}" is now the active cart.` });
            } catch (error) {
                console.error("Failed to resume cart:", error);
                toast({ variant: 'destructive', title: 'Error', description: 'Could not resume the cart.' });
            }
        }
    },

    deletePendingCart: async (cartId: string) => {
        const pendingCart = get().pendingCarts.find(c => c.id === cartId);
        if (pendingCart) {
            try {
                await deletePendingCartFromDb(cartId);
                toast({ title: 'Parked Cart Deleted', description: `"${pendingCart.name}" has been removed.` });
            } catch (error) {
                console.error("Failed to delete parked cart:", error);
                toast({ variant: 'destructive', title: 'Error', description: 'Could not delete the parked cart.' });
            }
        }
    },

    }),
    {
      name: 'tokoc-storage',
      storage: createJSONStorage(() => localStorage),
       partialize: (state) =>
        Object.fromEntries(
          Object.entries(state).filter(([key]) => !['products', 'transactions', 'modifierGroups', 'productVariants', 'categories', 'shifts', 'activeShift', 'storeConfig', 'pendingCarts', 'rawIngredients', 'recipes', 'stockMovements'].includes(key))
        ),
    }
  )
);
