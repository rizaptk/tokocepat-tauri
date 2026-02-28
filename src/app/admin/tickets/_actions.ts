
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

            // --- Find existing license to renew, or create new ---
            const licensesRef = db.collection('licenses');
            let licenseQuery;
            // Prefer finding license by device ID if it was a trial, otherwise by customer
            if (deviceId) {
                // This query is unlikely to work due to how Firestore handles array-contains with objects,
                // but we keep it as a potential first-pass check. The customerId query is the reliable fallback.
                licenseQuery = await licensesRef.where('activations', 'array-contains', { deviceId: deviceId, isActive: true }).limit(1).get();
            }
            if (!licenseQuery || licenseQuery.empty) {
                licenseQuery = await licensesRef.where('customerId', '==', customerId).limit(1).get();
            }

            let finalLicenseKey: string;

            if (!licenseQuery.empty) { // RENEWAL / UPGRADE SCENARIO
                const licenseDoc = licenseQuery.docs[0];
                finalLicenseKey = licenseDoc.data().key;
                const licenseData = licenseDoc.data();
                
                let startDate = new Date();
                // If license exists and hasn't expired, extend from expiry date.
                if (licenseData.expiresAt && licenseData.expiresAt.toDate() > startDate) {
                    startDate = licenseData.expiresAt.toDate();
                }

                let newExpiresAt: Date | null = new Date(startDate.getTime());
                
                if (purchasedPlan.durationDays > 0) {
                     newExpiresAt.setDate(newExpiresAt.getDate() + purchasedPlan.durationDays);
                } else if (purchasedPlan.durationDays === -1) {
                    newExpiresAt = null; // Lifetime plan
                }
                
                await licenseDoc.ref.update({
                    status: 'active',
                    expiresAt: newExpiresAt,
                    plan: purchasedPlan.name,
                    maxSeats: purchasedPlan.maxSeats,
                });

            } else { // NEW LICENSE SCENARIO
                const licenseKey = `TKN-${randomBytes(4).toString('hex').toUpperCase()}-${randomBytes(4).toString('hex').toUpperCase()}`;
                finalLicenseKey = licenseKey;
                
                let expiresAt: Date | null = new Date();
                 if (purchasedPlan.durationDays > 0) {
                     expiresAt.setDate(expiresAt.getDate() + purchasedPlan.durationDays);
                } else if (purchasedPlan.durationDays === -1) {
                    expiresAt = null; // Lifetime plan
                }

                const newLicense = {
                  key: licenseKey, 
                  plan: purchasedPlan.name,
                  status: 'active', 
                  customerId,
                  createdAt: new Date(), 
                  expiresAt, 
                  activations: [], 
                  maxSeats: purchasedPlan.maxSeats,
                };
                await db.collection('licenses').add(newLicense);
                
                // Update customer's license count
                const customerDoc = await db.collection('customers').doc(customerId).get();
                const currentCount = customerDoc.data()?.licenseCount || 0;
                await db.collection('customers').doc(customerId).update({ licenseCount: currentCount + 1 });
            }
            
            // Link the generated license key back to the ticket
            await ticketRef.update({ 
                status: 'resolved', 
                notes: notes || 'Approved and license generated.', // Add default note
                licenseKey: finalLicenseKey, 
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
        // Fetch all tickets instead of querying by a specific field to avoid indexing issues.
        const snapshot = await db.collection('paymentTickets').get();

        if (snapshot.empty) {
            console.log('[getTicketStatusForDevice] No tickets found in collection.');
            return null;
        }
        
        const allTickets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const deviceTickets = allTickets.filter(ticket => ticket.deviceId === deviceId);
        
        console.log(`[getTicketStatusForDevice] Found ${deviceTickets.length} tickets associated with this device.`);


        if (deviceTickets.length === 0) {
            return null;
        }

        // Sort in memory to get the latest ticket for this device
        deviceTickets.sort((a, b) => b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime());

        const ticket = deviceTickets[0]; // Get the most recent one
        console.log(`[getTicketStatusForDevice] Most recent ticket status for this device is '${ticket.status}'. Claimed at:`, ticket.claimedAt);


        // Don't show rejected or already resolved/claimed tickets as "in progress"
        if (ticket.status === 'rejected' || (ticket.status === 'resolved' && ticket.claimedAt)) {
            console.log(`[getTicketStatusForDevice] Ticket is already resolved/claimed or rejected. Not showing status card.`);
            return null;
        }

        const result = {
            ticketId: ticket.id,
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
