

import { useDbStore } from "@/lib/db-store";
import { useStore } from "@/lib/store";
import { seedDatabase } from "@/lib/database";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { Product, ProductVariant, ModifierGroup, Transaction, Shift, StoreConfig, Category, PendingCart, RawIngredient, Recipe } from '@/lib/types';
import { TokoCepatLogo } from "./TokoCepatLogo";

export function DbProvider({ children }: { children: React.ReactNode }) {
    const { isInitialized, db, firesqlite, initialize } = useDbStore();
    const { 
        setProducts, 
        setProductVariants, 
        setModifierGroups, 
        setTransactions, 
        setShifts, 
        setStoreConfig, 
        setCategories,
        setPendingCarts,
        setRawIngredients,
        setRecipes,
        // stockMovements are now loaded on demand
    } = useStore();
    
    const [isDataLoaded, setIsDataLoaded] = useState(false);

    useEffect(() => {
        if (!isInitialized) {
            initialize();
        }
    }, [initialize, isInitialized]);

    useEffect(() => {
        if (!isInitialized) return;

        // In mock mode, skip data loading and unblock UI
        if (!db || !firesqlite) {
            setIsDataLoaded(true);
            return;
        }

        let unsubStoreConfig: (() => void) | undefined;
        let unsubCategories: (() => void) | undefined;
        let unsubProducts: (() => void) | undefined;
        let unsubVariants: (() => void) | undefined;
        let unsubModifiers: (() => void) | undefined;
        let unsubPendingCarts: (() => void) | undefined;
        let unsubIngredients: (() => void) | undefined;
        let unsubRecipes: (() => void) | undefined;
        let unsubTransactions: (() => void) | undefined;
        let unsubShifts: (() => void) | undefined;



        const setupData = async () => {
            try {
                await seedDatabase(firesqlite, db);
                
                const { collection, doc, onSnapshot, query, orderBy, limit } = firesqlite;
                
                // --- TIER 1: CRITICAL METADATA (Blocks UI) ---
                // These are small and required for the UI to function correctly.
                unsubStoreConfig = onSnapshot(doc(db, 'store_config', 'main'), (docSnap: any) => {
                    if (docSnap.exists()) setStoreConfig(docSnap.data() as StoreConfig);
                });
                unsubCategories = onSnapshot(collection(db, 'categories'), (snapshot: any) => {
                    setCategories(snapshot.docs.map((doc: any) => doc.data() as Category));
                });
                 unsubVariants = onSnapshot(collection(db, 'product_variants'), (snapshot: any) => {
                    setProductVariants(snapshot.docs.map((doc: any) => doc.data() as ProductVariant));
                });
                unsubModifiers = onSnapshot(collection(db, 'modifier_groups'), (snapshot: any) => {
                    setModifierGroups(snapshot.docs.map((doc: any) => doc.data() as ModifierGroup));
                });
                 unsubIngredients = onSnapshot(collection(db, 'raw_ingredients'), (snapshot: any) => {
                    setRawIngredients(snapshot.docs.map((doc: any) => doc.data() as RawIngredient));
                });
                unsubRecipes = onSnapshot(collection(db, 'recipes'), (snapshot: any) => {
                    setRecipes(snapshot.docs.map((doc: any) => doc.data() as Recipe));
                });

                // Products are the last piece of critical data. Once loaded, unblock the UI.
                unsubProducts = onSnapshot(collection(db, 'products'), (snapshot: any) => {
                    const productList = snapshot.docs.map((doc: any) => doc.data() as Product);
                    setProducts(productList);
                    if (!isDataLoaded) {
                        setIsDataLoaded(true); // <<--- UNBLOCK UI

                        console.log("UI Unblocked: Critical data loaded.");
                    }
                });

                // --- TIER 2: ACTIVE SESSION & RECENT HISTORY DATA (Background) ---
                // These load after the UI is visible and use limits to avoid fetching everything.
                unsubPendingCarts = onSnapshot(collection(db, 'pending_carts'), (snapshot: any) => {
                    setPendingCarts(snapshot.docs.map((doc: any) => doc.data() as PendingCart));
                });
                unsubShifts = onSnapshot(collection(db, 'shifts'), (snapshot: any) => {
                    setShifts(snapshot.docs.map((doc: any) => doc.data() as Shift));
                });

                // Only listen to the last 100 transactions for the "Recent" list.
                const recentTxQuery = query(collection(db, 'transactions'), orderBy('created_at', 'desc'), limit(100));
                unsubTransactions = onSnapshot(recentTxQuery, (snapshot: any) => {
                    setTransactions(snapshot.docs.map((doc: any) => doc.data() as Transaction));
                });

            } catch (error: any) {
                console.error("Failed to subscribe to data:", error);
                setIsDataLoaded(true); // Unblock UI on error too
            }
        };

        setupData();

        return () => {
            if (unsubProducts) unsubProducts();
            if (unsubVariants) unsubVariants();
            if (unsubModifiers) unsubModifiers();
            if (unsubTransactions) unsubTransactions();
            if (unsubShifts) unsubShifts();
            if (unsubStoreConfig) unsubStoreConfig();
            if (unsubCategories) unsubCategories();
            if (unsubPendingCarts) unsubPendingCarts();
            if (unsubIngredients) unsubIngredients();
            if (unsubRecipes) unsubRecipes();
        };
    // isDataLoaded is not a dependency, we only want to run this once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isInitialized, db, firesqlite]);

    if (!isInitialized || !isDataLoaded) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                    <TokoCepatLogo />
                    <p className="text-muted-foreground">
                        {!isInitialized ? 'Initializing Database...' : 'Loading Data...'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                        Check console for details
                    </p>
                    <div className="w-48 h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary animate-pulse w-full"></div>
                    </div>
                </div>
            </div>
        )
    }

    return <>{children}</>;
}
