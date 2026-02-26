import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import * as jose from 'jose';
import * as admin from 'firebase-admin';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { token } = body;

        if (!token) {
            return NextResponse.json({ error: 'Token is required.' }, { status: 400 });
        }
        
        const secret = new TextEncoder().encode(process.env.JWT_SECRET_KEY);

        let payload;
        try {
             const { payload: verifiedPayload } = await jose.jwtVerify(token, secret);
             payload = verifiedPayload;
        } catch (e: any) {
             return NextResponse.json({ error: `Invalid license token: ${e.message}` }, { status: 401 });
        }

        if (!payload || !payload.sub || !payload.deviceId) {
            return NextResponse.json({ error: 'Invalid token payload.' }, { status: 400 });
        }

        const licenseKey = payload.sub as string;
        const deviceId = payload.deviceId as string;
        const plan = payload.plan as string;

        // Find license to get customerId
        const licensesRef = db.collection('licenses');
        const query = licensesRef.where('key', '==', licenseKey).limit(1);
        const snapshot = await query.get();

        if (snapshot.empty) {
            // Don't treat this as a hard error, the license might have been created just now
            // and Firestore replication isn't instant. The client is valid, so we can just
            // log the session without full customer details for now.
             const sessionRef = db.collection('online_sessions').doc(deviceId);
             await sessionRef.set({
                customerId: 'unknown',
                customerEmail: 'unknown',
                licenseKey,
                plan,
                lastSeen: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
            return NextResponse.json({ status: 'ok_no_license_yet' }, { status: 200 });
        }

        const licenseDoc = snapshot.docs[0];
        const licenseData = licenseDoc.data();
        const customerId = licenseData.customerId;

        let customerEmail = 'N/A';
        if (customerId) {
            const customerSnap = await db.collection('customers').doc(customerId).get();
            if (customerSnap.exists) {
                customerEmail = customerSnap.data()?.email || 'N/A';
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
        return NextResponse.json({ error: 'Server error during heartbeat.' }, { status: 500 });
    }
}
