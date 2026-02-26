
'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase-admin';
import { SubscriptionPlan, PaymentInstructions } from '@/lib/types';

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

        // Only return non-trial plans to the public
        const publicPlans = plans.filter(p => !p.isTrial);

        return { instructions, plans: publicPlans };
    } catch (error) {
        console.error("Failed to fetch public settings:", error);
        return { instructions: {}, plans: [] };
    }
}
