import { Promotion } from '@/lib/types';
import { useDbStore } from '@/lib/db-store';

/** Upsert a promotion/voucher rule into the `promos` collection. */
export const savePromo = async (promo: Promotion): Promise<void> => {
    const { db, firesqlite } = useDbStore.getState();
    if (!db || !firesqlite) throw new Error("Database belum diinisialisasi");

    const { doc, setDoc } = firesqlite;
    await setDoc(doc(db, 'promos', promo.id), promo);
};

export const deletePromo = async (promoId: string): Promise<void> => {
    const { db, firesqlite } = useDbStore.getState();
    if (!db || !firesqlite) throw new Error("Database belum diinisialisasi");

    const { doc, deleteDoc } = firesqlite;
    await deleteDoc(doc(db, 'promos', promoId));
};

export const setPromoActive = async (promoId: string, isActive: boolean): Promise<void> => {
    const { db, firesqlite } = useDbStore.getState();
    if (!db || !firesqlite) throw new Error("Database belum diinisialisasi");

    const { doc, updateDoc } = firesqlite;
    await updateDoc(doc(db, 'promos', promoId), { is_active: isActive });
};

export const generatePromoId = () => `promo-${crypto.randomUUID().slice(0, 8)}`;