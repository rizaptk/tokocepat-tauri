import { Customer, CustomerGroup } from '@/lib/types';
import { useDbStore } from '@/lib/db-store';

export const generateCustomerId = () => `cust-${crypto.randomUUID().slice(0, 8)}`;
export const generateGroupId = () => `grp-${crypto.randomUUID().slice(0, 8)}`;

export const saveCustomer = async (customer: Customer): Promise<void> => {
  const { db, firesqlite } = useDbStore.getState();
  if (!db || !firesqlite) throw new Error('Database not initialized');
  const { doc, setDoc } = firesqlite;
  await setDoc(doc(db, 'customers', customer.id), customer);
};

export const deleteCustomer = async (id: string): Promise<void> => {
  const { db, firesqlite } = useDbStore.getState();
  if (!db || !firesqlite) throw new Error('Database not initialized');
  const { doc, deleteDoc } = firesqlite;
  await deleteDoc(doc(db, 'customers', id));
};

export const saveCustomerGroup = async (group: CustomerGroup): Promise<void> => {
  const { db, firesqlite } = useDbStore.getState();
  if (!db || !firesqlite) throw new Error('Database not initialized');
  const { doc, setDoc } = firesqlite;
  await setDoc(doc(db, 'customer_groups', group.id), group);
};

export const deleteCustomerGroup = async (id: string): Promise<void> => {
  const { db, firesqlite } = useDbStore.getState();
  if (!db || !firesqlite) throw new Error('Database not initialized');
  const { doc, deleteDoc } = firesqlite;
  await deleteDoc(doc(db, 'customer_groups', id));
};
