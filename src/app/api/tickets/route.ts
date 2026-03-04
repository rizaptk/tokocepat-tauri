'use server';

import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { z } from 'zod';

// Helper to find or create customer
async function findOrCreateCustomer(email: string, name?: string): Promise<string> {
    const customersRef = db.collection('customers');
    const customerQuery = await customersRef.where('email', '==', email).limit(1).get();

    if (customerQuery.empty) {
        const newCustomerRef = await customersRef.add({ email, name: name || '', createdAt: new Date(), licenseCount: 0 });
        return newCustomerRef.id;
    } else {
        const customerDoc = customerQuery.docs[0];
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


export async function POST(request: Request) {
    try {
        const body = await request.json();
        const validatedFields = SubmitTicketSchema.safeParse(body);

        if (!validatedFields.success) {
            return NextResponse.json({ 
                message: 'Validation failed',
                errors: validatedFields.error.flatten().fieldErrors 
            }, { status: 400 });
        }

        const { customerName, customerEmail, customerWhatsapp, plan, proofOfPaymentUrl, userNotes, deviceId } = validatedFields.data;
        
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
            deviceId,
            claimedAt: null,
        });
        
        return NextResponse.json({ message: 'success' }, { status: 201 });

    } catch (error: any) {
        console.error("[API/tickets] Ticket submission failed:", error);
        return NextResponse.json({ 
            message: 'Server error',
            errors: { _form: ['An unexpected error occurred while submitting your ticket.'] }
        }, { status: 500 });
    }
}
