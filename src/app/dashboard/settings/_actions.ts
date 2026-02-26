'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase-admin';
import { SubscriptionPlan, PaymentInstructions } from '@/lib/types';
import { randomBytes } from 'crypto';

const SubmitTicketSchema = z.object({
  customerName: z.string().min(2, 'Please enter your full name.'),
  customerEmail: z.string().email({ message: 'Please enter a valid email.' }),
  customerWhatsapp: z.string().min(10, 'Please enter a valid WhatsApp number.'),
  plan: z.string().min(1, 'Please select a plan.'),
  proofOfPaymentUrl: z.string().url({ message: 'Please enter a valid URL.' }),
  userNotes: z.string().optional(),
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
  });

  if (!validatedFields.success) {
    return {
      message: 'Validation failed',
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  const { customerName, customerEmail, customerWhatsapp, plan, proofOfPaymentUrl, userNotes } = validatedFields.data;
  const now = new Date();

  try {
    const customersRef = db.collection('customers');
    let customerQuery = await customersRef.where('email', '==', customerEmail).limit(1).get();
    let customerId: string;

    if (customerQuery.empty) {
        const newCustomerRef = await customersRef.add({ email: customerEmail, name: customerName, createdAt: now, licenseCount: 0 });
        customerId = newCustomerRef.id;
    } else {
        customerId = customerQuery.docs[0].id;
        // Optionally update name if it has changed
        await customerQuery.docs[0].ref.update({ name: customerName });
    }
    
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
        
        const now = Math.floor(Date.now() / 1000);
        const exp = Math.floor(expiresAt.getTime() / 1000);
        
        const payload = {
            sub: licenseKey,
            deviceId: deviceId,
            plan: trialPlan.name,
            iat: now,
            exp: exp,
            isTrial: true,
        };

        const base64url = (source: any) => Buffer.from(JSON.stringify(source)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/_/g, '_');
        const pseudoToken = `${base64url({ alg: 'none', typ: 'JWT' })}.${base64url(payload)}.`;

        return { token: pseudoToken };

    } catch (error: any) {
        console.error("Trial activation failed:", error);
        return { error: 'An unexpected server error occurred.' };
    }
}