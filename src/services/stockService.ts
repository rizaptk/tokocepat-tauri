
import { StockMovement, StockMovementType, WorksheetSubject, WorksheetSession, WorksheetItem, WorksheetSessionWithItems } from '@/lib/types';
import { useDbStore } from '@/lib/db-store';
import { useStore } from '@/lib/store';

export const getStockMovementsByDateRange = async (from: Date, to: Date): Promise<StockMovement[]> => {
    const { db, firesqlite } = useDbStore.getState();
    if (!db || !firesqlite) throw new Error("Database not initialized");

    const { collection, query, where, getDocs, orderBy } = firesqlite;
    
    const movementsRef = collection(db, 'stock_movements');
    const q = query(
        movementsRef,
        where('created_at', 'gte', from.toISOString()),
        where('created_at', 'lte', to.toISOString()),
        orderBy('created_at', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc: any) => doc.data() as StockMovement);
};

export const getStockMovementsByProducts = async (productIds: string[]): Promise<StockMovement[]> => {
    const { db, firesqlite } = useDbStore.getState();
    if (!db || !firesqlite || productIds.length === 0) return [];

    const { collection, query, where, getDocs, orderBy, limit } = firesqlite;
    
    const movementsRef = collection(db, 'stock_movements');
    // Note: 'in' operator is supported in firesqlite for array filtering
    const q = query(
        movementsRef,
        where('product_id', 'in', productIds),
        orderBy('product_id', 'desc'),
        orderBy('created_at', 'desc'),
        limit(50)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc: any) => doc.data() as StockMovement);
};

type AdjustmentData = {
    product_id: string;
    type: StockMovementType;
    qty_change: number;
    reason: string;
    qty_change_uom?: number;
    uom_id?: string;
    uom_name?: string;
    uom_factor?: number;
}

export const adjustStock = async (data: AdjustmentData): Promise<void> => {
    const { db, firesqlite } = useDbStore.getState();
    const { products } = useStore.getState();

    if (!db || !firesqlite) throw new Error("Database not initialized");

    const { doc, setDoc, updateDoc } = firesqlite;
    
    const product = products.find(p => p.id === data.product_id);
    if (!product) throw new Error("Produk tidak ditemukan");

    const now = new Date().toISOString();
    const movementId = `sm-${crypto.randomUUID().slice(0, 8)}`;

    const newStock = product.stock + data.qty_change;

    const stockMovement: StockMovement = {
        id: movementId,
        product_id: data.product_id,
        product_name_snapshot: product.name,
        type: data.type,
        qty_change: data.qty_change,
        qty_change_uom: data.qty_change_uom,
        uom_id: data.uom_id,
        uom_name: data.uom_name,
        uom_factor: data.uom_factor,
        reason: data.reason,
        reference_id: `manual-${movementId}`,
        created_at: now,
    };

    // --- Database Operations ---
    // 1. Create the stock movement record for auditing
    await setDoc(doc(db, 'stock_movements', movementId), stockMovement);

    // 2. Update the product's stock level
    const productRef = doc(db, 'products', data.product_id);
    await updateDoc(productRef, { stock: newStock, updated_at: now });
};

export const adjustVariantStock = async (variantId: string, type: StockMovementType, qty_change: number, reason: string, uom?: { qty_change_uom?: number; uom_id?: string; uom_name?: string; uom_factor?: number }): Promise<void> => {
    const { db, firesqlite } = useDbStore.getState();
    const { productVariants, products } = useStore.getState();
    if (!db || !firesqlite) throw new Error("Database not initialized");

    const { doc, setDoc, updateDoc } = firesqlite;
    const variant = productVariants.find(v => v.id === variantId);
    if (!variant) throw new Error("Variant not found");

    const parentProduct = products.find(p => p.id === variant.product_id);
    const productNameSnapshot = parentProduct ? `${parentProduct.name} (${variant.name})` : variant.name;

    const newStock = variant.stock + qty_change;
    const now = new Date().toISOString();
    const movementId = `sm-var-${crypto.randomUUID().slice(0, 8)}`;

    const stockMovement: StockMovement = {
        id: movementId,
        product_id: variant.id,
        product_name_snapshot: productNameSnapshot,
        type: type,
        qty_change: qty_change,
        qty_change_uom: uom?.qty_change_uom,
        uom_id: uom?.uom_id,
        uom_name: uom?.uom_name,
        uom_factor: uom?.uom_factor,
        reason: reason,
        reference_id: `manual-var-${movementId}`,
        created_at: now,
    };

    await setDoc(doc(db, 'stock_movements', movementId), stockMovement);
    await updateDoc(doc(db, 'product_variants', variantId), { stock: newStock, updated_at: now });
};

