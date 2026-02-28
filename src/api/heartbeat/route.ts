
'use server';

import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import * as jose from 'jose';
import * as admin from 'firebase-admin';

export async function POST(request: Request) {
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET_KEY || 'a_very_insecure_default_secret_key_for_development_only'
    );
    const alg = 'HS256';

    try {
        const body = await request.json().catch(() => ({}));
        const { token, deviceId } = body;
        
        console.log(`[Heartbeat API] Received request. DeviceID: ${deviceId ? `${deviceId.substring(0,10)}...` : 'N/A'}. Has Token: ${!!token}`);

        // If client is unlicensed, check if there's a license ready for them to activate.
        if (!token && deviceId) {
             console.log(`[Heartbeat API] Unlicensed client. Starting ticket lookup for device...`);
             const ticketsRef = db.collection('paymentTickets');
             
             const ticketQuery = ticketsRef.where('deviceId', '==', deviceId);
             const ticketSnapshot = await ticketQuery.get();

             console.log(`[Heartbeat API] Firestore query completed. Found ${ticketSnapshot.size} total ticket(s) for this device.`);

             if (!ticketSnapshot.empty) {
                // Map all found tickets and log their raw data for inspection.
                const allDeviceTickets = ticketSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                console.log('[Heartbeat API] Raw data of found tickets:', JSON.stringify(allDeviceTickets, (key, value) => {
                    // Firestore Timestamps can be complex objects, so we'll just show them as ISO strings
                    if (value && value.toDate) {
                        return value.toDate().toISOString();
                    }
                    return value;
                }, 2));

                 // Filter in memory to find the correct ticket.
                 const resolvedAndUnclaimedTickets = allDeviceTickets.filter(ticket => {
                    const isResolved = ticket.status === 'resolved';
                    const isUnclaimed = !ticket.claimedAt; // This is true if claimedAt is null, undefined, or an empty string.
                    console.log(`[Heartbeat API] Checking ticket ${ticket.id}: status='${ticket.status}' (isResolved: ${isResolved}), claimedAt='${ticket.claimedAt}' (isUnclaimed: ${isUnclaimed})`);
                    return isResolved && isUnclaimed;
                 });
                 
                 console.log(`[Heartbeat API] Found ${resolvedAndUnclaimedTickets.length} 'resolved' and 'unclaimed' tickets after filtering.`);

                 if (resolvedAndUnclaimedTickets.length > 0) {
                     // Sort to get the most recent one
                     resolvedAndUnclaimedTickets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                     const ticketToActivate = resolvedAndUnclaimedTickets[0];

                     console.log(`[Heartbeat API] SUCCESS: Selected latest ticket ${ticketToActivate.id}. Instructing client to activate.`);
                     return NextResponse.json({ status: 'activation_required', ticketId: ticketToActivate.id }, { status: 200 });
                 } else {
                     console.log(`[Heartbeat API] No actionable tickets found after filtering.`);
                 }

             }
        }

        // Default session logging logic if token exists
        if (token && deviceId) {
            let sessionData: any;
            try {
                const { payload } = await jose.jwtVerify(token, secret);
                const licenseKey = payload.sub as string;
                const plan = (payload.plan as string) || 'N/A';
                console.log(`[Heartbeat API] Token VERIFIED for device ${deviceId.substring(0,10)}... with license key ${licenseKey}`);

                const licensesRef = db.collection('licenses');
                const query = licensesRef.where('key', '==', licenseKey).limit(1);
                const snapshot = await query.get();

                let customerId = 'unknown';
                let customerEmail = 'unknown';

                if (!snapshot.empty) {
                    const licenseData = snapshot.docs[0].data();
                    customerId = licenseData.customerId || 'unknown';
                    if (customerId !== 'unknown' && customerId.length > 0) {
                        const customerSnap = await db.collection('customers').doc(customerId).get();
                        if (customerSnap.exists) {
                            customerEmail = customerSnap.data()?.email || 'unknown';
                        }
                    }
                }
                
                sessionData = { customerId, customerEmail, licenseKey, plan, lastSeen: admin.firestore.FieldValue.serverTimestamp() };
            } catch (e: any) {
                console.warn(`[Heartbeat API] Token VERIFICATION FAILED for device ${deviceId.substring(0,10)}... Reason: ${e.code || e.message}.`);
                sessionData = { customerId: 'unlicensed', customerEmail: 'unlicensed', licenseKey: 'Invalid Token', plan: 'Invalid Token', lastSeen: admin.firestore.FieldValue.serverTimestamp() };
            }
            
            console.log('[Heartbeat API] Saving session data to Firestore:', { deviceId: deviceId.substring(0,10) + '...', ...sessionData, lastSeen: 'now' });
            const sessionRef = db.collection('online_sessions').doc(deviceId);
            await sessionRef.set(sessionData, { merge: true });
        }

        // Default response for a simple heartbeat or if no action is needed
        console.log('[Heartbeat API] No specific action taken. Returning default "ok" status.');
        return NextResponse.json({ status: 'ok' }, { status: 200 });

    } catch (error: any) {
        console.error('[Heartbeat API] FATAL Error:', error.stack); // Log stack trace
        return NextResponse.json({ error: 'Server error during heartbeat.' }, { status: 500 });
    }
}
