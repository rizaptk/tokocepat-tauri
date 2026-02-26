
'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { submitPaymentTicketAction, type FormState } from '../_actions';

const planTypes = [
  { value: 'PRO_MONTHLY', label: 'Pro Monthly' },
  { value: 'PRO_YEARLY', label: 'Pro Yearly' },
  { value: 'LIFETIME', label: 'Lifetime' },
];

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" className="w-full" disabled={pending}>
            {pending ? (
                <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                </>
            ) : (
                 <>
                    <Send className="mr-2 h-4 w-4" />
                    Submit Payment Ticket
                </>
            )}
        </Button>
    )
}

export function ManualPaymentForm() {
    const { toast } = useToast();
    const formRef = useRef<HTMLFormElement>(null);
    const initialState: FormState = { message: '' };
    const [state, formAction] = useActionState(submitPaymentTicketAction, initialState);

    useEffect(() => {
        if (state.message === 'success') {
            toast({
                title: 'Ticket Submitted!',
                description: 'Your payment proof has been received. Please wait for admin verification.',
            });
            formRef.current?.reset();
        } else if (state.errors?._form) {
            toast({
                variant: 'destructive',
                title: 'An error occurred',
                description: state.errors._form.join(', '),
            });
        }
    }, [state, toast]);

    return (
        <Card id="manual-payment">
            <CardHeader>
                <CardTitle>Manual Payment Submission</CardTitle>
                <CardDescription>
                    Paid via bank transfer? Submit your proof of payment here for manual verification.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form ref={formRef} action={formAction} className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="customerEmail">Your Email</Label>
                        <Input id="customerEmail" name="customerEmail" type="email" placeholder="you@example.com" required />
                         {state?.errors?.customerEmail && (
                            <p className="text-sm font-medium text-destructive pt-1">{state.errors.customerEmail}</p>
                        )}
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="plan">Plan Purchased</Label>
                         <Select name="plan" required>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a plan" />
                            </SelectTrigger>
                            <SelectContent>
                                {planTypes.map((plan) => (
                                    <SelectItem key={plan.value} value={plan.value}>
                                        {plan.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                         {state?.errors?.plan && (
                            <p className="text-sm font-medium text-destructive pt-1">{state.errors.plan}</p>
                        )}
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="proofOfPaymentUrl">Proof of Payment URL</Label>
                        <Input id="proofOfPaymentUrl" name="proofOfPaymentUrl" type="url" placeholder="https://imgur.com/your-proof" required />
                        <p className="text-xs text-muted-foreground">
                            Upload your payment screenshot to a service like Imgur or Google Drive and paste the public link here.
                        </p>
                         {state?.errors?.proofOfPaymentUrl && (
                            <p className="text-sm font-medium text-destructive pt-1">{state.errors.proofOfPaymentUrl}</p>
                        )}
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="userNotes">Notes (Optional)</Label>
                        <Textarea id="userNotes" name="userNotes" placeholder="e.g., Payment for account renewal." />
                    </div>
                    {state?.errors?._form && (
                        <p className="text-sm font-medium text-destructive text-center">{state.errors._form}</p>
                    )}
                    <SubmitButton />
                </form>
            </CardContent>
        </Card>
    );
}
