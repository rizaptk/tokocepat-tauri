import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Product, CartItem, Transaction, Category, ProductVariant, Shift, StoreConfig, PendingCart, StockMovement, CustomAccessType, Promotion, Customer, CustomerGroup } from '@/lib/types';
import { toast } from '@/hooks/use-toast';
import { openShift as openShiftService, closeShift as closeShiftService } from '@/services/shiftService';
import { createTransaction } from '@/services/transactionService';
import { createReturnTransaction, ReturnLine } from '@/services/returnService';
import { evaluateDiscounts, DiscountOptions } from '@/services/promoService';
import { parkCartInDb, deletePendingCartFromDb } from '@/services/pendingCartService';
import { useSettingsStore } from './settings';
import { usePrintStore } from './print-store';
import { DEFAULT_STORE_CONFIG } from '@/lib/defaults';
import { getUom, resolvePricePerUom, toBaseQty } from '@/lib/uom';


// This represents an item that has had a variant selected but is not yet in the cart
type ItemWithVariant = Product & { _selectedVariant: ProductVariant };

interface StoreState {
    products: Product[];
    categories: Category[];
    productVariants: ProductVariant[];
    cart: CartItem[];
    transactions: Transaction[];
    shiftTransactions: Transaction[];
    shifts: Shift[];
    activeShift: Shift | null | undefined;
    storeConfig: StoreConfig | null;
    pendingCarts: PendingCart[];
    stockMovements: StockMovement[];
    promos: Promotion[];
    customers: Customer[];
    customerGroups: CustomerGroup[];
    customAccess: CustomAccessType | null;
    readNotificationIds: string[];
    dismissedNotificationIds: string[];
    
    // Actions
    markAsRead: (id: string) => void;
    markAllNotificationsRead: (ids: string[]) => void;
    dismissNotification: (id: string) => void;
    clearDismissedNotifications: () => void;
    setProducts: (products: Product[]) => void;
    setCategories: (categories: Category[]) => void;
    setProductVariants: (productVariants: ProductVariant[]) => void;
    setTransactions: (transactions: Transaction[]) => void;
    setShiftTransactions: (transactions: Transaction[]) =>void;
    setShifts: (shifts: Shift[],device: string|undefined) => void;
    setStoreConfig: (config: StoreConfig) => void;
    setPendingCarts: (carts: PendingCart[]) => void;
    setStockMovements: (movements: StockMovement[]) => void;
    setPromos: (promos: Promotion[]) => void;
    setCustomers: (customers: Customer[]) => void;
    setCustomerGroups: (groups: CustomerGroup[]) => void;
    saveItemToCart: (itemData: Product | CartItem | ItemWithVariant, selectedVariant?: ProductVariant) => void;
    removeFromCart: (cartItemId: string) => void;
    updateQuantity: (cartItemId: string, quantity: number) => void;
    updateCartItemUom: (cartItemId: string, uomId: string, groupId?: string) => void;
    clearCart: () => void;
    checkout: (cashReceived: number, options?: DiscountOptions) => Promise<Transaction | null>;
    createReturn: (params: { originalTx: Transaction; returnLines: ReturnLine[]; reason: string; conditionOk: boolean }) => Promise<Transaction | null>;
    openShift: (openingCash: number) => Promise<void>;
    closeShift: (declaredCash: number) => Promise<void>;
    parkCart: () => Promise<void>;
    resumeCart: (cartId: string) => Promise<void>;
    deletePendingCart: (cartId: string) => Promise<void>;
    setCustomAccess: (customAccess: CustomAccessType) => void;
}

