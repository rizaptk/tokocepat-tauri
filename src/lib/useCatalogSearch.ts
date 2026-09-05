import { useEffect, useState } from 'react';
import { useDbStore } from '@/lib/db-store';
import type { CatalogProduct } from '@/lib/types';

// The bundled catalog is static reference data (~11k rows, ~30 fields each).
// Loading it into the React store on every app boot is expensive, so we fetch
// it lazily once per session and cache it here. Two trims keep that one fetch
// cheap: a `select()` projection drops the long-text fields the search/list
// never read (ingredients, tags, origins…), and each row precomputes a
// lowercase `_hay` haystack so per-keystroke filtering is one `includes()`
// pass with no repeated `toLowerCase()` over 11k rows.
type CatalogRow = CatalogProduct & { _hay: string };

let catalogCache: CatalogRow[] | null = null;
let loadPromise: Promise<CatalogRow[]> | null = null;

// Fields read by search, list rows, or the promote-to-product form.
// `id` comes from the snapshot, not the doc, so it needs no projection.
const SELECT_FIELDS = [
    'barcode', 'name', 'brand', 'brand_owner', 'generic_name',
    'category_id', 'category_name', 'price', 'cost_price',
    'stock', 'low_stock_alert', 'image_url', 'image_small_url',
];

const isCatalogLoaded = () => catalogCache !== null;

const toHay = (p: CatalogProduct): string =>
    `${p.name || ''} ${p.barcode || ''} ${p.brand || ''} ${p.brand_owner || ''} ${p.generic_name || ''}`.toLowerCase();

const loadCatalog = async (): Promise<CatalogRow[]> => {
    if (catalogCache) return catalogCache;
    if (!loadPromise) {
        loadPromise = (async () => {
            const { db, firesqlite } = useDbStore.getState();
            if (!db || !firesqlite) return [];
            const { collection, getDocs, query, select } = firesqlite;
            try {
                const snap = await getDocs(query(collection(db, 'catalog'), select(...SELECT_FIELDS)));
                catalogCache = snap.docs.map((d: any) => {
                    const data = d.data() as CatalogProduct;
                    return { ...data, _hay: toHay(data) };
                });
            } catch {
                catalogCache = [];
            }
            return catalogCache;
        })();
    }
    return loadPromise;
};

/** Warm the session cache in the background (e.g. when the Katalog tab opens). */
export const prefetchCatalog = (): void => {
    loadCatalog().catch(() => {});
};

export const searchCatalog = async (q: string): Promise<CatalogProduct[]> => {
    const catalog = await loadCatalog();
    const query = q.trim().toLowerCase();
    if (!query) return [];
    return catalog.filter(p => p._hay.includes(query));
};

export const getCatalogItemByBarcode = async (barcode: string): Promise<CatalogProduct | undefined> => {
    const { db, firesqlite } = useDbStore.getState();
    if (!db || !firesqlite) return undefined;
    // Exact point lookup (secondary index on catalog.barcode) — never
    // materialize the 11k cache for a single-barcode probe.
    const { collection, getDocs, limit, query, where } = firesqlite;
    try {
        const snap = await getDocs(query(
            collection(db, 'catalog'),
            where('barcode', 'eq', barcode),
            limit(1),
        ));
        const doc = snap.docs[0] as any;
        return doc ? (doc.data() as CatalogProduct) : undefined;
    } catch {
        return undefined;
    }
};

/**
 * Reactive catalog search: debounced, async, resolves to all matching rows
 * (the caller paginates for rendering). `loading` is true only while the
 * catalog is being fetched for the first time (the ~11k-row IPC read can be
 * slow); cached searches resolve instantly.
 */
export const useCatalogSearch = (query: string, enabled = true): { hits: CatalogProduct[]; loading: boolean } => {
    const [hits, setHits] = useState<CatalogProduct[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let isMounted = true;
        if (!enabled) {
            setHits([]);
            setLoading(false);
            return;
        }
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
    }, [query, enabled]);

    return { hits, loading };
};
