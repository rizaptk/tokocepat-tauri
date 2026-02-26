import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { SubscriptionPlan } from '@/lib/types';

// A basic Base64URL encoder
function base64url(source: any) {
    let encodedSource = Buffer.from(JSON.stringify(source)).toString('base64');
    encodedSource = encodedSource.replace(/=+$/, '');
    encodedSource = encodedSource.replace(/\+/g, '-');
    encodedSource = encodedSource.replace(/\//g, '_');
    return encodedSource;
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { licenseKey, deviceId } = body;

        if (!licenseKey || !deviceId) {
            return NextResponse.json({ error: 'License key and device ID are required.' }, { status: 400 });
        }

        const licensesRef = db.collection('licenses');
        const query = licensesRef.where('key', '==', licenseKey).limit(1);
        const snapshot = await query.get();

        if (snapshot.empty) {
            return NextResponse.json({ error: 'License key not found.' }, { status: 404 });
        }

        const licenseDoc = snapshot.docs[0];
        const licenseData = licenseDoc.data();
        
        // --- NEW TRIAL CHECK LOGIC ---
        const planName = licenseData.plan;
        const plansRef = db.collection('app_settings').doc('subscriptionPlans');
        const plansSnap = await plansRef.get();
        const allPlans = (plansSnap.exists() ? plansSnap.data()?.plans : []) as SubscriptionPlan[];
        const selectedPlan = allPlans.find(p => p.name === planName);

        if (selectedPlan && selectedPlan.isTrial) {
            const trialActivationsRef = db.collection('trialActivations').doc(deviceId);
            const trialSnap = await trialActivationsRef.get();
            if (trialSnap.exists) {
                return NextResponse.json({ error: 'This device has already used a trial license.' }, { status: 403 });
            }
        }
        // --- END NEW TRIAL CHECK LOGIC ---

        const activations = licenseData.activations || [];
        const maxSeats = licenseData.maxSeats || 1;
        
        const activeActivations = activations.filter((act: any) => act.isActive);

        const existingActivation = activations.find((act: any) => act.deviceId === deviceId);

        if (existingActivation && existingActivation.isActive) {
            // Device already active, just issue a new token.
        } else if (!existingActivation && activeActivations.length >= maxSeats) {
             return NextResponse.json({ error: 'Maximum number of devices reached for this license.' }, { status: 403 });
        }

        // Update or add the activation record
        const newActivations = activations.filter((act: any) => act.deviceId !== deviceId);
        newActivations.push({
            deviceId: deviceId,
            isActive: true,
            activatedAt: new Date(),
            deactivatedAt: null, // Ensure deactivatedAt is null on new activation
        });

        await licenseDoc.ref.update({ activations: newActivations });

        // --- NEW: Record trial activation if it's a trial plan ---
        if (selectedPlan && selectedPlan.isTrial) {
            await db.collection('trialActivations').doc(deviceId).set({
                activatedAt: new Date(),
                licenseKey: licenseKey,
            });
        }
        // --- END NEW ---

        // Create JWT payload
        const now = Math.floor(Date.now() / 1000);
        let exp = licenseData.expiresAt ? Math.floor(licenseData.expiresAt.toDate().getTime() / 1000) : null;
        
        const payload: any = {
            sub: licenseKey,
            deviceId: deviceId,
            plan: licenseData.plan,
            iat: now,
            isTrial: selectedPlan?.isTrial || false, // Add isTrial flag to payload
        };
        if (exp) {
            payload.exp = exp;
        }

        const header = { alg: 'none', typ: 'JWT' };
        const pseudoToken = `${base64url(header)}.${base64url(payload)}.`;

        return NextResponse.json({ token: pseudoToken }, { status: 200 });

    } catch (error: any) {
        console.error('Activation Error:', error.message);
        return NextResponse.json({ error: 'Server error during activation.' }, { status: 500 });
    }
}
