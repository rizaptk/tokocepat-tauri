
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { SubscriptionPlan } from '@/lib/types';
import * as jose from 'jose';

// Helper to find or create a customer and return their ID
async function findOrCreateCustomer(email: string, name?: string): Promise<string> {
    const customersRef = db.collection('customers');
    const customerQuery = await customersRef.where('email', '==', email).limit(1).get();

    if (customerQuery.empty) {
        const newCustomerRef = await customersRef.add({ email, name: name || '', createdAt: new Date(), licenseCount: 0 });
        return newCustomerRef.id;
    } else {
        // If the customer exists but their name was empty, update it.
        const customerDoc = customerQuery.docs[0];
        if (!customerDoc.data().name && name) {
            await customerDoc.ref.update({ name });
        }
        return customerDoc.id;
    }
}


export async function POST(request: Request) {
    const secretString = process.env.JWT_SECRET_KEY;
    if (!secretString) {
        console.error("FATAL: JWT_SECRET_KEY environment variable is not set. Using a default, insecure key for development purposes. DO NOT use this in production.");
    }
    const secret = new TextEncoder().encode(secretString || 'a_very_insecure_default_secret_key_for_development_only');
    const alg = 'HS256';

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
        
        // --- NEW: Block manual activation of trial keys ---
        const planName = licenseData.plan;
        const plansRef = db.collection('app_settings').doc('subscriptionPlans');
        const plansSnap = await plansRef.get();
        const allPlans = (plansSnap.exists() ? plansSnap.data()?.plans : []) as SubscriptionPlan[];
        const selectedPlan = allPlans.find(p => p.name === planName);

        if (selectedPlan && selectedPlan.isTrial) {
             return NextResponse.json({ error: "Trial licenses must be activated via the 'Start Trial' button, not by key." }, { status: 403 });
        }
        // --- END NEW ---

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

        // --- Create SIGNED JWT ---
        const jwtPayload: any = {
            sub: licenseKey,
            deviceId: deviceId,
            plan: licenseData.plan,
            isTrial: selectedPlan?.isTrial || false,
        };
        
        const jwtBuilder = new jose.SignJWT(jwtPayload)
            .setProtectedHeader({ alg })
            .setIssuedAt()
            .setSubject(licenseKey);

        if (licenseData.expiresAt) {
             jwtBuilder.setExpirationTime(Math.floor(licenseData.expiresAt.toDate().getTime() / 1000));
        }

        const token = await jwtBuilder.sign(secret);
        
        return NextResponse.json({ token }, { status: 200 });

    } catch (error: any) {
        console.error('Activation Error:', error.message);
        return NextResponse.json({ error: 'Server error during activation.' }, { status: 500 });
    }
}
