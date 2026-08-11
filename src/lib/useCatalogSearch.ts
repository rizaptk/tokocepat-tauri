import { useEffect, useState } from 'react';
import { useDbStore } from '@/lib/db-store';
import type { CatalogProduct } from '@/lib/types';

// The bundled catalog is static reference data (~11k rows). Loading it into the
// React store on every app boot is expensive (a full snapshot is pushed over IPC
// and rebuilt on each import batch), so we fetch it lazily once per session and
// cache it here. The catalog is only materialized when the user actually
// searches for a product that is not in their store.
let catalogCache: CatalogProduct[] | null = null;
let loadPromise: Promise<CatalogProduct[]> | null = null;

const isCatalogLoaded = () => catalogCache !== null;

const loadCatalog = async (): Promise<CatalogProduct[]> => {
    if (catalogCache) return catalogCache;
    if (!loadPromise) {
        loadPromise = (async () => {
            const { db, firesqlite } = useDbStore.getState();
            if (!db || !firesqlite) return [];
            const { collection, getDocs } = firesqlite;
            try {
                const snap = await getDocs(collection(db, 'catalog'));
                catalogCache = snap.docs.map((d: any) => d.data() as CatalogProduct);
            } catch {
                catalogCache = [];
            }
            return catalogCache;
        })();
    }
    return loadPromise;
};

export const searchCatalog = async (q: string): Promise<CatalogProduct[]> => {
    const catalog = await loadCatalog();
    const query = q.trim().toLowerCase();
    if (!query) return [];
    return catalog
        .filter(p =>
            p.name.toLowerCase().includes(query)
            || (p.barcode || '').includes(query)
            || (p.brand || '').toLowerCase().includes(query)
            || (p.brand_owner || '').toLowerCase().includes(query)
            || (p.generic_name || '').toLowerCase().includes(query)
        )
        .slice(0, 40);
};

export const getCatalogItemByBarcode = async (barcode: string): Promise<CatalogProduct | undefined> => {
    const catalog = await loadCatalog();
    return catalog.find(p => p.barcode === barcode);
};

/**
 * Reactive catalog search: debounced, async, resolves to the top 40 matches.
 * `loading` is true only while the catalog is being fetched for the first time
 * (the ~11k-row IPC read can be slow); cached searches resolve instantly.
 */
export const useCatalogSearch = (query: string): { hits: CatalogProduct[]; loading: boolean } => {
    const [hits, setHits] = useState<CatalogProduct[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let isMounted = true;
        const q = query.trim();
        if (!q) {
            setHits([]);
            setLoading(false);
            return;
        }

        const needsFetch = !isCatalogLoaded();
        if (needsFetch) setLoading(true);

        const timer = setTimeout(async () => {
            try {
                const results = await searchCatalog(q);
                if (isMounted) setHits(results);
            } finally {
                if (isMounted) setLoading(false);
            }
        }, needsFetch ? 0 : 150);

        return () => {
            isMounted = false;
            clearTimeout(timer);
        };
    }, [query]);

    return { hits, loading };
};
