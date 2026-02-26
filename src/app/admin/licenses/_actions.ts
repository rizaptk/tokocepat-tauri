'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase-admin';
import { revalidatePath } from 'next/cache';
import { randomBytes } from 'crypto';

const CreateLicenseSchema = z.object({
  customerEmail: z.string().email({ message: 'Please enter a valid email.' }),
  plan: z.enum(['PRO_MONTHLY', 'PRO_YEARLY', 'LIFETIME'], {
      required_error: 'Please select a plan.'
  }),
});

export type CreateFormState = {
  message: string;
  errors?: {
    customerEmail?: string[];
    plan?: string[];
    _form?: string[];
  };
};

export async function createLicenseAction(prevState: CreateFormState, formData: FormData): Promise<CreateFormState> {
  const validatedFields = CreateLicenseSchema.safeParse({
    customerEmail: formData.get('customerEmail'),
    plan: formData.get('plan'),
  });

  if (!validatedFields.success) {
    return {
      message: 'Validation failed',
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  if (!db) {
     return { message: "Server error", errors: { _form: ["Database connection is not available."] } };
  }

  const { customerEmail, plan } = validatedFields.data;

  try {
    // 1. Find or create customer
    const customersRef = db.collection('customers');
    const customerQuery = await customersRef.where('email', '==', customerEmail).limit(1).get();
    
    let customerId: string;
    
    if (customerQuery.empty) {
      // Create new customer
      const newCustomerRef = await customersRef.add({
        email: customerEmail,
        createdAt: new Date(),
        licenseCount: 1, // Start with 1
      });
      customerId = newCustomerRef.id;
    } else {
      // Use existing customer and update their license count
      const customerDoc = customerQuery.docs[0];
      customerId = customerDoc.id;
      const currentCount = customerDoc.data().licenseCount || 0;
      await customerDoc.ref.update({ licenseCount: currentCount + 1 });
    }

    // 2. Generate license
    const licenseKey = `TKN-${randomBytes(4).toString('hex').toUpperCase()}-${randomBytes(4).toString('hex').toUpperCase()}`;
    
    let expiresAt: Date | null = null;
    
    if (plan === 'PRO_YEARLY') {
      const d = new Date();
      d.setFullYear(d.getFullYear() + 1);
      expiresAt = d;
    } else if (plan === 'PRO_MONTHLY') {
      const d = new Date();
      d.setMonth(d.getMonth() + 1);
      expiresAt = d;
    }

    const newLicense = {
      key: licenseKey,
      plan: plan,
      status: 'active',
      customerId: customerId,
      createdAt: new Date(),
      expiresAt: expiresAt,
      activations: [], // for sprint 9
      maxSeats: 1, // for sprint 9
    };

    // 3. Save license to Firestore
    await db.collection('licenses').add(newLicense);
    
    revalidatePath('/admin/licenses');
    return { message: 'success' };
  } catch (error: any) {
    console.error("License creation failed:", error);
    return {
      message: 'Server error',
      errors: { _form: ['An unexpected error occurred while creating the license.'] },
    };
  }
}


// --- Deactivation Action ---

const DeactivateDeviceSchema = z.object({
  licenseId: z.string().min(1),
  deviceId: z.string().min(1),
});

export type DeactivateFormState = {
    success?: string;
    error?: string;
} | null;

export async function deactivateDeviceAction(prevState: DeactivateFormState, formData: FormData): Promise<DeactivateFormState> {
  const validatedFields = DeactivateDeviceSchema.safeParse({
    licenseId: formData.get('licenseId'),
    deviceId: formData.get('deviceId'),
  });

  if (!validatedFields.success) {
    return { error: 'Invalid input.' };
  }
  
  if (!db) {
     return { error: 'Database connection is not available.' };
  }

  const { licenseId, deviceId } = validatedFields.data;

  try {
    const licenseRef = db.collection('licenses').doc(licenseId);
    const licenseSnap = await licenseRef.get();

    if (!licenseSnap.exists) {
        return { error: 'License not found.' };
    }

    const licenseData = licenseSnap.data();
    const activations = licenseData?.activations || [];

    let found = false;
    const updatedActivations = activations.map((act: any) => {
        if (act.deviceId === deviceId && act.isActive) {
            found = true;
            return { ...act, isActive: false, deactivatedAt: new Date() };
        }
        return act;
    });

    if (!found) {
        return { error: 'Active device not found for this license.' };
    }

    await licenseRef.update({ activations: updatedActivations });
    
    revalidatePath(`/admin/licenses/${licenseId}`);
    return { success: 'Device deactivated successfully.' };

  } catch (error) {
    console.error("Deactivation failed:", error);
    return { error: 'An unexpected server error occurred.' };
  }
}