'use server';

import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { PaymentInstructions, SubscriptionPlan, PaymentTicket } from '@/lib/types';


export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId');

    try {
        if (deviceId) {
            // Fetch all tickets for the device and sort in-memory to be robust
            const snapshot = await db.collection('paymentTickets')
                .where('deviceId', '==', deviceId)
                .get();

            if (snapshot.empty) {
                return NextResponse.json({ status: null });
            }

            // Sort docs in memory to find the most recent ticket
            const sortedDocs = snapshot.docs.sort((a, b) => 
                b.data().createdAt.toDate().getTime() - a.data().createdAt.toDate().getTime()
            );

            const ticketDoc = sortedDocs[0];
            const ticket = ticketDoc.data();


            if (ticket.status === 'rejected' || (ticket.status === 'resolved' && ticket.claimedAt)) {
                return NextResponse.json({ status: null });
            }

            const statusInfo = {
                ticketId: ticketDoc.id,
                status: ticket.status as PaymentTicket['status'],
                plan: ticket.plan,
                createdAt: ticket.createdAt.toDate().toISOString(),
            };
            return NextResponse.json({ status: statusInfo });

        } else {
            // Fetch public settings (plans and instructions)
            const instructionsRef = db.collection('app_settings').doc('paymentInstructions');
            const plansRef = db.collection('app_settings').doc('subscriptionPlans');

            const [instructionsSnap, plansSnap] = await Promise.all([
                instructionsRef.get(),
                plansRef.get(),
            ]);

            const instructions = instructionsSnap.exists ? (instructionsSnap.data() as PaymentInstructions) : {};
            const plans = plansSnap.exists ? (plansSnap.data()?.plans as SubscriptionPlan[]) : [];

            return NextResponse.json({ instructions, plans });
        }
    } catch (error: any) {
        console.error("[API/settings] Failed to fetch data:", error);
        return NextResponse.json({ error: 'Could not fetch server data.' }, { status: 500 });
    }
}
