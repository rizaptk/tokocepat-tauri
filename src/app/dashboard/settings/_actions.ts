
'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase-admin';
import { revalidatePath } from 'next/cache';
import { SubscriptionPlan, PaymentInstructions } from '@/lib/types';
import { randomBytes } from 'crypto';
import * as jose from 'jose';


// --- Helper function to find or create customer ---
async function findOrCreateCustomer(email: string, name?: string): Promise<string> {
    const customersRef = db.collection('customers');
    const customerQuery = await customersRef.where('email', '==', email).limit(1).get();

    if (customerQuery.empty) {
        const newCustomerRef = await customersRef.add({ email, name: name || '', createdAt: new Date(), licenseCount: 0 });
        return newCustomerRef.id;
    } else {
        const customerDoc = customerQuery.docs[0];
        // If the customer exists but their name was empty or different, update it.
        const currentName = customerDoc.data().name || '';
        if (name && currentName !== name) {
            await customerDoc.ref.update({ name });
        }
        return customerDoc.id;
    }
}

const SubmitTicketSchema = z.object({
  customerName: z.string().min(2, 'Please enter your full name.'),
  customerEmail: z.string().email({ message: 'Please enter a valid email.' }),
  customerWhatsapp: z.string().min(10, 'Please enter a valid WhatsApp number.'),
  plan: z.string().min(1, 'Please select a plan.'),
  proofOfPaymentUrl: z.string().url({ message: 'Please enter a valid URL.' }),
  userNotes: z.string().optional(),
  deviceId: z.string().min(1, 'Device ID is required.'),
});

export type FormState = {
  message: string;
  errors?: {
    customerName?: string[];
    customerEmail?: string[];
    customerWhatsapp?: string[];
    plan?: string[];
    proofOfPaymentUrl?: string[];
    userNotes?: string[];
    deviceId?: string[];
    _form?: string[];
  };
};

export async function submitPaymentTicketAction(prevState: FormState, formData: FormData): Promise<FormState> {
  const validatedFields = SubmitTicketSchema.safeParse({
    customerName: formData.get('customerName'),
    customerEmail: formData.get('customerEmail'),
    customerWhatsapp: formData.get('customerWhatsapp'),
    plan: formData.get('plan'),
    proofOfPaymentUrl: formData.get('proofOfPaymentUrl'),
    userNotes: formData.get('userNotes'),
    deviceId: formData.get('deviceId'),
  });

  if (!validatedFields.success) {
    return {
      message: 'Validation failed',
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  const { customerName, customerEmail, customerWhatsapp, plan, proofOfPaymentUrl, userNotes, deviceId } = validatedFields.data;
  
  try {
    const customerId = await findOrCreateCustomer(customerEmail, customerName);
    const now = new Date();
    
    await db.collection('paymentTickets').add({
        customerId,
        customerName,
        customerEmail,
        customerWhatsapp,
        plan,
        proofOfPaymentUrl,
        userNotes: userNotes || '',
        status: 'pending',
        createdAt: now,
        updatedAt: now,
        deviceId, // Save the device ID with the ticket
        claimedAt: null, // Initialize claimedAt to null
    });
    
    return { message: 'success' };
  } catch (error: any) {
    console.error("Ticket submission failed:", error);
    return {
      message: 'Server error',
      errors: { _form: ['An unexpected error occurred while submitting your ticket.'] },
    };
  }
}

export async function getPublicSettings(): Promise<{ instructions: PaymentInstructions; plans: SubscriptionPlan[] }> {
    try {
        const instructionsRef = db.collection('app_settings').doc('paymentInstructions');
        const plansRef = db.collection('app_settings').doc('subscriptionPlans');

        const [instructionsSnap, plansSnap] = await Promise.all([
            instructionsRef.get(),
            plansRef.get(),
        ]);

        const instructions = instructionsSnap.exists ? (instructionsSnap.data() as PaymentInstructions) : {};
        const plans = plansSnap.exists ? (plansSnap.data()?.plans as SubscriptionPlan[]) : [];

        return { instructions, plans };
    } catch (error) {
        console.error("Failed to fetch public settings:", error);
        return { instructions: {}, plans: [] };
    }
}


export async function activateTrialAction(planId: string, deviceId: string): Promise<{ token?: string, error?: string }> {
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET_KEY || 'a_very_insecure_default_secret_key_for_development_only'
    );
    const alg = 'HS256';

    try {
        const plansSnap = await db.collection('app_settings').doc('subscriptionPlans').get();
        if (!plansSnap.exists) {
            return { error: 'Subscription plans are not configured.' };
        }
        const allPlans = (plansSnap.data()?.plans || []) as SubscriptionPlan[];
        const trialPlan = allPlans.find(p => p.id === planId);

        if (!trialPlan || !trialPlan.isTrial) {
            return { error: 'Invalid trial plan selected.' };
        }

        const trialActivationRef = db.collection('trialActivations').doc(deviceId);
        const trialSnap = await trialActivationRef.get();
        if (trialSnap.exists) {
            return { error: 'This device has already used a trial license.' };
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
        
        // --- Create SIGNED JWT ---
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

        return { token: jwt };

    } catch (error: any) {
        console.error("Trial activation failed:", error);
        return { error: 'An unexpected server error occurred.' };
    }
}
