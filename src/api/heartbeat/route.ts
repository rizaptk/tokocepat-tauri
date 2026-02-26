
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import * as jose from 'jose';
import * as admin from 'firebase-admin';

async function generateSignedJwt(licenseData: any, licenseKey: string, deviceId: string) {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET_KEY);
    const alg = 'HS256';

    const jwtPayload: any = {
        sub: licenseKey,
        deviceId: deviceId,
        plan: licenseData.plan,
    };
    
    const jwtBuilder = new jose.SignJWT(jwtPayload)
        .setProtectedHeader({ alg })
        .setIssuedAt()
        .setSubject(licenseKey);

    if (licenseData.expiresAt) {
        jwtBuilder.setExpirationTime(Math.floor(licenseData.expiresAt.toDate().getTime() / 1000));
    }

    return await jwtBuilder.sign(secret);
}


export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({}));
        const { token, deviceId } = body;

        // --- NEW: Asynchronous License Claiming Flow ---
        if (!token && deviceId) {
            const ticketsRef = db.collection('paymentTickets');
            const ticketQuery = await ticketsRef
                .where('deviceId', '==', deviceId)
                .where('status', '==', 'resolved')
                .where('claimedAt', '==', null) // Check that it hasn't been claimed
                .orderBy('createdAt', 'desc')
                .limit(1)
                .get();
            
            if (!ticketQuery.empty) {
                const ticketDoc = ticketQuery.docs[0];
                const ticketData = ticketDoc.data();
                const licenseKey = ticketData.licenseKey;

                if (licenseKey) {
                    const licensesRef = db.collection('licenses');
                    const licenseQuery = await licensesRef.where('key', '==', licenseKey).limit(1).get();

                    if (!licenseQuery.empty) {
                        const licenseDoc = licenseQuery.docs[0];
                        
                        // Generate a signed JWT for the client
                        const newToken = await generateSignedJwt(licenseDoc.data(), licenseKey, deviceId);
                        
                        // Mark the ticket as claimed to prevent re-issuing
                        await ticketDoc.ref.update({ claimedAt: admin.firestore.FieldValue.serverTimestamp() });

                        return NextResponse.json({ token: newToken }, { status: 200 });
                    }
                }
            }
        }
        // --- End of New Flow ---

        // If a token is provided, proceed with the original heartbeat logic to update online status.
        if (token) {
            const secret = new TextEncoder().encode(process.env.JWT_SECRET_KEY);
            let payload;

            try {
                 const { payload: verifiedPayload } = await jose.jwtVerify(token, secret);
                 payload = verifiedPayload;
            } catch (e: any) {
                 console.warn(`Heartbeat with invalid token received: ${e.message}`);
                 return NextResponse.json({ status: 'ok_invalid_token' }, { status: 200 });
            }

            if (!payload || !payload.sub || !payload.deviceId) {
                console.warn('Heartbeat with invalid payload received.');
                return NextResponse.json({ status: 'ok_invalid_payload' }, { status: 200 });
            }
            
            const sessionDeviceId = payload.deviceId as string;

            const licensesRef = db.collection('licenses');
            const query = licensesRef.where('key', '==', payload.sub as string).limit(1);
            const snapshot = await query.get();

            let customerEmail = 'unknown';

            if (!snapshot.empty) {
                const licenseData = snapshot.docs[0].data();
                const customerId = licenseData.customerId;
                if (customerId && typeof customerId === 'string' && customerId.length > 0) {
                    const customerSnap = await db.collection('customers').doc(customerId).get();
                    if (customerSnap.exists) {
                        customerEmail = customerSnap.data()?.email || 'unknown';
                    }
                }
            }

            await db.collection('online_sessions').doc(sessionDeviceId).set({
                customerEmail,
                licenseKey: payload.sub as string,
                plan: (payload.plan as string) || 'N/A',
                lastSeen: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
        }
        
        return NextResponse.json({ status: 'ok' }, { status: 200 });

    } catch (error: any) {
        console.error('Heartbeat Error:', error.message);
        return NextResponse.json({ error: 'Server error during heartbeat.' }, { status: 500 });
    }
}
