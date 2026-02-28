
'use server';

import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import * as jose from 'jose';
import * as admin from 'firebase-admin';

export async function POST(request: Request) {
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET_KEY || 'a_very_insecure_default_secret_key_for_development_only'
    );

    try {
        const body = await request.json().catch(() => ({}));
        const { token, deviceId } = body;

        // If there's no deviceId, we can't do anything useful.
        if (!deviceId) {
            return NextResponse.json({ status: 'ok_ping_no_device' }, { status: 200 });
        }

        let sessionData: any;

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

            } catch (e: any) {
                // Case 3: Token verification failed
                console.warn(`Heartbeat JWT verification failed for device ${deviceId}. Reason: ${e.code || e.message}.`);
                
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
        
        // Save the constructed session data.
        const sessionRef = db.collection('online_sessions').doc(deviceId);
        await sessionRef.set(sessionData);

        // Default response for a simple heartbeat
        return NextResponse.json({ status: 'ok' }, { status: 200 });

    } catch (error: any) {
        console.error('Heartbeat Error:', error.message);
        return NextResponse.json({ error: 'Server error during heartbeat.' }, { status: 500 });
    }
}
