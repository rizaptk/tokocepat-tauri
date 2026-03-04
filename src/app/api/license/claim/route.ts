'use server';

import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { SubscriptionPlan } from '@/lib/types';
import * as jose from 'jose';

export async function POST(request: Request) {
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET_KEY || 'a_very_insecure_default_secret_key_for_development_only'
    );
    const alg = 'HS256';

    try {
        const body = await request.json();
        const { ticketId, deviceId } = body;

        if (!ticketId || !deviceId) {
            return NextResponse.json({ error: 'Ticket ID and Device ID are required.' }, { status: 400 });
        }

        const ticketRef = db.collection('paymentTickets').doc(ticketId);
        const ticketSnap = await ticketRef.get();
        if (!ticketSnap.exists) {
            return NextResponse.json({ error: 'Activation ticket not found.' }, { status: 404 });
        }
        const ticketData = ticketSnap.data()!;

        if (ticketData.status !== 'resolved') {
            return NextResponse.json({ error: 'This ticket has not been approved yet.' }, { status: 403 });
        }
        if (ticketData.claimedAt) {
            return NextResponse.json({ error: 'This license has already been activated.' }, { status: 403 });
        }
        if (ticketData.deviceId !== deviceId) {
            return NextResponse.json({ error: 'This activation ticket is for a different device.' }, { status: 403 });
        }
        
        const licenseId = ticketData.licenseId;
        const licenseKey = ticketData.licenseKey;
        let licenseDoc;

        if (licenseId) {
            const docRef = db.collection('licenses').doc(licenseId);
            const docSnap = await docRef.get();
            if (docSnap.exists) licenseDoc = docSnap;
        }

        if (!licenseDoc && licenseKey) {
            const query = db.collection('licenses').where('key', '==', licenseKey).limit(1);
            const snapshot = await query.get();
            if (!snapshot.empty) licenseDoc = snapshot.docs[0];
        }
        
        if (!licenseDoc) {
            return NextResponse.json({ error: 'Internal error: The purchased license could not be found. Please contact support.' }, { status: 500 });
        }
        
        const licenseData = licenseDoc.data()!;
        
        let durationDays: number;
        let isTrial: boolean;

        if (typeof licenseData.durationDays === 'number') {
            durationDays = licenseData.durationDays;
            isTrial = licenseData.isTrial || false;
        } else {
            const plansSnap = await db.collection('app_settings').doc('subscriptionPlans').get();
            if (!plansSnap.exists) throw new Error("Subscription plans are not configured.");
            const allPlans = (plansSnap.data()?.plans || []) as SubscriptionPlan[];
            const purchasedPlan = allPlans.find(p => p.name === licenseData.plan);
            if (!purchasedPlan) throw new Error(`Plan "${licenseData.plan}" not found in settings.`);
            durationDays = purchasedPlan.durationDays;
            isTrial = purchasedPlan.isTrial || false;
        }
        
        let expiresAt: Date | null = new Date();
        if (durationDays > 0) {
             expiresAt.setDate(expiresAt.getDate() + durationDays);
        } else if (durationDays === -1) {
            expiresAt = null;
        }
        
        const updatedActivations = [...(licenseData.activations || []), { deviceId, isActive: true, activatedAt: new Date() }];
        
        await licenseDoc.ref.update({ expiresAt, activations: updatedActivations });

        const jwtPayload: any = { sub: licenseData.key, deviceId, plan: licenseData.plan, isTrial };
        const jwtBuilder = new jose.SignJWT(jwtPayload).setProtectedHeader({ alg }).setIssuedAt().setSubject(licenseData.key);
        if (expiresAt) jwtBuilder.setExpirationTime(Math.floor(expiresAt.getTime() / 1000));
        const newToken = await jwtBuilder.sign(secret);

        await ticketRef.update({ claimedAt: new Date() });
        
        return NextResponse.json({ token: newToken }, { status: 200 });

    } catch (error: any) {
        console.error("[API/claim] Failed to claim license:", error);
        return NextResponse.json({ error: error.message || 'An unexpected server error occurred during activation.' }, { status: 500 });
    }
}
