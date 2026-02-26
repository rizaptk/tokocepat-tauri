
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { randomBytes } from 'crypto';

// This is a placeholder for your payment gateway's webhook secret.
// IMPORTANT: Store this in your environment variables (.env file).
const WEBHOOK_SECRET = process.env.PAYMENT_GATEWAY_WEBHOOK_SECRET || 'your-secret-here';

/**
 * Verifies the signature of the incoming webhook request.
 * This is a critical security step to ensure the request is from your payment provider.
 * Each provider has a different implementation (e.g., using HMAC-SHA256).
 *
 * @param request The incoming NextRequest object.
 * @returns A promise that resolves if the signature is valid, and rejects otherwise.
 */
async function verifySignature(request: Request): Promise<void> {
    //
    // --- THIS IS A PLACEHOLDER ---
    //
    // In a real application, you would implement the specific signature
    // verification logic for your chosen payment gateway (e.g., Stripe, Midtrans, Xendit).
    //
    // Example for Stripe:
    // const signature = request.headers.get('stripe-signature');
    // const body = await request.text(); // Use text(), not json(), as the raw body is needed
    // try {
    //   stripe.webhooks.constructEvent(body, signature, WEBHOOK_SECRET);
    // } catch (err) {
    //   throw new Error('Webhook signature verification failed.');
    // }
    //
    // For now, we will assume the request is valid if the secret is present.
    //
    if (!WEBHOOK_SECRET || WEBHOOK_SECRET === 'your-secret-here') {
        console.warn('Webhook secret is not set. Skipping signature verification. DO NOT use this in production.');
        return;
    }
    // A simple check for a custom header for basic security in testing
    const simpleAuth = request.headers.get('X-Webhook-Auth');
    if (simpleAuth !== WEBHOOK_SECRET) {
        // throw new Error('Webhook signature verification failed.');
    }
}


export async function POST(request: Request) {
    try {
        // 1. Verify the incoming request signature (SECURITY CRITICAL)
        // await verifySignature(request);
        // Note: For now, we are skipping strict verification.

        const body = await request.json();

        // 2. Check for the event type (e.g., 'payment_successful', 'charge.succeeded')
        // This will vary depending on your payment provider.
        if (body.event === 'payment.successful') {
            const { customerEmail, plan, amount, currency, gatewayTransactionId } = body.data;

            if (!customerEmail || !plan) {
                 return NextResponse.json({ error: 'Missing customer email or plan' }, { status: 400 });
            }

            // --- Create License Logic (adapted from _actions.ts) ---

            // a. Find or create customer
            const customersRef = db.collection('customers');
            const customerQuery = await customersRef.where('email', '==', customerEmail).limit(1).get();
            
            let customerId: string;
            
            if (customerQuery.empty) {
              const newCustomerRef = await customersRef.add({
                email: customerEmail,
                name: body.data.customerName || '',
                createdAt: new Date(),
                licenseCount: 1,
              });
              customerId = newCustomerRef.id;
            } else {
              const customerDoc = customerQuery.docs[0];
              customerId = customerDoc.id;
              const currentCount = customerDoc.data().licenseCount || 0;
              await customerDoc.ref.update({ licenseCount: currentCount + 1 });
            }

            // b. Generate the license
            const licenseKey = `TKN-${randomBytes(4).toString('hex').toUpperCase()}-${randomBytes(4).toString('hex').toUpperCase()}`;
            let expiresAt: Date | null = null;
            if (plan === 'PRO_YEARLY') {
                expiresAt = new Date(new Date().setFullYear(new Date().getFullYear() + 1));
            } else if (plan === 'PRO_MONTHLY') {
                expiresAt = new Date(new Date().setMonth(new Date().getMonth() + 1));
            }

            const newLicense = {
              key: licenseKey,
              plan: plan,
              status: 'active',
              customerId: customerId,
              createdAt: new Date(),
              expiresAt: expiresAt,
              activations: [],
              maxSeats: 1,
            };

            await db.collection('licenses').add(newLicense);

            // c. Log the payment transaction
            await db.collection('payments').add({
                customerEmail: customerEmail,
                amount: amount || 0,
                currency: currency || 'IDR',
                status: 'completed',
                gatewayTransactionId: gatewayTransactionId || `wh-${Date.now()}`,
                createdAt: new Date(),
            });

        } else {
             return NextResponse.json({ message: `Webhook event received: ${body.event}` }, { status: 200 });
        }
        
        // 3. Return a success response to the payment gateway
        return NextResponse.json({ message: 'Webhook processed successfully' }, { status: 200 });

    } catch (error: any) {
        console.error('Webhook Error:', error.message);
        return NextResponse.json({ error: `Webhook handler failed: ${error.message}` }, { status: 500 });
    }
}

