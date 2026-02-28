
'use client';

import Link from 'next/link';
import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, Check, Info, WifiOff, Zap, Clock, RefreshCw, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { submitPaymentTicketAction, type FormState, getPublicSettings, activateTrialAction, getTicketStatusForDevice } from '../_actions';
import { SubscriptionPlan, PaymentInstructions, PaymentTicket } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { generateDeviceFingerprint } from '@/lib/security';
import { saveLicenseData } from '@/services/dataService';
import { formatDistanceToNow } from 'date-fns';

type TicketStatusInfo = { ticketId: string; status: PaymentTicket['status']; plan: string; createdAt: string; };

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

const TrialCard = ({ plan, onActivate }: { plan: SubscriptionPlan, onActivate: () => void }) => {
    const [isActivating, startTransition] = useTransition();

    return (
        <Card className="border-primary bg-primary/5">
            <CardHeader>
                 <div className="flex justify-between items-center">
                    <CardTitle className="text-xl text-primary flex items-center gap-2">
                        <Zap/> {plan.name}
                    </CardTitle>
                 </div>
                 <CardDescription>{plan.description}</CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-3xl font-bold">Free</p>
                <p className="text-sm text-muted-foreground">{plan.durationDays} Days / {plan.maxSeats} Device</p>
            </CardContent>
            <CardFooter>
                <Button className="w-full" onClick={() => startTransition(onActivate)} disabled={isActivating}>
                     {isActivating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Activating...</> : <><Zap className="mr-2 h-4 w-4"/> Activate Free Trial</>}
                </Button>
            </CardFooter>
        </Card>
    );
};

