
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
             
             // Query for a ticket matching the device that is resolved but not yet claimed.
             // THIS QUERY REQUIRES A COMPOSITE INDEX in Firestore:
             // collection: paymentTickets, fields: deviceId (asc), status (asc), createdAt (desc)
             const ticketQuery = ticketsRef
                .where('deviceId', '==', deviceId)
                .where('status', '==', 'resolved')
                .orderBy('createdAt', 'desc')
                .limit(1);

             const ticketSnapshot = await ticketQuery.get();

             // Find the first document that does NOT have a `claimedAt` timestamp.
             const userTicketDoc = ticketSnapshot.docs.find(doc => !doc.data().claimedAt);

             if (userTicketDoc) {
                return NextResponse.json({ status: 'activation_required', ticketId: userTicketDoc.id }, { status: 200 });
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
