'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { loginAction, type LoginFormState } from '../_actions/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Shield } from 'lucide-react';

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" className="w-full" disabled={pending}>
            {pending ? (
                <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing In...
                </>
            ) : (
                'Sign In'
            )}
        </Button>
    )
}


export default function AdminLoginPage() {
    const initialState: LoginFormState = {};
    const [state, formAction] = useActionState(loginAction, initialState);

    return (
        <div className="flex items-center justify-center min-h-screen bg-muted/40">
            <Card className="w-full max-w-sm">
                <CardHeader className="text-center">
                    <Shield className="mx-auto h-8 w-8 text-primary" />
                    <CardTitle className="text-2xl mt-2">Admin Panel</CardTitle>
                    <CardDescription>Enter your credentials to access the dashboard.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form action={formAction} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="username">Username</Label>
                            <Input id="username" name="username" type="text" placeholder="admin" required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <Input id="password" name="password" type="password" required />
                        </div>
                        {state?.error && (
                            <p className="text-sm font-medium text-destructive text-center pt-2">{state.error}</p>
                        )}
                        <SubmitButton />
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
