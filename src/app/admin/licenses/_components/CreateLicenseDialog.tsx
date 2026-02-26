
'use client';

import { useState } from 'react';
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
import { PlusCircle } from 'lucide-react';


const planTypes = [
  { value: 'PRO_MONTHLY', label: 'Pro Monthly' },
  { value: 'PRO_YEARLY', label: 'Pro Yearly' },
  { value: 'LIFETIME', label: 'Lifetime' },
];

export function CreateLicenseDialog() {
  const [isOpen, setIsOpen] = useState(false);

  // We will add form handling with a server action here in the next step.

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
                Generate a new license for a customer. The license key will be
                auto-generated.
            </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="customer-email" className="text-right">
                Customer Email
                </Label>
                <Input
                id="customer-email"
                placeholder="customer@example.com"
                className="col-span-3"
                />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="plan-type" className="text-right">
                Plan
                </Label>
                <Select>
                <SelectTrigger className="col-span-3">
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
            </div>
            </div>
            <DialogFooter>
            <Button type="submit">Generate License</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
  );
}
