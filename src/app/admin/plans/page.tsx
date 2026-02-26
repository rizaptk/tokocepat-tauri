'use client';

import { useState, useEffect, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { getPlanSettings, updatePaymentInstructionsAction, updateSubscriptionPlansAction } from './_actions';
import { PaymentInstructions, SubscriptionPlan } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, PlusCircle, Save, Trash2 } from 'lucide-react';

// --- Payment Instructions Form ---
const instructionsSchema = z.object({
  message: z.string().optional(),
  bankName: z.string().optional(),
  accountName: z.string().optional(),
  accountNumber: z.string().optional(),
  whatsappNumber: z.string().optional(),
});
type InstructionsFormValues = z.infer<typeof instructionsSchema>;

function PaymentInstructionsForm({ initialData }: { initialData: PaymentInstructions }) {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();

    const form = useForm<InstructionsFormValues>({
        resolver: zodResolver(instructionsSchema),
        defaultValues: initialData,
    });
    
    useEffect(() => {
        form.reset(initialData);
    }, [initialData, form]);

    const onSubmit = (data: InstructionsFormValues) => {
        startTransition(async () => {
            const formData = new FormData();
            Object.entries(data).forEach(([key, value]) => {
                if (value) formData.append(key, value);
            });
            const result = await updatePaymentInstructionsAction(formData);
            if (result.success) {
                toast({ title: "Success", description: "Payment instructions updated." });
            } else {
                toast({ variant: 'destructive', title: "Error", description: result.error });
            }
        });
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Manual Payment Instructions</CardTitle>
                <CardDescription>This information will be shown to users who choose manual payment.</CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField control={form.control} name="message" render={({ field }) => (
                            <FormItem><FormLabel>Message / Instructions</FormLabel><FormControl><Textarea placeholder="Please transfer to the account below..." {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField control={form.control} name="bankName" render={({ field }) => (
                                <FormItem><FormLabel>Bank Name</FormLabel><FormControl><Input placeholder="e.g. BCA" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="accountNumber" render={({ field }) => (
                                <FormItem><FormLabel>Account Number</FormLabel><FormControl><Input placeholder="e.g. 1234567890" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                        </div>
                        <FormField control={form.control} name="accountName" render={({ field }) => (
                            <FormItem><FormLabel>Account Holder Name</FormLabel><FormControl><Input placeholder="e.g. PT TokoCepat" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="whatsappNumber" render={({ field }) => (
                            <FormItem><FormLabel>WhatsApp Contact Number</FormLabel><FormControl><Input placeholder="e.g. +628123456789" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />

                        <Button type="submit" disabled={isPending}>
                            {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Saving...</> : <><Save className="mr-2 h-4 w-4"/> Save Instructions</>}
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
}

// --- Subscription Plans Form ---
function SubscriptionPlansForm({ initialData }: { initialData: SubscriptionPlan[] }) {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const [plans, setPlans] = useState<SubscriptionPlan[]>(initialData);

    useEffect(() => {
        setPlans(initialData);
    }, [initialData]);

    const handleAddPlan = () => {
        setPlans([...plans, { id: `NEW_${Date.now()}`, name: 'New Plan', price: 0, durationDays: 30, description: 'New plan description' }]);
    };
    
    const handleRemovePlan = (index: number) => {
        setPlans(plans.filter((_, i) => i !== index));
    };

    const handlePlanChange = (index: number, field: keyof SubscriptionPlan, value: string | number) => {
        const newPlans = [...plans];
        // @ts-ignore
        newPlans[index][field] = value;
        setPlans(newPlans);
    };

    const handleSavePlans = () => {
        startTransition(async () => {
            const result = await updateSubscriptionPlansAction(plans);
            if (result.success) {
                toast({ title: "Success", description: "Subscription plans updated." });
            } else {
                toast({ variant: 'destructive', title: "Error", description: result.error });
            }
        });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Subscription Plans</CardTitle>
                <CardDescription>Manage the subscription plans available to users.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Plan Name</TableHead>
                                <TableHead>Price (IDR)</TableHead>
                                <TableHead>Duration (Days)</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {plans.map((plan, index) => (
                                <TableRow key={plan.id}>
                                    <TableCell><Input value={plan.name} onChange={e => handlePlanChange(index, 'name', e.target.value)} /></TableCell>
                                    <TableCell><Input type="number" value={plan.price} onChange={e => handlePlanChange(index, 'price', Number(e.target.value))} /></TableCell>
                                    <TableCell><Input type="number" value={plan.durationDays} onChange={e => handlePlanChange(index, 'durationDays', Number(e.target.value))} /></TableCell>
                                    <TableCell><Input value={plan.description} onChange={e => handlePlanChange(index, 'description', e.target.value)} /></TableCell>
                                    <TableCell><Button variant="ghost" size="icon" onClick={() => handleRemovePlan(index)}><Trash2 className="h-4 w-4 text-destructive"/></Button></TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                     <Button variant="outline" onClick={handleAddPlan}><PlusCircle className="mr-2 h-4 w-4"/>Add Plan</Button>
                </div>
            </CardContent>
            <CardFooter>
                 <Button onClick={handleSavePlans} disabled={isPending}>
                    {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Saving...</> : <><Save className="mr-2 h-4 w-4"/> Save All Plans</>}
                 </Button>
            </CardFooter>
        </Card>
    );
}

// --- Main Page ---
export default function PlanManagerPage() {
    const [settings, setSettings] = useState<{ instructions: PaymentInstructions; plans: SubscriptionPlan[] } | null>(null);
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
        async function loadSettings() {
            setLoading(true);
            const data = await getPlanSettings();
            setSettings(data);
            setLoading(false);
        }
        loadSettings();
    }, []);

    if (loading || !settings) {
        return (
            <>
                <div className="flex items-center mb-6">
                    <h1 className="text-lg font-semibold md:text-2xl">Plan Manager</h1>
                </div>
                <div className="space-y-6">
                    <Skeleton className="h-96 w-full" />
                    <Skeleton className="h-64 w-full" />
                </div>
            </>
        )
    }

    return (
        <>
            <div className="flex items-center">
                <h1 className="text-lg font-semibold md:text-2xl">Plan Manager</h1>
            </div>
            <div className="space-y-6">
                <PaymentInstructionsForm initialData={settings.instructions} />
                <SubscriptionPlansForm initialData={settings.plans} />
            </div>
        </>
    );
}
