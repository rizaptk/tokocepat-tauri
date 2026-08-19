import { useDbStore } from "@/lib/db-store";
import { useStore } from "@/lib/store";
import { ensureIndexes, backfillTransactionDevice } from "@/lib/database";
import { useEffect, useState } from "react";
import { invoke } from '@tauri-apps/api/core';
import { 
    Product, ProductVariant, 
    Shift, StoreConfig, Category, PendingCart, 
    CustomAccessType, Promotion
} from '@/lib/types';
import { TokoCepatLogo } from "./TokoCepatLogo";
import { generateDeviceFingerprint } from "@/lib/security";
import { normalizePromo } from "@/lib/promo-model";

export function DbProvider({ children }: { children: React.ReactNode }) {
    const { isInitialized, db, firesqlite } = useDbStore();
    const { 
        setProducts, setProductVariants, 
        setShifts, setStoreConfig, setCustomAccess,
        setCategories, setPendingCarts, setPromos
    } = useStore();
    
    const [isDataLoaded, setIsDataLoaded] = useState(false);

    // 2. Manage Data Subscriptions
    useEffect(() => {
        // Only proceed if DB is ready
        if (!isInitialized || !db || !firesqlite) return;

        // Memory Management: Track all active listeners
        let isMounted = true;
        const unsubs: (() => void)[] = [];

        const setupData = async () => {
            try {
                // A. Ensure database indexes are present before starting listeners
                const hwid = await generateDeviceFingerprint();
                await ensureIndexes(firesqlite, db);
                await backfillTransactionDevice(firesqlite, db);
                
                // B. Guard: If user navigated away during seeding, don't start listeners
                if (!isMounted) return;

                const { collection, doc, onSnapshot } = firesqlite;

                // const data = await getDocs(query(collection(db, 'products'), limit(10)));
                // console.log(data.docs)

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

                // PRODUCTS: The "Anchor" for Tier 1
                subscribe(onSnapshot(collection(db, 'products'), (snap: any) => {
                    const productList = snap.docs.map((d: any) => d.data() as Product);
                    setProducts(productList);
                    
                    // Once we have products, we consider the primary UI "Loaded"
                    if (isMounted && !isDataLoaded) {
                        // console.log("Firesqlite: Critical UI Data Sync Complete.");
                        setIsDataLoaded(true); 
                    }
                }));

                // CATALOG: bundled reference data is loaded lazily on the Produk
                // page (see useCatalogSearch) instead of snapshoting ~11k rows
                // into the store on every boot. The Rust import stays idempotent.
                invoke<number>('import_catalog').catch((err) => {
                    console.warn('Catalog import skipped:', err);
                });

                // --- TIER 2: SESSION & HISTORY (Background Sync) ---

                // Active Carts
                subscribe(onSnapshot(collection(db, 'pending_carts'), (snap: any) => {
                    setPendingCarts(snap.docs.map((d: any) => d.data() as PendingCart));
                }));

                // Promotions & vouchers (discount engine rules)
                subscribe(onSnapshot(collection(db, 'promos'), (snap: any) => {
                    setPromos(snap.docs.map((d: any) => normalizePromo(d.data() as Promotion)));
                }));

                // Current Shifts
                subscribe(onSnapshot(collection(db, 'shifts'), (snap: any) => {
                    const shiftList = snap.docs.map((d: any) => d.data() as Shift); 
                    setShifts(shiftList, hwid);
                }));

                /// Custom Access
                subscribe(onSnapshot(doc(db, '__firelite_security', hwid), (snap) => {
                    if (snap.exists()) {
                        setCustomAccess(snap.data() as CustomAccessType);
                    }
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