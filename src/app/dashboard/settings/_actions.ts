'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase-admin';
import { PaymentPlan } from '@/lib/types';
import { revalidatePath } from 'next/cache';

const SubmitTicketSchema = z.object({
  customerEmail: z.string().email({ message: 'Please enter a valid email.' }),
  plan: z.enum(['PRO_MONTHLY', 'PRO_YEARLY', 'LIFETIME'], { required_error: 'Please select a plan.' }),
  proofOfPaymentUrl: z.string().url({ message: 'Please enter a valid URL.' }),
  userNotes: z.string().optional(),
});

export type FormState = {
  message: string;
  errors?: {
    customerEmail?: string[];
    plan?: string[];
    proofOfPaymentUrl?: string[];
    userNotes?: string[];
    _form?: string[];
  };
};

export async function submitPaymentTicketAction(prevState: FormState, formData: FormData): Promise<FormState> {
  const validatedFields = SubmitTicketSchema.safeParse({
    customerEmail: formData.get('customerEmail'),
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

  const { customerEmail, plan, proofOfPaymentUrl, userNotes } = validatedFields.data;
  const now = new Date();

  try {
    const customersRef = db.collection('customers');
    let customerQuery = await customersRef.where('email', '==', customerEmail).limit(1).get();
    let customerId: string;

    if (customerQuery.empty) {
        // To keep things simple, we create a customer record right away.
        const newCustomerRef = await customersRef.add({ email: customerEmail, createdAt: now, licenseCount: 0 });
        customerId = newCustomerRef.id;
    } else {
        customerId = customerQuery.docs[0].id;
    }
    
    await db.collection('paymentTickets').add({
        customerId,
        customerEmail,
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
