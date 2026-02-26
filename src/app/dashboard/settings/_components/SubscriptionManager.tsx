
'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, Check, Info, WifiOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { submitPaymentTicketAction, type FormState, getPublicSettings } from '../_actions';
import { SubscriptionPlan, PaymentInstructions } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);
};

const PlanCard = ({ plan, isSelected, onSelect }: { plan: SubscriptionPlan, isSelected: boolean, onSelect: () => void }) => {
    const durationText = plan.durationDays === -1 ? "Lifetime" : `${plan.durationDays} Days`;
    
    return (
        <Card className={cn("cursor-pointer transition-all hover:shadow-lg", isSelected ? "ring-2 ring-primary" : "hover:border-primary/50")} onClick={onSelect}>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                    {isSelected && <Check className="h-6 w-6 text-primary" />}
                </div>
                <CardDescription>{plan.description}</CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-3xl font-bold">{formatCurrency(plan.price)}</p>
                <p className="text-sm text-muted-foreground">{durationText} / {plan.maxSeats} Device(s)</p>
            </CardContent>
        </Card>
    )
}

const SubmitButton = () => {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" className="w-full" disabled={pending}>
            {pending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting...</> : <><Send className="mr-2 h-4 w-4" />Submit Payment Ticket</>}
        </Button>
    )
}

export function SubscriptionManager() {
    const { toast } = useToast();
    const [settings, setSettings] = useState<{ plans: SubscriptionPlan[], instructions: PaymentInstructions } | null>(null);
    const [loading, setLoading] = useState(true);
    const [isOnline, setIsOnline] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
    
    const formRef = useRef<HTMLFormElement>(null);
    const initialState: FormState = { message: '' };
    const [state, formAction] = useActionState(submitPaymentTicketAction, initialState);

    useEffect(() => {
        async function checkStatusAndFetchSettings() {
            setLoading(true);
            try {
                const response = await fetch('/api/ping');
                if (response.ok) {
                    setIsOnline(true);
                    const data = await getPublicSettings();
                    setSettings(data);
                } else {
                    setIsOnline(false);
                }
            } catch (error) {
                setIsOnline(false);
            } finally {
                setLoading(false);
            }
        }
        checkStatusAndFetchSettings();
    }, []);

    useEffect(() => {
        if (state.message === 'success') {
            toast({
                title: 'Ticket Submitted!',
                description: 'Your payment proof has been received. Please wait for admin verification.',
            });
            formRef.current?.reset();
            setSelectedPlan(null);
        } else if (state.errors?._form) {
            toast({
                variant: 'destructive',
                title: 'An error occurred',
                description: state.errors._form.join(', '),
            });
        }
    }, [state, toast]);

    if (loading) {
        return (
            <Card id="subscription">
                <CardHeader>
                    <Skeleton className="h-8 w-1/2" />
                    <Skeleton className="h-4 w-3/4" />
                </CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-24 w-full" />
                </CardContent>
            </Card>
        )
    }
    
    if (!isOnline) {
        return (
            <Card id="subscription">
                 <CardHeader>
                    <CardTitle>Subscription</CardTitle>
                    <CardDescription>Manage your subscription plan.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-center justify-center gap-4 text-center p-8 bg-muted/50 rounded-lg border border-dashed">
                        <WifiOff className="h-10 w-10 text-muted-foreground" />
                        <p className="font-semibold">You are currently offline</p>
                        <p className="text-sm text-muted-foreground">Please connect to the internet to manage your subscription.</p>
                    </div>
                </CardContent>
            </Card>
        );
    }
    
    if (!settings || settings.plans.length === 0) {
        return (
             <Card id="subscription">
                <CardHeader>
                    <CardTitle>Subscription</CardTitle>
                </CardHeader>
                <CardContent><p className="text-muted-foreground">No subscription plans are currently available.</p></CardContent>
             </Card>
        )
    }

    return (
        <Card id="subscription">
            <CardHeader>
                <CardTitle>Subscription Plans</CardTitle>
                <CardDescription>Choose a plan to activate or extend your license.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                 {/* Step 1: Plan Selection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {settings.plans.map(plan => (
                        <PlanCard key={plan.id} plan={plan} isSelected={selectedPlan?.id === plan.id} onSelect={() => setSelectedPlan(plan)} />
                    ))}
                </div>
                
                {/* Step 2: Payment Instructions & Submission */}
                {selectedPlan && (
                    <div className="space-y-6 pt-6 border-t">
                        <h3 className="text-lg font-semibold">Step 2: Manual Payment for "{selectedPlan.name}"</h3>
                        
                        {/* Instructions */}
                        <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-lg space-y-4">
                           <div className="flex items-start gap-3">
                                <Info className="h-5 w-5 mt-0.5 shrink-0" />
                                <div>
                                    <h4 className="font-bold">Payment Instructions</h4>
                                    <p className="text-sm">{settings.instructions.message || "Please make a payment to the account below."}</p>
                                </div>
                           </div>
                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm border-t border-blue-200 pt-4">
                                <p><strong className="block text-blue-900/80">Bank:</strong> {settings.instructions.bankName || 'N/A'}</p>
                                <p><strong className="block text-blue-900/80">Account Number:</strong> {settings.instructions.accountNumber || 'N/A'}</p>
                                <p><strong className="block text-blue-900/80">Account Name:</strong> {settings.instructions.accountName || 'N/A'}</p>
                                <p><strong className="block text-blue-900/80">WhatsApp Contact:</strong> {settings.instructions.whatsappNumber || 'N/A'}</p>
                           </div>
                        </div>

                        <h3 className="text-lg font-semibold">Step 3: Submit Your Proof</h3>
                        <form ref={formRef} action={formAction} className="space-y-6">
                            <input type="hidden" name="plan" value={selectedPlan.name} />
                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                 <div className="space-y-2">
                                    <Label htmlFor="customerName">Full Name</Label>
                                    <Input id="customerName" name="customerName" placeholder="e.g. Budi Santoso" required />
                                     {state?.errors?.customerName && <p className="text-sm font-medium text-destructive pt-1">{state.errors.customerName}</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="customerWhatsapp">WhatsApp Number</Label>
                                    <Input id="customerWhatsapp" name="customerWhatsapp" type="tel" placeholder="e.g. 08123456789" required />
                                     {state?.errors?.customerWhatsapp && <p className="text-sm font-medium text-destructive pt-1">{state.errors.customerWhatsapp}</p>}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="customerEmail">Your Email</Label>
                                <Input id="customerEmail" name="customerEmail" type="email" placeholder="you@example.com" required />
                                {state?.errors?.customerEmail && <p className="text-sm font-medium text-destructive pt-1">{state.errors.customerEmail}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="proofOfPaymentUrl">Proof of Payment URL</Label>
                                <Input id="proofOfPaymentUrl" name="proofOfPaymentUrl" type="url" placeholder="https://imgur.com/your-proof" required />
                                <p className="text-xs text-muted-foreground">Upload your transfer receipt to a service like Imgur or Google Drive and paste the public link here.</p>
                                {state?.errors?.proofOfPaymentUrl && <p className="text-sm font-medium text-destructive pt-1">{state.errors.proofOfPaymentUrl}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="userNotes">Notes (Optional)</Label>
                                <Textarea id="userNotes" name="userNotes" placeholder="e.g., Payment for account renewal." />
                            </div>
                            {state?.errors?._form && <p className="text-sm font-medium text-destructive text-center">{state.errors._form}</p>}
                            <SubmitButton />
                        </form>
                    </div>
                )}

            </CardContent>
        </Card>
    )
}
