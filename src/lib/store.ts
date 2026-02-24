
"use client";

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Product, CartItem, Transaction, Category, ModifierGroup, ProductVariant, Shift } from '@/lib/types';
import { toast } from '@/hooks/use-toast';
import { useDbStore } from './db-store';

const TAX_RATE = 0.11; // PPN 11%

interface StoreState {
  products: Product[];
  categories: Category[];
  modifierGroups: ModifierGroup[];
  productVariants: ProductVariant[];
  cart: CartItem[];
  transactions: Transaction[];
  shifts: Shift[];
  activeShift: Shift | null;
  
  // Actions
  setProducts: (products: Product[]) => void;
  setCategories: (categories: Category[]) => void;
  setModifierGroups: (modifierGroups: ModifierGroup[]) => void;
  setProductVariants: (productVariants: ProductVariant[]) => void;
  setTransactions: (transactions: Transaction[]) => void;
  setShifts: (shifts: Shift[]) => void;
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
        const { db, firesqlite } = useDbStore.getState();
        if (get().activeShift || !db || !firesqlite) return;
        
        const { doc, setDoc } = firesqlite;
        const now = new Date().toISOString();
        const newShift: Shift = {
            id: now,
            opened_at: now,
            opening_cash: openingCash,
            status: 'open'
        };
        await setDoc(doc(db, 'shifts', newShift.id), newShift);
      },
      
      closeShift: async (declaredCash: number) => {
        const { activeShift, transactions } = get();
        const { db, firesqlite } = useDbStore.getState();
        if (!activeShift || !db || !firesqlite) return;

        const { doc, updateDoc } = firesqlite;

        const shiftTransactions = transactions.filter(t => t.shift_id === activeShift.id);
        const system_cash = activeShift.opening_cash + shiftTransactions.reduce((sum, t) => t.total, 0);

        const updatedShift: Partial<Shift> = {
            closed_at: new Date().toISOString(),
            declared_cash: declaredCash,
            system_cash: system_cash,
            variance: declaredCash - system_cash,
            status: 'closed'
        };

        await updateDoc(doc(db, 'shifts', activeShift.id), updatedShift);
      },

      checkout: async (cashReceived: number): Promise<Transaction | null> => {
        const { cart, activeShift } = get();
        const { db, firesqlite } = useDbStore.getState();

        if (!activeShift) {
            toast({ variant: 'destructive', title: 'Shift Closed', description: 'Please open a shift to process transactions.' });
            return null;
        }
        if (cart.length === 0 || !db || !firesqlite) return null;

        const { doc, getDoc, setDoc, updateDoc } = firesqlite;
    
        const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const tax_amount = subtotal * TAX_RATE;
        const total = subtotal + tax_amount;
    
        if (cashReceived < total) {
          return null; // Insufficient cash
        }

        const now = new Date();
        const transactionId = now.toISOString();
        const invoiceNumber = `INV-${now.getTime()}`;
    
        const newTransaction: Transaction = {
          id: transactionId,
          invoice_number: invoiceNumber,
          shift_id: activeShift.id,
          items: cart.map(item => ({
            id: `${transactionId}-${item.id}`,
            transaction_id: transactionId,
            product_snapshot: {
                id: item.id,
                name: item.name,
                price: item.price,
                imageUrl: item.imageUrl,
                imageHint: item.imageHint,
                category_id: item.category_id,
                cost_price: item.cost_price,
                sku: item.sku,
                barcode: item.barcode,
            },
            price_snapshot: item.price,
            cost_snapshot: item.cost_price,
            qty: item.quantity,
            subtotal: item.price * item.quantity,
          })),
          subtotal,
          tax_amount,
          total,
          cash_paid: cashReceived,
          change: cashReceived - total,
          created_at: transactionId,
        };

        // --- Database Operations ---
        // 1. Save transaction
        await setDoc(doc(db, 'transactions', transactionId), newTransaction);

        // 2. Update stock and create stock movements
        for (const cartItem of cart) {
            if (cartItem.track_stock) {
                const productRef = doc(db, 'products', cartItem.id);
                
                const productSnap = await getDoc(productRef);
                if (productSnap.exists()) {
                    const currentStock = productSnap.data().stock;
                    await updateDoc(productRef, { stock: currentStock - cartItem.quantity });
                }

                const movementId = `${transactionId}-${cartItem.id}-sale`;
                const stockMovement = {
                    id: movementId,
                    product_id: cartItem.id,
                    type: 'sale',
                    qty_change: -cartItem.quantity,
                    reference_id: transactionId,
                    created_at: transactionId,
                };
                await setDoc(doc(db, 'stock_movements', movementId), stockMovement);
            }
        }
        
        set({ cart: [] });
        
        return newTransaction;
      },
    }),
    {
      name: 'tokoc-storage',
      storage: createJSONStorage(() => localStorage),
       partialize: (state) =>
        Object.fromEntries(
          Object.entries(state).filter(([key]) => !['products', 'transactions', 'modifierGroups', 'productVariants', 'categories', 'shifts', 'activeShift'].includes(key))
        ),
    }
  )
);
