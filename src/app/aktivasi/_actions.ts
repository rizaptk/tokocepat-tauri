
'use server';

import { db } from '@/lib/firebase-admin';
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
        const licenseSnap = await db.collection('licenses').where('key', '==', licenseKey).limit(1).get();
        if (licenseSnap.empty) {
            return { error: 'Internal error: The purchased license could not be found.' };
        }
        
        const licenseDoc = licenseSnap.docs[0];
        const licenseData = licenseDoc.data();

        // Create the new JWT
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
        await ticketRef.update({ claimedAt: new Date() });
        
        // Return the token to the client for it to save.
        return { token: newToken };

    } catch (error: any) {
        console.error("Failed to claim license:", error);
        return { error: 'An unexpected server error occurred during activation.' };
    }
}
