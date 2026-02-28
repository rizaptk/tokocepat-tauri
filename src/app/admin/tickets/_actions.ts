
'use server';

import { db } from '@/lib/firebase-admin';
import { PaymentTicket, SubscriptionPlan } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import { randomBytes } from 'crypto';

// --- Helper function to find or create customer ---
async function findOrCreateCustomer(email: string, name?: string): Promise<string> {
    const customersRef = db.collection('customers');
    const customerQuery = await customersRef.where('email', '==', email).limit(1).get();

    if (customerQuery.empty) {
        const newCustomerRef = await customersRef.add({ email, name: name || '', createdAt: new Date(), licenseCount: 0 });
        return newCustomerRef.id;
    } else {
        const customerDoc = customerQuery.docs[0];
        // If the customer exists but their name was empty or different, update it.
        const currentName = customerDoc.data().name || '';
        if (name && currentName !== name) {
            await customerDoc.ref.update({ name });
        }
        return customerDoc.id;
    }
}


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
                // Safely serialize the claimedAt timestamp if it exists
                claimedAt: data.claimedAt ? data.claimedAt.toDate().toISOString() : undefined,
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
            const { customerEmail, plan: planName, customerName, deviceId } = ticketData;

            // --- Get Plan Details ---
            const plansSnap = await db.collection('app_settings').doc('subscriptionPlans').get();
            if (!plansSnap.exists) throw new Error("Subscription plans are not configured.");
            
            const allPlans = (plansSnap.data()?.plans || []) as SubscriptionPlan[];
            const purchasedPlan = allPlans.find(p => p.name === planName);
            if (!purchasedPlan) {
                throw new Error(`Plan "${planName}" not found in settings.`);
            }

            // --- Find or Create Customer ---
            const customerId = await findOrCreateCustomer(customerEmail, customerName);
            
            // --- GENERATE LICENSE IN A "READY" STATE ---
            const licenseKey = `TKN-${randomBytes(4).toString('hex').toUpperCase()}-${randomBytes(4).toString('hex').toUpperCase()}`;
            
            const newLicenseData = {
              key: licenseKey, 
              plan: purchasedPlan.name,
              status: 'active', // 'active' means the key is valid to be claimed
              customerId,
              createdAt: new Date(), 
              expiresAt: null, // Expiration is set upon user activation, not admin approval
              activations: [], // Activations array is initially empty
              maxSeats: purchasedPlan.maxSeats,
            };
            const newLicenseRef = await db.collection('licenses').add(newLicenseData);
            
            // Update customer's license count
            const customerDoc = await db.collection('customers').doc(customerId).get();
            const currentCount = customerDoc.data()?.licenseCount || 0;
            await db.collection('customers').doc(customerId).update({ licenseCount: currentCount + 1 });
            
            // Link the generated license key and ID back to the ticket
            await ticketRef.update({ 
                status: 'resolved', 
                notes: notes || 'Approved and license ready for activation.', // Add default note
                licenseKey: licenseKey,
                licenseId: newLicenseRef.id,
                updatedAt: new Date() 
            });

        } else { // For 'processing' or 'rejected'
            const updatePayload: { status: string; updatedAt: Date; notes?: string } = {
                status: newStatus,
                updatedAt: new Date(),
            };
            if (notes) {
                updatePayload.notes = notes;
            }
            await ticketRef.update(updatePayload);
        }

        revalidatePath('/admin/tickets');
        revalidatePath('/admin/licenses');
        revalidatePath('/admin/customers');
        return { success: true };
    } catch (error: any) {
        console.error("Failed to update ticket status:", error);
        return { success: false, error: 'An unexpected server error occurred.' };
    }
}

export async function getTicketStatusForDevice(deviceId: string): Promise<{ ticketId: string; status: PaymentTicket['status']; plan: string; createdAt: string } | null> {
    console.log(`[getTicketStatusForDevice] Checking status for deviceId: ${deviceId ? deviceId.substring(0,10) + '...' : 'N/A'}`);
    if (!deviceId) return null;
    try {
        const snapshot = await db.collection('paymentTickets')
            .where('deviceId', '==', deviceId)
            .orderBy('createdAt', 'desc')
            .limit(1)
            .get();

        if (snapshot.empty) {
            console.log('[getTicketStatusForDevice] No tickets found for this device.');
            return null;
        }

        const ticket = snapshot.docs[0].data();
        const ticketId = snapshot.docs[0].id;
        
        console.log(`[getTicketStatusForDevice] Most recent ticket status for this device is '${ticket.status}'. Claimed at:`, ticket.claimedAt);

        // Don't show rejected or already resolved/claimed tickets as "in progress"
        if (ticket.status === 'rejected' || (ticket.status === 'resolved' && ticket.claimedAt)) {
            console.log(`[getTicketStatusForDevice] Ticket is already resolved/claimed or rejected. Not showing status card.`);
            return null;
        }

        const result = {
            ticketId: ticketId,
            status: ticket.status as PaymentTicket['status'],
            plan: ticket.plan,
            createdAt: ticket.createdAt.toDate().toISOString(),
        };

        console.log('[getTicketStatusForDevice] Returning status info to client:', result);
        return result;
    } catch (error) {
        console.error("[getTicketStatusForDevice] Failed to fetch ticket status:", error);
        return null; // Return null on error to not block the UI
    }
}
