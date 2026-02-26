'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase-admin';
import { revalidatePath } from 'next/cache';
import { randomBytes } from 'crypto';
import { format } from 'date-fns';
import { SubscriptionPlan } from '@/lib/types';

const CreateLicenseSchema = z.object({
  customerEmail: z.string().email({ message: 'Please enter a valid email.' }),
  plan: z.string().min(1, 'Please select a plan.'),
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

  const { customerEmail, plan } = validatedFields.data;

  try {
    // Fetch plan details to get maxSeats
    const plansRef = db.collection('app_settings').doc('subscriptionPlans');
    const plansSnap = await plansRef.get();
    if (!plansSnap.exists) {
        return { message: 'Server error', errors: { _form: ['Subscription plans are not configured.'] }};
    }
    const allPlans = (plansSnap.data()?.plans || []) as SubscriptionPlan[];
    const selectedPlan = allPlans.find(p => p.name === plan);

    if (!selectedPlan) {
        return { message: 'Validation failed', errors: { plan: ['Selected plan not found.'] }};
    }
    const maxSeats = selectedPlan.maxSeats;

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
    const { durationDays } = selectedPlan;
    
    if (durationDays > 0) {
        const d = new Date();
        d.setDate(d.getDate() + durationDays);
        expiresAt = d;
    } else if (durationDays === -1) {
        expiresAt = null; // Lifetime
    } else { // Default to 30 days if invalid
        const d = new Date();
        d.setDate(d.getDate() + 30);
        expiresAt = d;
    }


    const newLicense = {
      key: licenseKey,
      plan: plan,
      status: 'active',
      customerId: customerId,
      createdAt: new Date(),
      expiresAt: expiresAt,
      activations: [],
      maxSeats: maxSeats,
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


// --- Dashboard Data Action ---
export async function getDashboardDataAction() {
  try {
    const licensesPromise = db.collection('licenses').orderBy('createdAt', 'asc').get();
    const customersPromise = db.collection('customers').count().get();
    const paymentsPromise = db.collection('payments').get();
    const recentPaymentsPromise = db.collection('payments').orderBy('createdAt', 'desc').limit(5).get();
    
    const [licensesSnapshot, customersSnapshot, paymentsSnapshot, recentPaymentsSnapshot] = await Promise.all([
        licensesPromise,
        customersPromise,
        paymentsPromise,
        recentPaymentsPromise,
    ]);

    const totalLicenses = licensesSnapshot.size;
    const totalCustomers = customersSnapshot.data().count;
    const totalRevenue = paymentsSnapshot.docs.reduce((sum, doc) => sum + (doc.data().amount || 0), 0);
    
    const recentPayments = recentPaymentsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt.toDate().toISOString(),
      };
    });

    // Aggregate license data for chart
    const monthlyLicenses = licensesSnapshot.docs.reduce((acc: { [key: string]: number }, doc) => {
        const createdAt = doc.data().createdAt.toDate();
        const monthKey = format(createdAt, 'yyyy-MM');
        acc[monthKey] = (acc[monthKey] || 0) + 1;
        return acc;
    }, {});
    
    const last6Months = Array.from({ length: 6 }).map((_, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        return format(d, 'yyyy-MM');
    }).reverse();

    const licenseChartData = last6Months.map(monthKey => ({
        month: format(new Date(`${monthKey}-02`), 'MMM'),
        count: monthlyLicenses[monthKey] || 0
    }));

    return {
        totalRevenue,
        totalCustomers,
        totalLicenses,
        recentPayments,
        licenseChartData,
    };

  } catch (error: any) {
    console.error("Failed to fetch dashboard data", error);
    return {
        error: "Could not load dashboard data. Please ensure Firestore is enabled and permissions are set."
    }
  }
}


export async function getLicenseDetailsAction(id: string) {
    if (!id) {
        return { error: 'License ID is required.' };
    }
    try {
        const licenseRef = db.collection('licenses').doc(id);
        const licenseSnap = await licenseRef.get();

        if (!licenseSnap.exists) {
            return { error: 'License not found.' };
        }

        const licenseData = licenseSnap.data()!;
        let customerData = null;

        if (licenseData.customerId && typeof licenseData.customerId === 'string' && licenseData.customerId.length > 0) {
            const customerRef = db.collection('customers').doc(licenseData.customerId);
            const customerSnap = await customerRef.get();
            if (customerSnap.exists) {
                customerData = customerSnap.data();
            }
        }
        
        // Serialize the data to make it safe for client components (convert Timestamps)
        const serializeData = (data: any) => {
            if (!data) return null;
            const serialized = { ...data };
            for (const key in serialized) {
                if (serialized[key] && typeof serialized[key].toDate === 'function') {
                    serialized[key] = serialized[key].toDate().toISOString();
                }
                if (key === 'activations' && Array.isArray(serialized[key])) {
                    serialized[key] = serialized[key].map(act => serializeData(act));
                }
            }
            return serialized;
        }

        const serializedLicense = serializeData({
            id: licenseSnap.id,
            ...licenseData,
        });

        return {
            license: {
                ...serializedLicense,
                customer: serializeData(customerData),
            }
        };

    } catch (error: any) {
        console.error("Failed to fetch license details", error);
        return {
            error: "Could not load license data. Please ensure Firestore is enabled and permissions are set."
        }
    }
}
