'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { initializeApp, getApps } from 'firebase/app';
import { firebaseClientConfig } from '@/lib/firebase-client-config';
import { TokoCepatLogo } from '@/components/TokoCepatLogo';
import { ShieldAlert } from 'lucide-react';

if (firebaseClientConfig && !getApps().length) {
  initializeApp(firebaseClientConfig);
}

async function verifyAdminToken(token: string): Promise<boolean> {
    try {
        const response = await fetch('/api/auth/verify-token', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!response.ok) {
            return false;
        }
        const data = await response.json();
        return data.isAdmin === true;
    } catch (error) {
        console.error("Token verification failed:", error);
        return false;
    }
}


export function AuthGuard({ children }: { children: React.ReactNode }) {
    const [status, setStatus] = useState<'loading' | 'authorized' | 'unauthorized'>('loading');
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        const auth = getAuth();
        const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
            if (pathname === '/admin/login') {
                 if (user) {
                     router.push('/admin');
                 } else {
                    setStatus('authorized');
                 }
            } else {
                if (user) {
                    const token = await user.getIdToken();
                    const isAdmin = await verifyAdminToken(token);
                    if (isAdmin) {
                        setStatus('authorized');
                    } else {
                        await auth.signOut();
                        setStatus('unauthorized');
                        router.push('/admin/login');
                    }
                } else {
                    setStatus('unauthorized');
                    router.push('/admin/login');
                }
            }
        });

        return () => unsubscribe();
    }, [pathname, router]);

    if (status === 'loading') {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                    <TokoCepatLogo />
                    <p className="text-muted-foreground">Verifying Admin Access...</p>
                    <div className="w-48 h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary animate-pulse w-full"></div>
                    </div>
                </div>
            </div>
        );
    }
    
    if (status === 'unauthorized' && pathname !== '/admin/login') {
         return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4 text-center p-4">
                    <ShieldAlert className="h-12 w-12 text-destructive" />
                    <h1 className="text-xl font-bold">Unauthorized</h1>
                    <p className="text-muted-foreground">You do not have permission to access this page. Redirecting...</p>
                </div>
            </div>
        );
    }
    
    if (status === 'authorized') {
        return <>{children}</>;
    }

    return null;
}
