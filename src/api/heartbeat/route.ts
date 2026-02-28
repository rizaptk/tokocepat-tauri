
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

        if (!token && deviceId) {
             console.log(`[Heartbeat API] Unlicensed client. Checking for resolved tickets for device ${deviceId.substring(0,10)}...`);
             const ticketsRef = db.collection('paymentTickets');
             // Use a broader query to avoid needing a composite index.
             const ticketQuery = ticketsRef.where('status', '==', 'resolved');
             const ticketSnapshot = await ticketQuery.get();

             if (!ticketSnapshot.empty) {
                 console.log(`[Heartbeat API] Found ${ticketSnapshot.size} resolved tickets in total. Filtering in memory...`);
                 
                 // Filter in memory to find the correct, unclaimed ticket for this device.
                 const userTicketDoc = ticketSnapshot.docs.find(doc => {
                     const data = doc.data();
                     const deviceIdMatch = data.deviceId === deviceId;
                     // This is a safer check. It returns true if claimedAt is null OR undefined.
                     const notClaimed = !data.claimedAt; 
                     console.log(`[Heartbeat API] --- Checking ticket ${doc.id}: deviceId match? ${deviceIdMatch}. Not claimed? ${notClaimed}. (claimedAt value is: ${data.claimedAt})`);
                     return deviceIdMatch && notClaimed;
                 });

                 if (userTicketDoc) {
                    console.log(`[Heartbeat API] SUCCESS: Found resolved, unclaimed ticket ${userTicketDoc.id} for device ${deviceId.substring(0,10)}...`);
                    const ticketData = userTicketDoc.data();
                    const licenseKey = ticketData.licenseKey;

                    if (licenseKey) {
                        const licenseSnap = await db.collection('licenses').where('key', '==', licenseKey).limit(1).get();
                        if (!licenseSnap.empty) {
                            const licenseDoc = licenseSnap.docs[0];
                            const licenseData = licenseDoc.data();
                            
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
                            
                            await userTicketDoc.ref.update({ claimedAt: new Date() });
                            
                            console.log(`[Heartbeat API] Returning new token to client for license key ${licenseKey}.`);
                            return NextResponse.json({ status: 'activated', token: newToken }, { status: 200 });
                        } else {
                            console.error(`[Heartbeat API] Error: Ticket ${userTicketDoc.id} has license key ${licenseKey}, but key was not found in licenses collection.`);
                        }
                    } else {
                        console.error(`[Heartbeat API] Error: Ticket ${userTicketDoc.id} is resolved but has no licenseKey.`);
                    }
                 } else {
                     console.log(`[Heartbeat API] No matching unclaimed ticket found for this device.`);
                 }
             } else {
                 console.log(`[Heartbeat API] No resolved tickets found in the database.`);
             }
        }

        // Default session logging logic
        let sessionData: any;
        if (token) {
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
                
                sessionData = {
                    customerId,
                    customerEmail,
                    licenseKey,
                    plan,
                    lastSeen: admin.firestore.FieldValue.serverTimestamp(),
                };
            } catch (e: any) {
                console.warn(`[Heartbeat API] Token VERIFICATION FAILED for device ${deviceId.substring(0,10)}... Reason: ${e.code || e.message}.`);
                sessionData = {
                    customerId: 'unlicensed', customerEmail: 'unlicensed', licenseKey: 'Invalid Token', plan: 'Invalid Token',
                    lastSeen: admin.firestore.FieldValue.serverTimestamp(),
                };
            }
        } else {
            sessionData = {
                customerId: 'unlicensed', customerEmail: 'unlicensed', licenseKey: 'N/A', plan: 'Unlicensed',
                lastSeen: admin.firestore.FieldValue.serverTimestamp(),
            };
        }
        
        // Save session data for online user tracking
        if (deviceId) {
            console.log('[Heartbeat API] Saving session data to Firestore:', { deviceId: deviceId.substring(0,10) + '...', ...sessionData, lastSeen: 'now' });
            const sessionRef = db.collection('online_sessions').doc(deviceId);
            await sessionRef.set(sessionData);
        }

        // Default response for a simple heartbeat
        console.log('[Heartbeat API] Returning default "ok" status.');
        return NextResponse.json({ status: 'ok' }, { status: 200 });

    } catch (error: any) {
        console.error('[Heartbeat API] FATAL Error:', error.message);
        return NextResponse.json({ error: 'Server error during heartbeat.' }, { status: 500 });
    }
}
