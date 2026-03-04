'use server';

import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { SubscriptionPlan } from '@/lib/types';
import { randomBytes } from 'crypto';
import * as jose from 'jose';


export async function POST(request: Request) {
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET_KEY || 'a_very_insecure_default_secret_key_for_development_only'
    );
    const alg = 'HS256';

    try {
        const body = await request.json();
        const { planId, deviceId } = body;

        if (!planId || !deviceId) {
            return NextResponse.json({ error: 'Plan ID and Device ID are required.' }, { status: 400 });
        }

        const plansSnap = await db.collection('app_settings').doc('subscriptionPlans').get();
        if (!plansSnap.exists) {
            return NextResponse.json({ error: 'Subscription plans are not configured.' }, { status: 500 });
        }
        const allPlans = (plansSnap.data()?.plans || []) as SubscriptionPlan[];
        const trialPlan = allPlans.find(p => p.id === planId);

        if (!trialPlan || !trialPlan.isTrial) {
            return NextResponse.json({ error: 'Invalid trial plan selected.' }, { status: 400 });
        }

        const trialActivationRef = db.collection('trialActivations').doc(deviceId);
        const trialSnap = await trialActivationRef.get();
        if (trialSnap.exists) {
            return NextResponse.json({ error: 'This device has already used a trial license.' }, { status: 403 });
        }

        const licenseKey = `TRIAL-${randomBytes(4).toString('hex').toUpperCase()}-${randomBytes(4).toString('hex').toUpperCase()}`;
        
        let expiresAt: Date | null = new Date();
        if (trialPlan.durationDays > 0) {
            expiresAt.setDate(expiresAt.getDate() + trialPlan.durationDays);
        } else {
            expiresAt.setDate(expiresAt.getDate() + 7); // Default 7 days
        }

        const newLicense = {
            key: licenseKey,
            plan: trialPlan.name,
            status: 'active',
            customerId: `TRIAL-${deviceId}`,
            createdAt: new Date(),
            expiresAt: expiresAt,
            maxSeats: trialPlan.maxSeats || 1,
            activations: [{
                deviceId: deviceId,
                isActive: true,
                activatedAt: new Date(),
                deactivatedAt: null,
            }],
        };
        await db.collection('licenses').add(newLicense);

        await trialActivationRef.set({
            activatedAt: new Date(),
            licenseKey: licenseKey,
        });
        
        const jwt = await new jose.SignJWT({
                deviceId: deviceId,
                plan: trialPlan.name,
                isTrial: true,
            })
            .setProtectedHeader({ alg })
            .setIssuedAt()
            .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
            .setSubject(licenseKey)
            .sign(secret);

        return NextResponse.json({ token: jwt }, { status: 200 });

    } catch (error: any) {
        console.error("[API/activate-trial] Trial activation failed:", error);
        return NextResponse.json({ error: 'An unexpected server error occurred.' }, { status: 500 });
    }
}
