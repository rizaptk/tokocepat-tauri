import { useDbStore } from "@/lib/db-store";
import { useStore } from "@/lib/store";
import { ensureIndexes, backfillTransactionDevice } from "@/lib/database";
import { useEffect, useState } from "react";
import { 
    Product, ProductVariant, 
    Shift, StoreConfig, Category, PendingCart, 
    CustomAccessType, Promotion, Customer, CustomerGroup
} from '@/lib/types';
import { TokoCepatLogo } from "./TokoCepatLogo";
import { generateDeviceFingerprint } from "@/lib/security";
import { normalizePromo } from "@/lib/promo-model";
import { DEFAULT_STORE_CONFIG } from "@/lib/defaults";
import { normalizeProductUoms } from "@/lib/uom";

export function DbProvider({ children }: { children: React.ReactNode }) {
    const { isInitialized, db, firesqlite } = useDbStore();
    const { 
        setProducts, setProductVariants, 
        setShifts, setStoreConfig, setCustomAccess,
        setCategories, setPendingCarts, setPromos, setCustomers, setCustomerGroups
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
                // Firelite's create_index is idempotent, but we gate with a marker to avoid 13 IPC calls on every boot.
                const hwid = await generateDeviceFingerprint();
                try {
                    const { doc, getDoc, setDoc } = firesqlite;
                    const marker = await getDoc(doc(db, 'app_state', 'indexes_seeded'));
                    if (!marker.exists()) {
                        await ensureIndexes(firesqlite, db);
                        await setDoc(doc(db, 'app_state', 'indexes_seeded'), { v: 1, at: new Date().toISOString() } as any);
                    }
                } catch {
                    await ensureIndexes(firesqlite, db);
                }
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

                // Store Configuration. Seeds a default doc when missing — nothing else in the
                // app creates `store_config/main`, and without it the discount engine and
                // checkout silently refuse to run.
                let storeConfigSeeded = false;
                subscribe(onSnapshot(doc(db, 'store_config', 'main'), async (snap: any) => {
                    if (snap.exists()) {
                        setStoreConfig(snap.data() as StoreConfig);
                    } else if (isMounted && !storeConfigSeeded) {
                        storeConfigSeeded = true;
                        try {
                            const { setDoc } = firesqlite;
                            await setDoc(doc(db, 'store_config', 'main'), DEFAULT_STORE_CONFIG);
                        } catch { /* the settings form can create it via save */ }
                    }
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
                    const productList = snap.docs.map((d: any) => normalizeProductUoms(d.data() as Product));
                    setProducts(productList);
                    
                    // Once we have products, we consider the primary UI "Loaded"
                    if (isMounted && !isDataLoaded) {
                        // console.log("Firesqlite: Critical UI Data Sync Complete.");
                        setIsDataLoaded(true); 
                    }
                }));

                // CATALOG: lazy on first Produk → Katalog tab (see Product/page.tsx + useCatalogSearch)
                // No eager import here — keeps app start fast.

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

                // Customers & Groups (grosir)
                subscribe(onSnapshot(collection(db, 'customers'), (snap: any) => {
                    setCustomers(snap.docs.map((d: any) => d.data() as Customer));
                }));
                subscribe(onSnapshot(collection(db, 'customer_groups'), (snap: any) => {
                    setCustomerGroups(snap.docs.map((d: any) => d.data() as CustomerGroup));
                }));
                // Seed default customer groups if missing
                {
                    const groupsSnap = await (async () => {
                        const { getDocs } = firesqlite;
                        try { return await getDocs(collection(db, 'customer_groups')); } catch { return null; }
                    })();
                    if (groupsSnap && groupsSnap.docs.length === 0) {
                        const { setDoc } = firesqlite;
                        const defaults: CustomerGroup[] = [
                            { id: 'grp-umum', name: 'Umum', rank: 0, topDays: 0, is_active: true, created_at: new Date().toISOString() },
                            { id: 'grp-reseller', name: 'Reseller', rank: 1, topDays: 7, is_active: true, created_at: new Date().toISOString() },
                            { id: 'grp-agen', name: 'Agen', rank: 2, topDays: 14, is_active: true, created_at: new Date().toISOString() },
                            { id: 'grp-distributor', name: 'Distributor', rank: 3, topDays: 30, is_active: true, created_at: new Date().toISOString() },
                        ];
                        for (const g of defaults) {
                            try { await setDoc(doc(db, 'customer_groups', g.id), g); } catch {}
                        }
                    }
                }


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