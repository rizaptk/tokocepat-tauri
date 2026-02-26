'use client';

import { useFormStatus, useFormState } from 'react-dom';
import { Button } from '@/components/ui/button';
import { deactivateDeviceAction, DeactivateFormState } from '../../_actions';
import { useToast } from '@/hooks/use-toast';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" variant="destructive" size="sm" disabled={pending}>
            {pending ? (
                <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deactivating...
                </>
            ) : (
                'Deactivate'
            )}
        </Button>
    )
}

export function DeactivateButton({ licenseId, deviceId }: { licenseId: string, deviceId: string }) {
    const initialState: DeactivateFormState = null;
    const [state, formAction] = useFormState(deactivateDeviceAction, initialState);
    const { toast } = useToast();

    useEffect(() => {
        if (state?.success) {
            toast({ title: 'Success', description: state.success });
        } else if (state?.error) {
            toast({ variant: 'destructive', title: 'Error', description: state.error });
        }
    }, [state, toast]);

    return (
        <form action={formAction}>
            <input type="hidden" name="licenseId" value={licenseId} />
            <input type="hidden" name="deviceId" value={deviceId} />
            <SubmitButton />
        </form>
    );
}
