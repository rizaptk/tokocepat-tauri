'use client';

import { useEffect, useState, useRef } from 'react';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PlusCircle, Loader2 } from 'lucide-react';
import { createLicenseAction, type CreateFormState } from '../_actions';
import { useToast } from '@/hooks/use-toast';
import { getPlanSettings } from '../../plans/_actions';
import { SubscriptionPlan } from '@/lib/types';

function SubmitButton() {
    const { pending } = useFormStatus();
    
    return (
        <Button type="submit" disabled={pending}>
            {pending ? (
                <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                </>
            ) : (
                'Generate License'
            )}
        </Button>
    )
}

export function CreateLicenseDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);

  const initialState: CreateFormState = { message: '' };
  const [state, formAction] = useActionState(createLicenseAction, initialState);

  useEffect(() => {
    if (isOpen) {
        getPlanSettings().then(settings => {
            setPlans(settings.plans || []);
        });
    }
  }, [isOpen]);

  useEffect(() => {
    if (state.message === 'success') {
      toast({
        title: 'License Created!',
        description: 'The new license has been generated and assigned.',
      });
      setIsOpen(false);
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
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <PlusCircle className="mr-2 h-4 w-4" />
          Create License
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New License</DialogTitle>
          <DialogDescription>
            Generate a new license for a customer. The license key will be auto-generated.
          </DialogDescription>
        </DialogHeader>
        <form ref={formRef} action={formAction} className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="customerEmail" className="text-right">
                Customer Email
                </Label>
                <div className="col-span-3">
                    <Input
                        id="customerEmail"
                        name="customerEmail"
                        placeholder="customer@example.com"
                    />
                     {state?.errors?.customerEmail && (
                        <p className="text-sm font-medium text-destructive pt-1">{state.errors.customerEmail}</p>
                    )}
                </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="plan" className="text-right">
                Plan
                </Label>
                 <div className="col-span-3">
                    <Select name="plan">
                        <SelectTrigger>
                            <SelectValue placeholder="Select a plan" />
                        </SelectTrigger>
                        <SelectContent>
                            {plans.map((plan) => (
                                <SelectItem key={plan.id} value={plan.name}>
                                    {plan.name} ({plan.isTrial ? 'Trial' : `IDR ${plan.price.toLocaleString()}`})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                     {state?.errors?.plan && (
                        <p className="text-sm font-medium text-destructive pt-1">{state.errors.plan}</p>
                    )}
                 </div>
            </div>
             {state?.errors?._form && (
                <p className="text-sm font-medium text-destructive text-center">{state.errors._form}</p>
            )}
            <DialogFooter>
                <SubmitButton />
            </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
