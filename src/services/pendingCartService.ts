
import { useDbStore } from '@/lib/db-store';
import { CartItem, PendingCart } from '@/lib/types';
import { toast } from '@/hooks/use-toast';

export const parkCartInDb = async (cart: CartItem[], total: number, itemCount: number): Promise<void> => {
    const { db, firesqlite } = useDbStore.getState();
    if (!db || !firesqlite) throw new Error("Database not initialized");

    const { doc, setDoc } = firesqlite;
    const now = new Date();
    const newId = `parked-${crypto.randomUUID().slice(0, 8)}`;
    
    const newPendingCart: PendingCart = {
        id: newId,
        name: `Pesanan @ ${now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`,
        createdAt: now.toISOString(),
        items: cart,
        itemCount: itemCount,
        total: total,
    };

    await setDoc(doc(db, 'pending_carts', newId), newPendingCart);
    toast({ title: "Pesanan Ditunda", description: `Keranjang disimpan sebagai "${newPendingCart.name}".` });
};

export const deletePendingCartFromDb = async (id: string): Promise<void> => {
    const { db, firesqlite } = useDbStore.getState();
    if (!db || !firesqlite) throw new Error("Database not initialized");
    
    const { doc, deleteDoc } = firesqlite;
    await deleteDoc(doc(db, 'pending_carts', id));
};
