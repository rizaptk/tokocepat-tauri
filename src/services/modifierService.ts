
import { ModifierGroup, ModifierItem } from '@/lib/types';
import { useDbStore } from '@/lib/db-store';

type ModifierGroupData = Omit<ModifierGroup, 'id' | 'items'>;

export const addModifierGroup = async (groupData: ModifierGroupData): Promise<ModifierGroup> => {
    const { db, firesqlite } = useDbStore.getState();
    if (!db || !firesqlite) throw new Error("Database not initialized");

    const { doc, setDoc } = firesqlite;
    const newId = `mg-${crypto.randomUUID().slice(0, 8)}`;
    const newGroup: ModifierGroup = {
        id: newId,
        ...groupData,
        items: [],
    };
    await setDoc(doc(db, 'modifier_groups', newGroup.id), newGroup);
    return newGroup;
};

export const updateModifierGroup = async (id: string, groupData: Partial<ModifierGroupData>): Promise<void> => {
    const { db, firesqlite } = useDbStore.getState();
    if (!db || !firesqlite) throw new Error("Database not initialized");
    
    const { doc, updateDoc } = firesqlite;
    await updateDoc(doc(db, 'modifier_groups', id), groupData);
};

export const deleteModifierGroup = async (id: string): Promise<void> => {
    // TODO: Check if group is associated with any products before deleting
    const { db, firesqlite } = useDbStore.getState();
    if (!db || !firesqlite) throw new Error("Database not initialized");
    
    const { doc, deleteDoc } = firesqlite;
    await deleteDoc(doc(db, 'modifier_groups', id));
};

export const addModifierItem = async (groupId: string, itemName: string, itemPrice: number): Promise<void> => {
    const { db, firesqlite } = useDbStore.getState();
    if (!db || !firesqlite) throw new Error("Database not initialized");

    const { doc, getDoc, updateDoc } = firesqlite;
    const groupRef = doc(db, 'modifier_groups', groupId);
    const groupSnap = await getDoc(groupRef);

    if (groupSnap.exists()) {
        const group = groupSnap.data() as ModifierGroup;
        const newItem: ModifierItem = {
            id: `mi-${new Date().getTime().toString()}`,
            name: itemName,
            additional_price: itemPrice,
        };
        const updatedItems = [...group.items, newItem];
        await updateDoc(groupRef, { items: updatedItems });
    }
};

export const updateModifierItem = async (groupId: string, itemId: string, itemName: string, itemPrice: number): Promise<void> => {
     const { db, firesqlite } = useDbStore.getState();
    if (!db || !firesqlite) throw new Error("Database not initialized");

    const { doc, getDoc, updateDoc } = firesqlite;
    const groupRef = doc(db, 'modifier_groups', groupId);
    const groupSnap = await getDoc(groupRef);

    if (groupSnap.exists()) {
        const group = groupSnap.data() as ModifierGroup;
        const updatedItems = group.items.map(item => 
            item.id === itemId ? { ...item, name: itemName, additional_price: itemPrice } : item
        );
        await updateDoc(groupRef, { items: updatedItems });
    }
};

export const deleteModifierItem = async (groupId: string, itemId: string): Promise<void> => {
    const { db, firesqlite } = useDbStore.getState();
    if (!db || !firesqlite) throw new Error("Database not initialized");

    const { doc, getDoc, updateDoc } = firesqlite;
    const groupRef = doc(db, 'modifier_groups', groupId);
    const groupSnap = await getDoc(groupRef);

    if (groupSnap.exists()) {
        const group = groupSnap.data() as ModifierGroup;
        const updatedItems = group.items.filter(item => item.id !== itemId);
        await updateDoc(groupRef, { items: updatedItems });
    }
};