// =============================================
// WORKSHEET SESSION (v0.7) - stockService
// =============================================
const WORKSHEET_COLLECTION = 'worksheet_sessions';

function genSessionName(date: Date = new Date()): string {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `WS-${yyyy}${mm}${dd}-${Date.now().toString(36).toUpperCase()}`;
}

export const createWorksheetSession = async (data: {
    session_date: string;
    created_by: string;
    subject: WorksheetSubject;
    subject_other?: string;
    description: string;
    related_party?: string;
}): Promise<string> => {
    const { db, firesqlite } = useDbStore.getState();
    if (!db || !firesqlite) throw new Error("Database not initialized");
    const { doc, setDoc } = firesqlite;
    const sessionId = `ws-${crypto.randomUUID().slice(0, 12)}`;
    const now = new Date().toISOString();
    const session: WorksheetSession = {
        id: sessionId,
        name: genSessionName(new Date(data.session_date)),
        status: 'draft',
        session_date: data.session_date,
        created_at: now,
        created_by: data.created_by,
        subject: data.subject,
        subject_other: data.subject_other,
        description: data.description,
        related_party: data.related_party,
    };
    await setDoc(doc(db, WORKSHEET_COLLECTION, sessionId), session);
    return sessionId;
};

export const getWorksheetSession = async (sessionId: string): Promise<WorksheetSession | null> => {
    const { db, firesqlite } = useDbStore.getState();
    if (!db || !firesqlite) throw new Error("Database not initialized");
    const { doc, getDoc } = firesqlite;
    const snap = await getDoc(doc(db, WORKSHEET_COLLECTION, sessionId));
    return snap.exists() ? (snap.data() as WorksheetSession) : null;
};

export const getWorksheetSessionWithItems = async (sessionId: string): Promise<WorksheetSessionWithItems | null> => {
    const { db, firesqlite } = useDbStore.getState();
    if (!db || !firesqlite) throw new Error("Database not initialized");
    const { doc, getDoc, collection, query, getDocs } = firesqlite;
    const sessionSnap = await getDoc(doc(db, WORKSHEET_COLLECTION, sessionId));
    if (!sessionSnap.exists()) return null;
    const session = sessionSnap.data() as WorksheetSession;
    const itemsRef = collection(db, `${WORKSHEET_COLLECTION}/${sessionId}/items`);
    const itemsSnap = await getDocs(query(itemsRef));
    const items = itemsSnap.docs.map((d: any) => d.data() as WorksheetItem);
    return { ...session, items };
};

export const listWorksheetSessions = async (options?: { status?: 'draft' | 'committed' | 'cancelled'; limit?: number; startAfterDoc?: any }): Promise<WorksheetSession[]> => {
    const { db, firesqlite } = useDbStore.getState();
    if (!db || !firesqlite) throw new Error("Database not initialized");
    const { collection, query, where, orderBy, limit, getDocs, startAfter } = firesqlite;
    const constraints: any[] = [orderBy('created_at', 'desc')];
    if (options?.status) constraints.unshift(where('status', 'eq', options.status));
    if (options?.limit) constraints.push(limit(options.limit));
    if (options?.startAfterDoc) constraints.push(startAfter(options.startAfterDoc));
    const q = query(collection(db, WORKSHEET_COLLECTION), ...constraints);
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d: any) => d.data() as WorksheetSession);
};

