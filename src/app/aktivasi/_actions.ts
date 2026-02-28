
'use server';

import { db } from '@/lib/firebase-admin';
import { SubscriptionPlan } from '@/lib/types';
import * as jose from 'jose';

export async function claimLicenseAction(ticketId: string, deviceId: string): Promise<{ token?: string, error?: string }> {
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET_KEY || 'a_very_insecure_default_secret_key_for_development_only'
    );
    const alg = 'HS256';

    const ticketRef = db.collection('paymentTickets').doc(ticketId);

    try {
        const ticketSnap = await ticketRef.get();
        if (!ticketSnap.exists) {
            return { error: 'Activation ticket not found.' };
        }
        const ticketData = ticketSnap.data()!;

        if (ticketData.status !== 'resolved') {
            return { error: 'This ticket has not been approved yet.' };
        }
        if (ticketData.claimedAt) {
            return { error: 'This license has already been activated.' };
        }
        if (ticketData.deviceId !== deviceId) {
            return { error: 'This activation ticket is for a different device.' };
        }
        
        const licenseKey = ticketData.licenseKey;
        if (!licenseKey) {
            return { error: 'Internal error: License key not found on ticket.' };
        }
        
        // Find the actual license details from the key
        const licenseSnapshots = await db.collection('licenses').where('key', '==', licenseKey).limit(1).get();
        if (licenseSnapshots.empty) {
            return { error: 'Internal error: The purchased license could not be found.' };
        }
        
        const licenseDoc = licenseSnapshots.docs[0];
        const licenseData = licenseDoc.data();
        
        // --- Get Plan Details ---
        const plansSnap = await db.collection('app_settings').doc('subscriptionPlans').get();
        if (!plansSnap.exists) throw new Error("Subscription plans are not configured.");
        const allPlans = (plansSnap.data()?.plans || []) as SubscriptionPlan[];
        const purchasedPlan = allPlans.find(p => p.name === licenseData.plan);
        if (!purchasedPlan) throw new Error(`Plan "${licenseData.plan}" not found in settings.`);


        // --- THIS IS THE FINAL ACTIVATION STEP ---
        
        // 1. Calculate the expiration date from *now*
        let expiresAt: Date | null = new Date();
        if (purchasedPlan.durationDays > 0) {
             expiresAt.setDate(expiresAt.getDate() + purchasedPlan.durationDays);
        } else if (purchasedPlan.durationDays === -1) {
            expiresAt = null; // Lifetime plan
        }
        
        // 2. Add this device to the activations array and set it to active
        const updatedActivations = [
            ...(licenseData.activations || []),
            {
                deviceId: deviceId,
                isActive: true,
                activatedAt: new Date(),
            }
        ];
        
        // 3. Update the license document with the new expiration and activation
        await licenseDoc.ref.update({
            expiresAt: expiresAt,
            activations: updatedActivations
        });


        // 4. Create the new JWT
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

        if (expiresAt) {
            jwtBuilder.setExpirationTime(Math.floor(expiresAt.getTime() / 1000));
        }

        const newToken = await jwtBuilder.sign(secret);

        // 5. Mark the ticket as claimed
        await ticketRef.update({ claimedAt: new Date() });
        
        // 6. Return the token to the client for it to save.
        return { token: newToken };

    } catch (error: any) {
        console.error("Failed to claim license:", error);
        return { error: 'An unexpected server error occurred during activation.' };
    }
}