export const useStore = create<StoreState>()(
    persist(
        (set, get) => ({
            products: [],
            categories: [],
            productVariants: [],
            cart: [],
            transactions: [],
            shiftTransactions: [],
            shifts: [],
            activeShift: undefined,
            storeConfig: null,
            pendingCarts: [],
            stockMovements: [],
            promos: [],
            customers: [],
            customerGroups: [],
            customAccess: null,
            readNotificationIds: [],
            dismissedNotificationIds: [],

            markAsRead: (id: string) => set((state) => ({
                // Using Set to prevent duplicates, keeping last 500 to prevent localstorage bloat
                readNotificationIds: [...new Set([...state.readNotificationIds, id])].slice(-500)
            })),

            markAllNotificationsRead: (ids: string[]) => set((state) => ({
                readNotificationIds: [...new Set([...state.readNotificationIds, ...ids])].slice(-500)
            })),

            dismissNotification: (id: string) => {
                set((state) => {
                    const newDismissed = [...state.dismissedNotificationIds, id];
                    // Keep only the last 500 entries to prevent local storage bloat
                    return { dismissedNotificationIds: newDismissed.slice(-500) };
                });
            },

            clearDismissedNotifications: () => set({ dismissedNotificationIds: [] }),
            setCustomAccess: (customAccess) => set({ customAccess }),
            setProducts: (products) => set({ products }),
            setCategories: (categories) => set({ categories }),
            setProductVariants: (productVariants) => set({ productVariants }),
            setTransactions: (transactions) => set({ transactions: transactions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) }),
            setShiftTransactions: (transactions) => set({ transactions: transactions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) }),
            setShifts: (shifts, device) => {
                const sortedShifts = shifts.sort((a, b) => new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime());
                const activeShift = sortedShifts.find(s => device && (s.status === 'open' && s.device === device)) || null;
                set({ shifts: sortedShifts, activeShift });
            },
            setStoreConfig: (config) => set({ storeConfig: config }),
            setPendingCarts: (carts) => set({ pendingCarts: carts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) }),
            setStockMovements: (movements) => set({ stockMovements: movements.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) }),
            setPromos: (promos) => set({ promos: promos.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) }),
            setCustomers: (customers) => set({ customers }),
            setCustomerGroups: (groups) => set({ customerGroups: groups }),

            saveItemToCart: (itemData: Product | CartItem | ItemWithVariant, selectedVariant?: ProductVariant) => {
                const { products, cart, activeShift } = get();
                const { showToast } = useSettingsStore.getState();

                if (!activeShift) {
                    toast({
                        variant: 'destructive',
                        title: 'Sif Belum Buka',
                        description: 'Buka sif terlebih dahulu.',
                    });
                    return;
                }

                const isEditing = 'cartItemId' in itemData;
                const finalVariant = selectedVariant || (isEditing ? (itemData as CartItem).selectedVariant : undefined);

                // For simple products (no variants), check if it already exists and stack it.
                const isModified = !!finalVariant;
                if (!isModified && !isEditing) {
                    const existingItem = cart.find(item => item.id === itemData.id && !item.selectedVariant);
                    if (existingItem) {
                        get().updateQuantity(existingItem.cartItemId, existingItem.quantity + 1);
                        if (showToast.saveCart)
                            toast({
                                title: "Jumlah Diupdate",
                                description: `${itemData.name} bertambah jadi ${existingItem.quantity + 1}.`,
                            });
                        return;
                    }
                }

                let finalPrice = itemData.price;
                if ('cartItemId' in itemData) {
                    const originalProduct = products.find(p => p.id === itemData.id);
                    finalPrice = originalProduct?.price || itemData.price;

                    // Recalculate price based on variant
                    if (finalVariant) finalPrice += finalVariant.additional_price;

                } else {
                    // Price is already calculated with variant in cashier page
                    finalPrice = itemData.price;
                }

                if (isEditing) {
                    set(state => ({
                        cart: state.cart.map(item =>
                            item.cartItemId === (itemData as CartItem).cartItemId
                                ? { ...item, price: finalPrice, selectedVariant: finalVariant }
                                : item
                        ),
                    }));
                    if (showToast.saveCart)
                        toast({
                            title: "Item Diupdate",
                            description: `${itemData.name} berhasil diubah.`,
                        });
                } else {
                    const productInState = products.find(p => p.id === itemData.id);
                    if (!productInState || !productInState.is_active) {
                        toast({ variant: 'destructive', description: `${itemData.name} tidak tersedia.` });
                        return;
                    }
                    if (productInState.track_stock && !finalVariant && productInState.stock <= 0) {
                        toast({ variant: 'destructive', description: `${itemData.name} habis.` });
                        return;
                    }
                    if (finalVariant && finalVariant.stock <= 0) {
                        toast({ variant: 'destructive', description: `Varian ${finalVariant.name} habis.` });
                        return;
                    }

                    const newCartItem: CartItem = {
                        ...productInState,
                        cartItemId: `cart-item-${crypto.randomUUID().slice(0, 8)}`,
                        quantity: 1,
                        price: finalPrice,
                        selectedVariant: finalVariant,
                    };
                    set({ cart: [...cart, newCartItem] });
                    if (showToast.saveCart)
                        toast({
                            title: "Masuk Keranjang",
                            description: `${itemData.name} ditambahkan.`,
                        });
                }
            },

            removeFromCart: (cartItemId: string) => {
                set(state => ({
                    cart: state.cart.filter(item => item.cartItemId !== cartItemId)
                }));
            },

            updateCartItemUom: (cartItemId: string, uomId: string, groupId?: string) => {
                const { cart } = get();
                const idx = cart.findIndex(i => i.cartItemId === cartItemId);
                if (idx < 0) return;
                const item = cart[idx] as any;
                const uom = getUom(item, uomId);
                const qtyBase = toBaseQty(item.quantity, uom.factor);
                const pricePerUom = resolvePricePerUom(item, uom, qtyBase, groupId);
                set(state => ({
                    cart: state.cart.map(c => c.cartItemId === cartItemId ? { ...c, selectedUomId: uom.id, selectedUomName: uom.name, selectedUomFactor: uom.factor, price: pricePerUom, pricePerBase: pricePerUom / uom.factor, qtyBase } as any : c)
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
                const stockLimit = itemToUpdate.selectedVariant
                    ? itemToUpdate.selectedVariant.stock
                    : itemToUpdate.stock;

                const isStockTracked = itemToUpdate.has_variant || itemToUpdate.track_stock;

                if (isStockTracked && quantity > stockLimit) {
                    toast({ variant: 'destructive', description: `Stok ${itemToUpdate.name} sisa ${stockLimit}.` });
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
                    toast({ variant: "destructive", title: "Gagal", description: "Gagal buka sif." });
                }
            },

            closeShift: async (declaredCash: number) => {
                const { activeShift, transactions } = get();
                if (!activeShift) return;

                try {
                    await closeShiftService(activeShift, transactions, declaredCash);

                } catch (error) {
                    console.error("Failed to close shift:", error);
                    toast({ variant: "destructive", title: "Gagal", description: "Gagal tutup sif." });
                }
            },

            checkout: async (cashReceived: number, options?: DiscountOptions): Promise<Transaction | null> => {
                const { cart, activeShift, transactions, promos } = get();
                const storeConfig = get().storeConfig ?? DEFAULT_STORE_CONFIG;

                if (!activeShift) {
                    toast({ variant: 'destructive', title: 'Gagal', description: 'Sif tidak aktif.' });
                    return null;
                }

                try {
                    const newTransaction = await createTransaction(cart, activeShift, storeConfig, cashReceived, promos, options);
                    if (newTransaction) {
                        set({
                            cart: [],
                            transactions: [newTransaction, ...transactions]
                        }); // Clear cart and prepend new transaction
                    }
                    if (newTransaction) {
                        usePrintStore.getState().addToQueue(newTransaction);
                    }
                    return newTransaction;
                } catch (error) {
                    console.error("Checkout failed:", error);
                    toast({ variant: "destructive", title: "Transaksi Gagal", description: "Pembayaran gagal diproses." });
                    return null;
                }
            },

            createReturn: async (params): Promise<Transaction | null> => {
                const { activeShift, transactions } = get();
                const storeConfig = get().storeConfig ?? DEFAULT_STORE_CONFIG;

                if (!activeShift) {
                    toast({ variant: 'destructive', title: 'Gagal', description: 'Sif tidak aktif.' });
                    return null;
                }

                try {
                    const returnTx = await createReturnTransaction({ ...params, activeShift, storeConfig });
                    if (returnTx) {
                        set({ transactions: [returnTx, ...transactions] });
                        usePrintStore.getState().addToQueue(returnTx);
                    }
                    return returnTx;
                } catch (error: any) {
                    console.error("Return failed:", error);
                    toast({ variant: "destructive", title: "Retur Gagal", description: error.message });
                    return null;
                }
            },

            parkCart: async () => {
                const { cart, promos } = get();
                if (cart.length === 0) return;

                const storeConfig = get().storeConfig;
                const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
                let total = 0;
                if (storeConfig) {
                    const result = evaluateDiscounts(cart, storeConfig, promos);
                    total = result.total;
                } else {
                    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
                    const taxRate = get().storeConfig?.tax_rate ?? 0.11;
                    total = subtotal + (subtotal * taxRate);
                }

                try {
                    await parkCartInDb(cart, total, itemCount);
                    set({ cart: [] });
                } catch (error) {
                    console.error("Failed to park cart:", error);
                    toast({ variant: 'destructive', title: 'Gagal', description: 'Gagal simpan keranjang.' });
                }
            },

            resumeCart: async (cartId: string) => {
                const { cart, pendingCarts } = get();
                if (cart.length > 0) {
                    toast({
                        variant: 'destructive',
                        title: 'Keranjang Tidak Kosong',
                        description: 'Kosongkan atau simpan keranjang saat ini.',
                    });
                    return;
                }
                const cartToResume = pendingCarts.find(c => c.id === cartId);
                if (cartToResume) {
                    try {
                        await deletePendingCartFromDb(cartId);
                        set({ cart: cartToResume.items });
                        toast({ title: 'Keranjang Dipulihkan', description: `"${cartToResume.name}" aktif.` });
                    } catch (error) {
                        console.error("Failed to resume cart:", error);
                        toast({ variant: 'destructive', title: 'Gagal', description: 'Gagal memulihkan keranjang.' });
                    }
                }
            },

            deletePendingCart: async (cartId: string) => {
                const pendingCart = get().pendingCarts.find(c => c.id === cartId);
                if (pendingCart) {
                    try {
                        await deletePendingCartFromDb(cartId);
                        toast({ title: 'Keranjang Dihapus', description: `"${pendingCart.name}" telah dihapus.` });
                    } catch (error) {
                        console.error("Failed to delete parked cart:", error);
                        toast({ variant: 'destructive', title: 'Gagal', description: 'Gagal menghapus keranjang.' });
                    }
                }
            },

        }),
        {
            name: 'tokoc-storage',
            version: 2,
            // The catalog used to be persisted here (11k+ docs rehydrated from
            // localStorage on every boot). It is now loaded lazily; strip any
            // stale persisted copy so it is not parsed back into memory.
            migrate: (persistedState: any) => {
                if (persistedState && 'catalog' in persistedState) {
                    delete persistedState.catalog;
                }
                return persistedState;
            },
            partialize: (state) =>
                Object.fromEntries(
                    Object.entries(state).filter(([key]) => !['products', 'transactions', 'productVariants', 'categories', 'shifts', 'activeShift', 'storeConfig', 'pendingCarts', 'stockMovements', 'promos', 'customers', 'customerGroups'].includes(key))
                ),
        }
    )
);
