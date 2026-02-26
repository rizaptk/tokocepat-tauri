
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import * as jose from 'jose';
import * as admin from 'firebase-admin';

// Helper to generate a token. This is duplicated from activate/route.ts, could be refactored later.
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

        // A deviceID is required for any heartbeat operation.
        if (!deviceId) {
            return NextResponse.json({ error: 'Device ID is required.' }, { status: 400 });
        }

        let sessionData: any = {
            lastSeen: admin.firestore.FieldValue.serverTimestamp(),
            // Default values
            customerEmail: 'N/A',
            licenseKey: 'N/A',
            plan: 'Unlicensed',
        };

        // --- Handle Unlicensed Client: Check for a claimable license ---
        if (!token) {
            const ticketsRef = db.collection('paymentTickets');
            const ticketQuery = await ticketsRef
                .where('deviceId', '==', deviceId)
                .where('status', '==', 'resolved')
                .where('claimedAt', '==', null)
                .orderBy('createdAt', 'desc')
                .limit(1)
                .get();

            if (!ticketQuery.empty) {
                const ticketDoc = ticketQuery.docs[0];
                const ticketData = ticketDoc.data();
                const licenseKey = ticketData.licenseKey;

                if (licenseKey) {
                    const licenseQuery = await db.collection('licenses').where('key', '==', licenseKey).limit(1).get();
                    if (!licenseQuery.empty) {
                        const licenseDoc = licenseQuery.docs[0];
                        const newToken = await generateSignedJwt(licenseDoc.data(), licenseKey, deviceId);
                        
                        await ticketDoc.ref.update({ claimedAt: admin.firestore.FieldValue.serverTimestamp() });

                        // Return the new token immediately. The client will reload and send a new, licensed heartbeat.
                        return NextResponse.json({ token: newToken }, { status: 200 });
                    }
                }
            }
            // If no token and no ticket, the default 'Unlicensed' sessionData will be saved.
        } 
        // --- Handle Licensed Client: Verify token and gather info ---
        else {
            try {
                const secret = new TextEncoder().encode(process.env.JWT_SECRET_KEY);
                const { payload } = await jose.jwtVerify(token, secret);
                
                // Security check: ensure the token's deviceId matches the one sending the request
                if (payload.deviceId !== deviceId) {
                    throw new Error("Device ID mismatch in token.");
                }
                
                sessionData.licenseKey = payload.sub as string;
                sessionData.plan = (payload.plan as string) || 'N/A';
                
                // Find customer email
                const licensesRef = db.collection('licenses');
                const licenseQuery = await licensesRef.where('key', '==', sessionData.licenseKey).limit(1).get();
                if (!licenseQuery.empty) {
                    const licenseData = licenseQuery.docs[0].data();
                    const customerId = licenseData.customerId;
                    if (customerId && typeof customerId === 'string' && customerId.length > 0) {
                        const customerSnap = await db.collection('customers').doc(customerId).get();
                        if (customerSnap.exists) {
                            sessionData.customerEmail = customerSnap.data()?.email || 'N/A';
                        }
                    }
                }
            } catch (e: any) {
                // If token is invalid, we still want to log the session, but mark it as having a bad token.
                console.warn(`Heartbeat with invalid token for device ${deviceId}: ${e.message}`);
                sessionData.plan = 'Invalid Token';
            }
        }

        // --- Save the session data to Firestore for ALL clients with a deviceId ---
        await db.collection('online_sessions').doc(deviceId).set(sessionData, { merge: true });
        
        return NextResponse.json({ status: 'ok' }, { status: 200 });

    } catch (error: any) {
        console.error('Heartbeat Error:', error.message);
        return NextResponse.json({ error: 'Server error during heartbeat.' }, { status: 500 });
    }
}
