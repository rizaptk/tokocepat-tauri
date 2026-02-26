
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import * as jose from 'jose';
import * as admin from 'firebase-admin';

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({})); // Handle cases with no body
        const { token } = body;

        // If no token is provided, this is a simple "ping" to check if the server is up.
        if (!token) {
            return NextResponse.json({ status: 'ok_ping' }, { status: 200 });
        }
        
        // If a token is provided, proceed with the heartbeat logic to update online status.
        const secret = new TextEncoder().encode(process.env.JWT_SECRET_KEY);

        let payload;
        try {
             const { payload: verifiedPayload } = await jose.jwtVerify(token, secret);
             payload = verifiedPayload;
        } catch (e: any) {
             // Don't return an error for an invalid token during a heartbeat, just log it.
             // The main license check will handle enforcement.
             console.warn(`Heartbeat with invalid token received: ${e.message}`);
             return NextResponse.json({ status: 'ok_invalid_token' }, { status: 200 });
        }

        if (!payload || !payload.sub || !payload.deviceId) {
            console.warn('Heartbeat with invalid payload received.');
            return NextResponse.json({ status: 'ok_invalid_payload' }, { status: 200 });
        }

        const licenseKey = payload.sub as string;
        const deviceId = payload.deviceId as string;
        const plan = (payload.plan as string) || 'N/A';

        // Find license to get customerId
        const licensesRef = db.collection('licenses');
        const query = licensesRef.where('key', '==', licenseKey).limit(1);
        const snapshot = await query.get();

        let customerId = 'unknown';
        let customerEmail = 'unknown';

        if (!snapshot.empty) {
            const licenseDoc = snapshot.docs[0];
            const licenseData = licenseDoc.data();
            customerId = licenseData.customerId || 'unknown';
            
            if (customerId !== 'unknown' && customerId.length > 0) { // Check if customerId is a valid non-empty string
                const customerSnap = await db.collection('customers').doc(customerId).get();
                if (customerSnap.exists) {
                    customerEmail = customerSnap.data()?.email || 'unknown';
                }
            }
        }

        // Update online status in Firestore
        const sessionRef = db.collection('online_sessions').doc(deviceId);
        await sessionRef.set({
            customerId,
            customerEmail,
            licenseKey,
            plan,
            lastSeen: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        
        return NextResponse.json({ status: 'ok' }, { status: 200 });

    } catch (error: any) {
        console.error('Heartbeat Error:', error.message);
        // Return a server error, but a 500 status will be caught by the client's .catch() block
        return NextResponse.json({ error: 'Server error during heartbeat.' }, { status: 500 });
    }
}
