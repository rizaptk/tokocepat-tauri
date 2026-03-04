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
        
        // If client is unlicensed, check if there's a license ready for them to activate.
        if (!token && deviceId) {
             const ticketsRef = db.collection('paymentTickets');
             
             // Fetch all tickets for the device and sort in memory.
             // This is more robust than relying on a composite index that might not be available.
             const ticketQuery = ticketsRef.where('deviceId', '==', deviceId);
             const ticketSnapshot = await ticketQuery.get();

             if (!ticketSnapshot.empty) {
                const sortedDocs = ticketSnapshot.docs.sort((a, b) => 
                    b.data().createdAt.toDate().getTime() - a.data().createdAt.toDate().getTime()
                );
                const mostRecentDoc = sortedDocs[0];
                const ticket = mostRecentDoc.data();
                
                // Check if the most recent ticket for this device is resolved and unclaimed
                if (ticket.status === 'resolved' && !ticket.claimedAt) {
                    return NextResponse.json({ status: 'activation_required', ticketId: mostRecentDoc.id }, { status: 200 });
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
                sessionData = { customerId: 'unlicensed', customerEmail: 'unlicensed', licenseKey: 'Invalid Token', plan: 'Invalid Token', lastSeen: admin.firestore.FieldValue.serverTimestamp() };
            }
            
            const sessionRef = db.collection('online_sessions').doc(deviceId);
            await sessionRef.set(sessionData, { merge: true });
        }

        // Default response for a simple heartbeat or if no action is needed
        return NextResponse.json({ status: 'ok' }, { status: 200 });

    } catch (error: any) {
        console.error('[Heartbeat API] FATAL Error:', error.message);
        return NextResponse.json({ error: 'Server error during heartbeat.' }, { status: 500 });
    }
}