export const subscribeWorksheetSessions = (onUpdate: (sessions: WorksheetSession[]) => void, status?: 'draft' | 'committed' | 'cancelled'): (() => void) => {
    const { db, firesqlite } = useDbStore.getState();
    if (!db || !firesqlite) throw new Error("Database not initialized");
    const { collection, query, where, orderBy, onSnapshot } = firesqlite;
    const constraints: any[] = [orderBy('created_at', 'desc')];
    if (status) constraints.unshift(where('status', 'eq', status));
    const q = query(collection(db, WORKSHEET_COLLECTION), ...constraints);
    return onSnapshot(q, (snapshot: any) => {
        const sessions = snapshot.docs.map((d: any) => d.data() as WorksheetSession);
        onUpdate(sessions);
    });
};

export const updateWorksheetSession = async (sessionId: string, data: Partial<WorksheetSession>): Promise<void> => {
    const { db, firesqlite } = useDbStore.getState();
    if (!db || !firesqlite) throw new Error("Database not initialized");
    const { doc, updateDoc } = firesqlite;
    await updateDoc(doc(db, WORKSHEET_COLLECTION, sessionId), { ...data, updated_at: new Date().toISOString() } as any);
};

export const cancelWorksheetSession = async (sessionId: string): Promise<void> => {
    return updateWorksheetSession(sessionId, { status: 'cancelled' });
};

export const addWorksheetItem = async (sessionId: string, item: Omit<WorksheetItem, 'id' | 'session_id' | 'created_at' | 'updated_at'>): Promise<string> => {
    const { db, firesqlite } = useDbStore.getState();
    if (!db || !firesqlite) throw new Error("Database not initialized");
    const { doc, setDoc } = firesqlite;
    const itemId = `wsi-${crypto.randomUUID().slice(0, 12)}`;
    const now = new Date().toISOString();
    const newItem: WorksheetItem = { ...item, id: itemId, session_id: sessionId, created_at: now, updated_at: now };
    await setDoc(doc(db, `${WORKSHEET_COLLECTION}/${sessionId}/items`, itemId), newItem);
    return itemId;
};

export const updateWorksheetItem = async (sessionId: string, itemId: string, data: Partial<WorksheetItem>): Promise<void> => {
    const { db, firesqlite } = useDbStore.getState();
    if (!db || !firesqlite) throw new Error("Database not initialized");
    const { doc, updateDoc } = firesqlite;
    await updateDoc(doc(db, `${WORKSHEET_COLLECTION}/${sessionId}/items`, itemId), { ...data, updated_at: new Date().toISOString() } as any);
};

export const removeWorksheetItem = async (sessionId: string, itemId: string): Promise<void> => {
    const { db, firesqlite } = useDbStore.getState();
    if (!db || !firesqlite) throw new Error("Database not initialized");
    const { doc, deleteDoc } = firesqlite;
    await deleteDoc(doc(db, `${WORKSHEET_COLLECTION}/${sessionId}/items`, itemId));
};

export const getWorksheetItems = async (sessionId: string): Promise<WorksheetItem[]> => {
    const { db, firesqlite } = useDbStore.getState();
    if (!db || !firesqlite) throw new Error("Database not initialized");
    const { collection, query, orderBy, getDocs } = firesqlite;
    const itemsRef = collection(db, `${WORKSHEET_COLLECTION}/${sessionId}/items`);
    const q = query(itemsRef, orderBy('created_at', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d: any) => d.data() as WorksheetItem);
};

export const subscribeWorksheetItems = (sessionId: string, onUpdate: (items: WorksheetItem[]) => void): (() => void) => {
    const { db, firesqlite } = useDbStore.getState();
    if (!db || !firesqlite) throw new Error("Database not initialized");
    const { collection, query, orderBy, onSnapshot } = firesqlite;
    const itemsRef = collection(db, `${WORKSHEET_COLLECTION}/${sessionId}/items`);
    const q = query(itemsRef, orderBy('created_at', 'asc'));
    return onSnapshot(q, (snapshot: any) => {
        const items = snapshot.docs.map((d: any) => d.data() as WorksheetItem);
        onUpdate(items);
    });
};

