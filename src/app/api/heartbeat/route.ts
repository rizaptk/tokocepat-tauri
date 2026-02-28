
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
        
        console.log('[Heartbeat API] Received request:', { deviceId: deviceId ? `${deviceId.substring(0,10)}...` : 'N/A', hasToken: !!token });

        if (!deviceId) {
            console.log('[Heartbeat API] Exiting: No deviceId provided.');
            return NextResponse.json({ status: 'ok_ping_no_device' }, { status: 200 });
        }
        
        // --- NEW/RESTORED LOGIC ---
        // If the client has no token, check if there's a resolved ticket waiting for it.
        if (!token && deviceId) {
             const ticketsRef = db.collection('paymentTickets');
             // Query for all resolved tickets that haven't been claimed yet.
             // This is more reliable than querying for deviceId if an index is missing.
             const ticketQuery = ticketsRef.where('status', '==', 'resolved').where('claimedAt', '==', null);
             const ticketSnapshot = await ticketQuery.get();

             if (!ticketSnapshot.empty) {
                 // Filter in memory to find the one for this specific device.
                 const userTicketDoc = ticketSnapshot.docs.find(doc => doc.data().deviceId === deviceId);

                 if (userTicketDoc) {
                    console.log(`[Heartbeat API] Found resolved ticket ${userTicketDoc.id} for device ${deviceId.substring(0,10)}...`);
                    const ticketData = userTicketDoc.data();
                    const licenseKey = ticketData.licenseKey;

                    if (licenseKey) {
                        const licenseSnap = await db.collection('licenses').where('key', '==', licenseKey).limit(1).get();
                        if (!licenseSnap.empty) {
                            const licenseDoc = licenseSnap.docs[0];
                            const licenseData = licenseDoc.data();
                            
                            // Create and sign the new JWT
                            const jwtPayload: any = {
                                sub: licenseData.key,
                                deviceId: deviceId,
                                plan: licenseData.plan,
                                isTrial: false, 
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
                            await userTicketDoc.ref.update({ claimedAt: new Date() });
                            
                            console.log(`[Heartbeat API] Returning new token to client for license key ${licenseKey}.`);
                            // Return the token to the client to activate the app
                            return NextResponse.json({ status: 'activated', token: newToken }, { status: 200 });
                        }
                    }
                 }
             }
        }
        // --- END NEW/RESTORED LOGIC ---


        // Default session logging logic
        let sessionData: any;

        if (!token) {
            // Case 1: No token provided (unlicensed client pinging)
            console.log(`[Heartbeat API] Case 1: Unlicensed client ping from device ${deviceId.substring(0,10)}...`);
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
                const { payload } = await jose.jwtVerify(token, secret);
                
                const licenseKey = payload.sub as string;
                const plan = (payload.plan as string) || 'N/A';
                console.log(`[Heartbeat API] Case 2a: Token VERIFIED for device ${deviceId.substring(0,10)}... with license key ${licenseKey}`);

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
                } else {
                    console.warn(`[Heartbeat API] Warning: Valid token, but license key ${licenseKey} not found in DB.`);
                }
                
                // Token is valid, build the complete session data object
                sessionData = {
                    customerId,
                    customerEmail,
                    licenseKey,
                    plan,
                    lastSeen: admin.firestore.FieldValue.serverTimestamp(),
                };

            } catch (e: any) {
                // Case 3: Token verification failed
                console.warn(`[Heartbeat API] Case 2b: Token VERIFICATION FAILED for device ${deviceId.substring(0,10)}... Reason: ${e.code || e.message}.`);
                
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
        
        console.log('[Heartbeat API] Saving session data to Firestore:', { deviceId: deviceId.substring(0,10) + '...', ...sessionData, lastSeen: 'now' });
        // Save the constructed session data.
        const sessionRef = db.collection('online_sessions').doc(deviceId);
        await sessionRef.set(sessionData);

        // Default response for a simple heartbeat
        return NextResponse.json({ status: 'ok' }, { status: 200 });

    } catch (error: any) {
        console.error('[Heartbeat API] FATAL Error:', error.message);
        return NextResponse.json({ error: 'Server error during heartbeat.' }, { status: 500 });
    }
}
