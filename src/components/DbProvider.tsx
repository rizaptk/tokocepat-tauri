
"use client";

import { useDbStore } from "@/lib/db-store";
import { useStore } from "@/lib/store";
import { seedDatabase } from "@/lib/database";
import { useEffect, useState } from "react";
import { Product, ProductVariant, ModifierGroup, Transaction, Shift, StoreConfig, Category, PendingCart, RawIngredient } from '@/lib/types';
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
        setRawIngredients
    } = useStore();
    
    // We only need to know if the initial data has been loaded, not for subsequent updates.
    const [isDataLoaded, setIsDataLoaded] = useState(false);

    useEffect(() => {
        if (!isInitialized) {
            initialize();
        }
    }, [initialize, isInitialized]);

    useEffect(() => {
        if (!isInitialized || !db || !firesqlite) return;

        // for debuging purpuse, do not remove
        // if (typeof window !== 'undefined') {
        //     // @ts-ignore
        //     window.db = db;
        //     // @ts-ignore
        //     window.firesqlite = firesqlite;
        // }

        let unsubProducts: (() => void) | undefined;
        let unsubVariants: (() => void) | undefined;
        let unsubModifiers: (() => void) | undefined;
        let unsubTransactions: (() => void) | undefined;
        let unsubShifts: (() => void) | undefined;
        let unsubStoreConfig: (() => void) | undefined;
        let unsubCategories: (() => void) | undefined;
        let unsubPendingCarts: (() => void) | undefined;
        let unsubIngredients: (() => void) | undefined;


        const setupData = async () => {
            try {
                await seedDatabase(firesqlite, db);
                
                const { collection, doc, onSnapshot } = firesqlite;
                
                unsubStoreConfig = onSnapshot(doc(db, 'store_config', 'main'), (docSnap: any) => {
                    if (docSnap.exists()) {
                        setStoreConfig(docSnap.data() as StoreConfig);
                    }
                });
                
                unsubProducts = onSnapshot(collection(db, 'products'), (snapshot: any) => {
                    const productList = snapshot.docs.map((doc: any) => doc.data() as Product);
                    setProducts(productList);
                    if (!isDataLoaded) setIsDataLoaded(true); // Mark as loaded on first product fetch
                });

                unsubVariants = onSnapshot(collection(db, 'product_variants'), (snapshot: any) => {
                    const variantList = snapshot.docs.map((doc: any) => doc.data() as ProductVariant);
                    setProductVariants(variantList);
                });

                unsubModifiers = onSnapshot(collection(db, 'modifier_groups'), (snapshot: any) => {
                    const groupList = snapshot.docs.map((doc: any) => doc.data() as ModifierGroup);
                    setModifierGroups(groupList);
                });

                unsubTransactions = onSnapshot(collection(db, 'transactions'), (snapshot: any) => {
                    const transactionList = snapshot.docs.map((doc: any) => doc.data() as Transaction);
                    setTransactions(transactionList);
                });

                unsubShifts = onSnapshot(collection(db, 'shifts'), (snapshot: any) => {
                    const shiftList = snapshot.docs.map((doc: any) => doc.data() as Shift);
                    setShifts(shiftList);
                });

                unsubCategories = onSnapshot(collection(db, 'categories'), (snapshot: any) => {
                    const categoryList = snapshot.docs.map((doc: any) => doc.data() as Category);
                    setCategories(categoryList);
                });
                
                unsubPendingCarts = onSnapshot(collection(db, 'pending_carts'), (snapshot: any) => {
                    const pendingCartsList = snapshot.docs.map((doc: any) => doc.data() as PendingCart);
                    setPendingCarts(pendingCartsList);
                });

                unsubIngredients = onSnapshot(collection(db, 'raw_ingredients'), (snapshot: any) => {
                    const ingredientList = snapshot.docs.map((doc: any) => doc.data() as RawIngredient);
                    setRawIngredients(ingredientList);
                });

            } catch (error: any) {
                console.error("Failed to subscribe to data:", error);
                setIsDataLoaded(true); // Also set to true on error to unblock UI
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
        };
    // isDataLoaded is not a dependency, we only want to run this once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isInitialized, db, firesqlite, setProducts, setProductVariants, setModifierGroups, setTransactions, setShifts, setStoreConfig, setCategories, setPendingCarts, setRawIngredients]);

    if (!isInitialized || !isDataLoaded) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                    <TokoCepatLogo />
                    <p className="text-muted-foreground">{!isInitialized ? 'Initializing Database...' : 'Loading Data...'}</p>
                    <div className="w-48 h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary animate-pulse w-full"></div>
                    </div>
                </div>
            </div>
        )
    }

    return <>{children}</>;
}
