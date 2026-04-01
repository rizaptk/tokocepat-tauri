
import { useDbStore } from "@/lib/db-store";
import { useStore } from "@/lib/store";
import { seedDatabase } from "@/lib/database";
import { useEffect, useState } from "react";
import { 
    Product, ProductVariant, ModifierGroup, 
    // Transaction, 
    Shift, StoreConfig, Category, PendingCart, 
    RawIngredient, Recipe 
} from '@/lib/types';
import { TokoCepatLogo } from "./TokoCepatLogo";
// import { where } from "firesqlite";

export function DbProvider({ children }: { children: React.ReactNode }) {
    const { isInitialized, db, firesqlite } = useDbStore();
    const { 
        setProducts, setProductVariants, setModifierGroups, 
        // setTransactions, 
        setShifts, setStoreConfig, 
        setCategories, setPendingCarts, setRawIngredients, setRecipes 
    } = useStore();
    
    const [isDataLoaded, setIsDataLoaded] = useState(false);

    // 1. Initialize the Database connection
    // useEffect(() => {
    //     if (!isInitialized) {
    //         initialize();
    //     }
    // }, [initialize, isInitialized]);

    // 2. Manage Data Subscriptions
    useEffect(() => {
        // Only proceed if DB is ready
        if (!isInitialized) return;

        // In case of mock mode or missing engine
        if (!db || !firesqlite) {
            setIsDataLoaded(true);
            return;
        }

        // Memory Management: Track all active listeners
        let isMounted = true;
        const unsubs: (() => void)[] = [];

        const setupData = async () => {
            try {
                // A. Ensure tables exist and default data is present
                await seedDatabase(firesqlite, db);
                
                // B. Guard: If user navigated away during seeding, don't start listeners
                if (!isMounted) return;

                const { collection, doc, onSnapshot } = firesqlite;

                /**
                 * Helper to register unsubs automatically
                 */
                const subscribe = (unsubFunc: () => void) => unsubs.push(unsubFunc);

                // --- TIER 1: CRITICAL DATA (UI Essential) ---

                // Store Configuration
                subscribe(onSnapshot(doc(db, 'store_config', 'main'), (snap: any) => {
                    if (snap.exists()) setStoreConfig(snap.data() as StoreConfig);
                }));

                // Categories
                subscribe(onSnapshot(collection(db, 'categories'), (snap: any) => {
                    setCategories(snap.docs.map((d: any) => d.data() as Category));
                }));

                // Variants
                subscribe(onSnapshot(collection(db, 'product_variants'), (snap: any) => {
                    setProductVariants(snap.docs.map((d: any) => d.data() as ProductVariant));
                }));

                // Modifiers
                subscribe(onSnapshot(collection(db, 'modifier_groups'), (snap: any) => {
                    setModifierGroups(snap.docs.map((d: any) => d.data() as ModifierGroup));
                }));

                // Ingredients & Recipes
                subscribe(onSnapshot(collection(db, 'raw_ingredients'), (snap: any) => {
                    setRawIngredients(snap.docs.map((d: any) => d.data() as RawIngredient));
                }));

                subscribe(onSnapshot(collection(db, 'recipes'), (snap: any) => {
                    setRecipes(snap.docs.map((d: any) => d.data() as Recipe));
                }));

                // PRODUCTS: The "Anchor" for Tier 1
                subscribe(onSnapshot(collection(db, 'products'), (snap: any) => {
                    const productList = snap.docs.map((d: any) => d.data() as Product);
                    console.log('snapshoot : ', productList);
                    setProducts(productList);
                    
                    // Once we have products, we consider the primary UI "Loaded"
                    if (isMounted && !isDataLoaded) {
                        console.log("Firesqlite: Critical UI Data Sync Complete.");
                        setIsDataLoaded(true); 
                    }
                }));

                // --- TIER 2: SESSION & HISTORY (Background Sync) ---

                // Active Carts
                subscribe(onSnapshot(collection(db, 'pending_carts'), (snap: any) => {
                    setPendingCarts(snap.docs.map((d: any) => d.data() as PendingCart));
                }));

                // Current Shifts
                subscribe(onSnapshot(collection(db, 'shifts'), (snap: any) => {
                    const shiftList = snap.docs.map((d: any) => d.data() as Shift); 
                    setShifts(shiftList);
                }));


            } catch (error: any) {
                console.error("Firesqlite Subscription Manager Error:", error);
                // Recovery: Unblock UI anyway so user can see something
                if (isMounted) setIsDataLoaded(true);
            }
        };

        setupData();

        // 3. CLEANUP: This is the most important part
        return () => {
            isMounted = false;
            console.log(`Firesqlite: Cleaning up ${unsubs.length} active listeners...`);
            unsubs.forEach(unsub => {
                if (typeof unsub === 'function') unsub();
            });
        };
        
    }, [isInitialized, db, firesqlite]); // dependencies strictly limited

    // 4. Loading State Screen
    if (!isInitialized || !isDataLoaded) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                    <TokoCepatLogo />
                    <div className="flex flex-col items-center gap-1">
                        <p className="font-medium animate-pulse">
                            {!isInitialized ? 'Memulai Sistem...' : 'Sinkronisasi Data...'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Menyiapkan database lokal
                        </p>
                    </div>
                    <div className="w-48 h-1.5 bg-muted rounded-full overflow-hidden mt-2">
                        <div className="h-full bg-primary animate-progress-stripes w-full"></div>
                    </div>
                </div>
            </div>
        )
    }

    return <>{children}</>;
}