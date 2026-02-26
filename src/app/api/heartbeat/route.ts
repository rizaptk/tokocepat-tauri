
'use server';

import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import * as jose from 'jose';
import * as admin from 'firebase-admin';

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({}));
        const { token, deviceId } = body;

        // If there's no deviceId, we can't do anything useful.
        if (!deviceId) {
            return NextResponse.json({ status: 'ok_ping_no_device' }, { status: 200 });
        }

        let sessionData: any;
        let licenseIsStillValid = false;

        if (!token) {
            // Case 1: No token provided (unlicensed client pinging)
            sessionData = {
                customerId: 'unlicensed',
                customerEmail: 'unlicensed',
                licenseKey: 'N/A',
                plan: 'Unlicensed',
                lastSeen: admin.firestore.FieldValue.serverTimestamp(),
            };
        } else {
            // Case 2: A token was provided, attempt to verify it
            try {
                const secret = new TextEncoder().encode(process.env.JWT_SECRET_KEY);
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
                
                // Token is valid, build the complete session data object
                sessionData = {
                    customerId,
                    customerEmail,
                    licenseKey,
                    plan,
                    lastSeen: admin.firestore.FieldValue.serverTimestamp(),
                };
                licenseIsStillValid = true;

            } catch (e: any) {
                // Case 3: Token verification failed
                licenseIsStillValid = false;
                console.warn(`Heartbeat with invalid token for device ${deviceId}: ${e.message}`);
                
                // Decode for logging purposes only to see what key failed
                let attemptedKey = 'N/A';
                try {
                    const decoded = jose.decodeJwt(token);
                    if (decoded && typeof decoded.sub === 'string') {
                        attemptedKey = decoded.sub;
                    }
                } catch { /* ignore if even decoding fails */ }

                sessionData = {
                    customerId: 'unlicensed',
                    customerEmail: 'unlicensed',
                    licenseKey: attemptedKey, // Log the key that failed
                    plan: 'Invalid Token',
                    lastSeen: admin.firestore.FieldValue.serverTimestamp(),
                };
            }
        }
        
        // Save the constructed session data. Using .set() without merge ensures the document is always consistent.
        const sessionRef = db.collection('online_sessions').doc(deviceId);
        await sessionRef.set(sessionData);

        // Check for resolved payment tickets for this device if it's unlicensed or has an invalid token
        if (!token || !licenseIsStillValid) {
            const ticketsRef = db.collection('paymentTickets');
            const ticketQuery = ticketsRef
                .where('deviceId', '==', deviceId)
                .where('status', '==', 'resolved')
                .where('claimedAt', '==', null) // Check if not already claimed
                .limit(1);
            
            const ticketSnapshot = await ticketQuery.get();
            if (!ticketSnapshot.empty) {
                const ticketDoc = ticketSnapshot.docs[0];
                const ticketData = ticketDoc.data();
                const resolvedLicenseKey = ticketData.licenseKey;

                // Find the actual license details
                const licenseSnap = await db.collection('licenses').where('key', '==', resolvedLicenseKey).limit(1).get();
                if (!licenseSnap.empty) {
                    const licenseDoc = licenseSnap.docs[0];
                    const licenseData = licenseDoc.data();
                    
                    // --- Create a NEW SIGNED JWT for the client ---
                    const secret = new TextEncoder().encode(process.env.JWT_SECRET_KEY);
                    const alg = 'HS256';

                    const jwtPayload: any = {
                        sub: licenseData.key,
                        deviceId: deviceId,
                        plan: licenseData.plan,
                        isTrial: false, // Assuming tickets are for non-trial plans
                    };
                    
                    const jwtBuilder = new jose.SignJWT(jwtPayload)
                        .setProtectedHeader({ alg })
                        .setIssuedAt()
                        .setSubject(licenseData.key);

                    if (licenseData.expiresAt) {
                        jwtBuilder.setExpirationTime(Math.floor(licenseData.expiresAt.toDate().getTime() / 1000));
                    }

                    const newToken = await jwtBuilder.sign(secret);
                    
                    // Mark the ticket as claimed
                    await ticketDoc.ref.update({ claimedAt: admin.firestore.FieldValue.serverTimestamp() });

                    // Return the new token to the client
                    return NextResponse.json({ token: newToken, status: 'ok_activated' }, { status: 200 });
                }
            }
        }

        // Default response if no new token is issued
        return NextResponse.json({ status: 'ok' }, { status: 200 });

    } catch (error: any) {
        console.error('Heartbeat Error:', error.message);
        return NextResponse.json({ error: 'Server error during heartbeat.' }, { status: 500 });
    }
}
