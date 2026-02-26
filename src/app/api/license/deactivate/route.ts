import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';

// A basic, library-free JWT payload decoder.
function decodeJwtPayload(token: string): any | null {
    try {
        const base64Url = token.split('.')[1];
        if (!base64Url) return null;
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error("Failed to decode JWT payload:", e);
        return null;
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { token } = body;

        if (!token) {
            return NextResponse.json({ error: 'License token is required.' }, { status: 400 });
        }

        const payload = decodeJwtPayload(token);
        if (!payload || !payload.sub || !payload.deviceId) {
            return NextResponse.json({ error: 'Invalid license token.' }, { status: 400 });
        }

        const { sub: licenseKey, deviceId } = payload;
        
        const licensesRef = db.collection('licenses');
        const query = licensesRef.where('key', '==', licenseKey).limit(1);
        const snapshot = await query.get();

        if (snapshot.empty) {
            // This case is unlikely if the token was valid, but good to have.
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
