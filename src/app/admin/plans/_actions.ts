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

        // Add default values for new fields if they don't exist
        const safePlans = plans.map(p => ({
            ...p,
            maxSeats: p.maxSeats || 1,
            isTrial: p.isTrial || false,
        }));

        return { instructions, plans: safePlans };
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

    const validatedPlans = plans.map(p => ({
        id: p.id,
        name: p.name,
        price: Number(p.price) || 0,
        durationDays: Number(p.durationDays) || 30,
        description: p.description,
        maxSeats: Number(p.maxSeats) || 1,
        isTrial: p.isTrial || false,
    }));

    try {
        await db.collection('app_settings').doc('subscriptionPlans').set({ plans: validatedPlans });
        revalidatePath('/admin/plans');
        return { success: true };
    } catch (error) {
        console.error("Failed to update subscription plans:", error);
        return { success: false, error: 'Server error while saving plans.' };
    }
}
