
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import * as jose from 'jose';

export async function POST(request: Request) {
    const secretString = process.env.JWT_SECRET_KEY;
    if (!secretString) {
        console.error("FATAL: JWT_SECRET_KEY environment variable is not set. Using a default, insecure key for development purposes. DO NOT use this in production.");
    }
    const secret = new TextEncoder().encode(secretString || 'a_very_insecure_default_secret_key_for_development_only');

    try {
        const body = await request.json();
        const { token } = body;

        if (!token) {
            return NextResponse.json({ error: 'License token is required.' }, { status: 400 });
        }
        
        // Verify the JWT signature and get the payload
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
        
        const licensesRef = db.collection('licenses');
        const query = licensesRef.where('key', '==', licenseKey).limit(1);
        const snapshot = await query.get();

        if (snapshot.empty) {
            return NextResponse.json({ error: 'License key not found.' }, { status: 404 });
        }

        const licenseDoc = snapshot.docs[0];
        const licenseData = licenseDoc.data();
        const activations = licenseData.activations || [];

        let found = false;
        const updatedActivations = activations.map((act: any) => {
            if (act.deviceId === deviceId && act.isActive) {
                found = true;
                return { ...act, isActive: false, deactivatedAt: new Date() };
            }
            return act;
        });
        
        if (!found) {
             return NextResponse.json({ error: 'This device is not actively registered with the provided license.' }, { status: 400 });
        }

        await licenseDoc.ref.update({ activations: updatedActivations });

        return NextResponse.json({ message: 'Device deactivated successfully' }, { status: 200 });

    } catch (error: any) {
        console.error('Deactivation Error:', error.message);
        return NextResponse.json({ error: 'Server error during deactivation.' }, { status: 500 });
    }
}