const TicketStatusCard = ({ statusInfo, onRefresh }: { statusInfo: TicketStatusInfo, onRefresh: () => void }) => {
    const [isRefreshing, startRefreshTransition] = useTransition();

    const handleRefresh = () => {
        startRefreshTransition(() => {
            onRefresh();
        });
    }

    const statusMap = {
        pending: {
            title: "Ticket Submitted",
            description: "Your payment proof is pending review by an administrator.",
            icon: <Clock className="h-10 w-10 text-yellow-500" />,
        },
        processing: {
            title: "Ticket in Progress",
            description: "An administrator is currently reviewing your submission.",
            icon: <Loader2 className="h-10 w-10 text-blue-500 animate-spin" />,
        },
        resolved: {
            title: "Your License is Ready!",
            description: "Your payment has been approved. Please review the terms and activate your subscription.",
            icon: <Check className="h-10 w-10 text-green-500" />,
        }
    };
    
    const currentStatus = statusMap[statusInfo.status] || statusMap.pending;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Subscription Status</CardTitle>
                <CardDescription>Thank you for your submission. Here's the current status of your ticket.</CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-4 p-8">
                <div className="flex justify-center">{currentStatus.icon}</div>
                <h3 className="text-xl font-semibold">{currentStatus.title}</h3>
                <p className="text-muted-foreground">{currentStatus.description}</p>
                <div className="text-sm pt-4 border-t">
                    <p>Plan: <span className="font-semibold">{statusInfo.plan}</span></p>
                    <p>Submitted: <span className="font-semibold">{formatDistanceToNow(new Date(statusInfo.createdAt), { addSuffix: true })}</span></p>
                </div>
            </CardContent>
            <CardFooter>
                {statusInfo.status === 'resolved' ? (
                     <Button asChild className="w-full" size="lg">
                        <Link href={`/aktivasi?ticket=${statusInfo.ticketId}`}>
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Review and Activate
                        </Link>
                    </Button>
                ) : (
                    <Button variant="outline" className="w-full" onClick={handleRefresh} disabled={isRefreshing}>
                        {isRefreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <RefreshCw className="mr-2 h-4 w-4" />}
                        Refresh Status
                    </Button>
                )}
            </CardFooter>
        </Card>
    );
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
    const [isTrialUsed, setIsTrialUsed] = useState(true);
    const [deviceId, setDeviceId] = useState<string | null>(null);
    const [ticketStatus, setTicketStatus] = useState<TicketStatusInfo | null>(null);
    
    const [formValues, setFormValues] = useState({
        customerName: '',
        customerEmail: '',
        customerWhatsapp: '',
        proofOfPaymentUrl: '',
        userNotes: '',
    });

    const formRef = useRef<HTMLFormElement>(null);
    const initialState: FormState = { message: '' };
    const [state, formAction] = useActionState(submitPaymentTicketAction, initialState);

    const fetchStatusAndSettings = async () => {
        setLoading(true);
        const generatedDeviceId = await generateDeviceFingerprint();
        setDeviceId(generatedDeviceId);

        const trialHasBeenUsed = localStorage.getItem('tokoc_trial_activated_on_device') === 'true';
        setIsTrialUsed(trialHasBeenUsed);
        
        try {
            // A simple fetch to check online status. The heartbeat route is fine for this.
            await fetch('/api/heartbeat', { method: 'HEAD' });
            
            setIsOnline(true);
            const [data, status] = await Promise.all([
                getPublicSettings(),
                getTicketStatusForDevice(generatedDeviceId)
            ]);
            setSettings(data);
            setTicketStatus(status);

        } catch (error) {
            setIsOnline(false);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStatusAndSettings();
    }, []);

    useEffect(() => {
        if (state.message === 'success') {
            toast({
                title: 'Ticket Submitted!',
                description: 'Your payment proof has been received. Please wait for admin verification.',
            });
             setTicketStatus({
                status: 'pending',
                plan: selectedPlan!.name,
                createdAt: new Date().toISOString(),
                ticketId: '' // We don't have the ID client-side, but it's okay for the UI state
            });
            formRef.current?.reset();
            setFormValues({
                customerName: '',
                customerEmail: '',
                customerWhatsapp: '',
                proofOfPaymentUrl: '',
                userNotes: '',
            });
            setSelectedPlan(null);
        } else if (state.errors?._form) {
            toast({
                variant: 'destructive',
                title: 'An error occurred',
                description: state.errors._form.join(', '),
            });
        }
    }, [state, toast, selectedPlan]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormValues(prev => ({ ...prev, [name]: value }));
    };

    const handleActivateTrial = async (planId: string) => {
        if (!deviceId) {
            toast({ variant: 'destructive', title: 'Error', description: 'Device ID could not be determined.' });
            return;
        }
        try {
            const result = await activateTrialAction(planId, deviceId);

            if (result.error) {
                throw new Error(result.error);
            }
            if (result.token) {
                 await saveLicenseData(result.token);
                localStorage.setItem('tokoc_trial_activated_on_device', 'true');
                toast({ title: 'Trial Activated!', description: 'Your free trial has started. The app will now reload.' });
                setTimeout(() => window.location.reload(), 1500);
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Trial Activation Failed', description: error.message });
        }
    };


    if (loading) {
        return (
             <Card>
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
            <Card>
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
    
    if (ticketStatus) {
        return <TicketStatusCard statusInfo={ticketStatus} onRefresh={fetchStatusAndSettings} />;
    }

    if (!settings || settings.plans.length === 0) {
        return (
             <Card>
                <CardHeader>
                    <CardTitle>Subscription</CardTitle>
                </CardHeader>
                <CardContent><p className="text-muted-foreground">No subscription plans are currently available.</p></CardContent>
             </Card>
        )
    }

    const trialPlans = settings ? settings.plans.filter(p => p.isTrial) : [];
    const paidPlans = settings ? settings.plans.filter(p => !p.isTrial) : [];

    return (
         <Card>
            <CardHeader>
                <CardTitle>Subscription Plans</CardTitle>
                <CardDescription>Choose a plan to activate or extend your license.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                 {!isTrialUsed && trialPlans.length > 0 && (
                    <div className="space-y-2">
                        {trialPlans.map(plan => (
                            <TrialCard key={plan.id} plan={plan} onActivate={() => handleActivateTrial(plan.id)} />
                        ))}
                    </div>
                 )}
                
                {paidPlans.length > 0 && (
                    <div className="space-y-4 pt-4 border-t">
                        <h3 className="font-semibold text-lg">Purchase a License</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {paidPlans.map(plan => (
                                <PlanCard key={plan.id} plan={plan} isSelected={selectedPlan?.id === plan.id} onSelect={() => setSelectedPlan(plan)} />
                            ))}
                        </div>
                    </div>
                )}
                
                {selectedPlan && (
                    <div className="space-y-6 pt-6 border-t">
                        <h3 className="text-lg font-semibold">Step 2: Manual Payment for "{selectedPlan.name}"</h3>
                        
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
                            <input type="hidden" name="deviceId" value={deviceId || ''} />
                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                 <div className="space-y-2">
                                    <Label htmlFor="customerName">Full Name</Label>
                                    <Input id="customerName" name="customerName" placeholder="e.g. Budi Santoso" required value={formValues.customerName} onChange={handleInputChange} />
                                     {state?.errors?.customerName && <p className="text-sm font-medium text-destructive pt-1">{state.errors.customerName}</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="customerWhatsapp">WhatsApp Number</Label>
                                    <Input id="customerWhatsapp" name="customerWhatsapp" type="tel" placeholder="e.g. 08123456789" required value={formValues.customerWhatsapp} onChange={handleInputChange} />
                                     {state?.errors?.customerWhatsapp && <p className="text-sm font-medium text-destructive pt-1">{state.errors.customerWhatsapp}</p>}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="customerEmail">Your Email</Label>
                                <Input id="customerEmail" name="customerEmail" type="email" placeholder="you@example.com" required value={formValues.customerEmail} onChange={handleInputChange} />
                                {state?.errors?.customerEmail && <p className="text-sm font-medium text-destructive pt-1">{state.errors.customerEmail}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="proofOfPaymentUrl">Proof of Payment URL</Label>
                                <Input id="proofOfPaymentUrl" name="proofOfPaymentUrl" type="url" placeholder="https://imgur.com/your-proof" required value={formValues.proofOfPaymentUrl} onChange={handleInputChange} />
                                <p className="text-xs text-muted-foreground">Upload your transfer receipt to a service like Imgur or Google Drive and paste the public link here.</p>
                                {state?.errors?.proofOfPaymentUrl && <p className="text-sm font-medium text-destructive pt-1">{state.errors.proofOfPaymentUrl}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="userNotes">Notes (Optional)</Label>
                                <Textarea id="userNotes" name="userNotes" placeholder="e.g., Payment for account renewal." value={formValues.userNotes} onChange={handleInputChange} />
                            </div>
                             {state?.errors?.deviceId && <p className="text-sm font-medium text-destructive text-center">{state.errors.deviceId}</p>}
                            {state?.errors?._form && <p className="text-sm font-medium text-destructive text-center">{state.errors._form}</p>}
                            <SubmitButton />
                        </form>
                    </div>
                )}

            </CardContent>
        </Card>
    )
}