export const commitWorksheetSession = async (sessionId: string, committedBy: string): Promise<{ movements: StockMovement[] }> => {
    const { db, firesqlite } = useDbStore.getState();
    const { products, productVariants } = useStore.getState();
    if (!db || !firesqlite) throw new Error("Database not initialized");
    const { doc, writeBatch } = firesqlite;
    const session = await getWorksheetSessionWithItems(sessionId);
    if (!session) throw new Error("Sesi worksheet tidak ditemukan");
    if (session.status !== 'draft') throw new Error("Hanya sesi draft yang dapat dikomit");
    if (!session.items.length) throw new Error("Sesi tidak memiliki item");
    for (const item of session.items) {
        if (!item.action || item.qty <= 0) throw new Error(`Item ${item.product_name_snapshot}: aksi dan jumlah wajib diisi`);
        if (item.action === 'kurang') {
            const product = products.find(p => p.id === item.product_id);
            const variant = item.variant_id ? productVariants.find(v => v.id === item.variant_id) : null;
            const currentStock = variant?.stock ?? product?.stock ?? 0;
            if (currentStock < item.qty) throw new Error(`Stok tidak cukup untuk ${item.product_name_snapshot}: tersedia ${currentStock}, diminta ${item.qty}`);
        }
    }
    const batch = writeBatch(db);
    const movements: StockMovement[] = [];
    for (const item of session.items) {
        const product = products.find(p => p.id === item.product_id);
        const variant = item.variant_id ? productVariants.find(v => v.id === item.variant_id) : null;
        if (!product && !variant) throw new Error(`Produk ${item.product_name_snapshot} tidak ditemukan`);
        let currentStock = 0;
        let productNameSnapshot = '';
        let productIdForMovement = '';
        if (variant) {
            currentStock = variant.stock;
            productNameSnapshot = `${product?.name || ''} (${variant.name})`;
            productIdForMovement = variant.id;
        } else {
            currentStock = product?.stock ?? 0;
            productNameSnapshot = product?.name || item.product_name_snapshot;
            productIdForMovement = product?.id || item.product_id;
        }
        let qtyChange = 0;
        switch (item.action) {
            case 'tambah': qtyChange = item.qty; break;
            case 'kurang': qtyChange = -item.qty; break;
            case 'koreksi': qtyChange = item.qty - currentStock; break;
        }
        if (qtyChange === 0) continue;
        const movementId = `sm-ws-${crypto.randomUUID().slice(0, 8)}`;
        const movement: StockMovement = {
            id: movementId,
            product_id: productIdForMovement,
            product_name_snapshot: productNameSnapshot,
            type: 'worksheet_commit',
            qty_change: qtyChange,
            qty_change_uom: item.qty,
            uom_id: item.uom_id,
            uom_name: item.uom_name,
            uom_factor: item.uom_factor,
            reason: `${item.action === 'tambah' ? 'Tambah' : item.action === 'kurang' ? 'Kurang' : 'Koreksi'} via worksheet ${session.name}`,
            reference_id: `ws-${sessionId}-${item.id}`,
            created_at: new Date().toISOString(),
            worksheet_session_id: sessionId,
            worksheet_item_id: item.id,
        };
        if (variant) batch.update(doc(db, 'product_variants', variant.id), { stock: variant.stock + qtyChange, updated_at: new Date().toISOString() });
        else batch.update(doc(db, 'products', product!.id), { stock: product!.stock + qtyChange, updated_at: new Date().toISOString() });
        batch.set(doc(db, 'stock_movements', movementId), movement);
        movements.push(movement);
    }
    batch.update(doc(db, WORKSHEET_COLLECTION, sessionId), { status: 'committed', committed_at: new Date().toISOString(), committed_by: committedBy } as any);
    await batch.commit();
    return { movements };
};

export const computePhysicalQty = (item: WorksheetItem): number => {
    switch (item.action) {
        case 'tambah': return item.system_qty + item.qty;
        case 'kurang': return Math.max(0, item.system_qty - item.qty);
        case 'koreksi': return item.qty;
        default: return item.system_qty;
    }
};
