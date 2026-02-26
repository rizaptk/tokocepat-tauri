'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase-admin';
import { revalidatePath } from 'next/cache';
import { PaymentInstructions, SubscriptionPlan } from '@/lib/types';

// Action to get settings
export async function getPlanSettings(): Promise<{ instructions: PaymentInstructions; plans: SubscriptionPlan[] }> {
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
        console.error("Failed to fetch plan settings:", error);
        return { instructions: {}, plans: [] };
    }
}

// Action to update payment instructions
const InstructionsSchema = z.object({
  message: z.string().optional(),
  bankName: z.string().optional(),
  accountName: z.string().optional(),
  accountNumber: z.string().optional(),
  whatsappNumber: z.string().optional(),
});
export async function updatePaymentInstructionsAction(formData: FormData): Promise<{ success: boolean, error?: string }> {
    const data = Object.fromEntries(formData.entries());
    const validatedFields = InstructionsSchema.safeParse(data);

    if (!validatedFields.success) {
        return { success: false, error: 'Invalid data provided.' };
    }

    try {
        await db.collection('app_settings').doc('paymentInstructions').set(validatedFields.data, { merge: true });
        revalidatePath('/admin/plans');
        return { success: true };
    } catch (error) {
        console.error("Failed to update payment instructions:", error);
        return { success: false, error: 'Server error while saving.' };
    }
}

// Action to update subscription plans
export async function updateSubscriptionPlansAction(plans: SubscriptionPlan[]): Promise<{ success: boolean, error?: string }> {
    // Basic validation on the server
    if (!Array.isArray(plans)) {
        return { success: false, error: 'Invalid plan data.' };
    }

    try {
        await db.collection('app_settings').doc('subscriptionPlans').set({ plans });
        revalidatePath('/admin/plans');
        return { success: true };
    } catch (error) {
        console.error("Failed to update subscription plans:", error);
        return { success: false, error: 'Server error while saving plans.' };
    }
}
