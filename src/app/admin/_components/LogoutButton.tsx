'use client';

import { useRouter } from 'next/navigation';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { LogOut } from 'lucide-react';
import { getAuth, signOut } from 'firebase/auth';
import { firebaseClientConfig } from '@/lib/firebase-client-config';
import { initializeApp, getApps } from 'firebase/app';

if (firebaseClientConfig && !getApps().length) {
  initializeApp(firebaseClientConfig);
}

export function LogoutButton() {
    const router = useRouter();

    const handleLogout = async () => {
        // Sign out from Firebase on the client
        try {
            const auth = getAuth();
            await signOut(auth);
        } catch (error) {
            console.error("Firebase sign out error", error);
        }

        // Tell the server to clear the session cookie
        await fetch('/api/auth/session-logout', { method: 'POST' });

        // Redirect to login page
        router.push('/admin/login');
        router.refresh(); // Ensure the page reloads to clear state
    };

    return (
         <DropdownMenuItem onSelect={(e) => { e.preventDefault(); handleLogout(); }} className="w-full cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10">
            <LogOut className="mr-2 h-4 w-4" />
            <span>Logout</span>
        </DropdownMenuItem>
    );
}
