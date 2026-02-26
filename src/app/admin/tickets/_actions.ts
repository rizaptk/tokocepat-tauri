'use server';

import { db } from '@/lib/firebase-admin';
import { PaymentTicket, PaymentPlan } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import { randomBytes } from 'crypto';

export async function getPaymentTicketsAction(): Promise<{ tickets: PaymentTicket[] } | { error: string }> {
    try {
        const snapshot = await db.collection('paymentTickets').orderBy('createdAt', 'desc').get();
        const tickets = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                createdAt: data.createdAt.toDate().toISOString(),
                updatedAt: data.updatedAt.toDate().toISOString(),
            } as PaymentTicket
        });
        return { tickets };
    } catch (error: any) {
        console.error("Failed to fetch payment tickets", error);
        return { error: 'Could not connect to the database to fetch tickets.' };
    }
}

export type TicketStatusUpdate = {
    ticketId: string;
    newStatus: 'processing' | 'resolved' | 'rejected';
    notes?: string;
};

export async function updateTicketStatusAction(data: TicketStatusUpdate): Promise<{ success: boolean, error?: string }> {
    const { ticketId, newStatus, notes } = data;

    const ticketRef = db.collection('paymentTickets').doc(ticketId);

    try {
        const ticketSnap = await ticketRef.get();
        if (!ticketSnap.exists) {
            return { success: false, error: 'Ticket not found.' };
        }
        const ticketData = ticketSnap.data() as PaymentTicket;

        if (newStatus === 'resolved') {
            const { customerEmail, plan } = ticketData;

            // --- Find or Create Customer ---
            const customersRef = db.collection('customers');
            let customerQuery = await customersRef.where('email', '==', customerEmail).limit(1).get();
            let customerId: string;
             if (customerQuery.empty) {
                const newCustomerRef = await customersRef.add({ email: customerEmail, createdAt: new Date(), licenseCount: 0 });
                customerId = newCustomerRef.id;
            } else {
                customerId = customerQuery.docs[0].id;
            }

            // --- Find existing license for this customer to renew, or create new ---
            const licensesRef = db.collection('licenses');
            const licenseQuery = await licensesRef.where('customerId', '==', customerId).limit(1).get();

            let finalLicenseId: string;

            if (!licenseQuery.empty) { // RENEWAL / EXTENSION
                const licenseDoc = licenseQuery.docs[0];
                finalLicenseId = licenseDoc.id;
                const licenseData = licenseDoc.data();
                
                let currentExpiresAt = (licenseData.expiresAt && licenseData.expiresAt.toDate() > new Date()) 
                    ? licenseData.expiresAt.toDate() 
                    : new Date();

                let newExpiresAt: Date | null = licenseData.expiresAt ? licenseData.expiresAt.toDate() : null;
                if (plan === 'PRO_YEARLY') {
                    newExpiresAt = new Date(currentExpiresAt.setFullYear(currentExpiresAt.getFullYear() + 1));
                } else if (plan === 'PRO_MONTHLY') {
                    newExpiresAt = new Date(currentExpiresAt.setMonth(currentExpiresAt.getMonth() + 1));
                } else if (plan === 'LIFETIME') {
                    newExpiresAt = null; // Lifetime licenses don't expire
                }
                
                await licenseDoc.ref.update({
                    status: 'active',
                    expiresAt: newExpiresAt
                });

            } else { // NEW LICENSE
                const licenseKey = `TKN-${randomBytes(4).toString('hex').toUpperCase()}-${randomBytes(4).toString('hex').toUpperCase()}`;
                let expiresAt: Date | null = null;
                if (plan === 'PRO_YEARLY') expiresAt = new Date(new Date().setFullYear(new Date().getFullYear() + 1));
                if (plan === 'PRO_MONTHLY') expiresAt = new Date(new Date().setMonth(new Date().getMonth() + 1));

                const newLicense = {
                  key: licenseKey, plan, status: 'active', customerId,
                  createdAt: new Date(), expiresAt, activations: [], maxSeats: 1,
                };
                const newLicenseRef = await db.collection('licenses').add(newLicense);
                finalLicenseId = newLicenseRef.id;

                // Update customer's license count
                const customerDoc = await db.collection('customers').doc(customerId).get();
                const currentCount = customerDoc.data()?.licenseCount || 0;
                await db.collection('customers').doc(customerId).update({ licenseCount: currentCount + 1 });
            }
             await ticketRef.update({ status: 'resolved', notes, licenseId: finalLicenseId, updatedAt: new Date() });

        } else { // For 'processing' or 'rejected'
            await ticketRef.update({ status: newStatus, notes, updatedAt: new Date() });
        }

        revalidatePath('/admin/tickets');
        return { success: true };
    } catch (error: any) {
        console.error("Failed to update ticket status:", error);
        return { success: false, error: 'An unexpected server error occurred.' };
    }
}
