'use client';

import { usePathname } from 'next/navigation';
import { DbProvider } from '@/components/DbProvider';
import { LicenseProvider } from '@/components/LicenseProvider';
import { BottomNav } from '@/components/BottomNav';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    if (pathname.startsWith('/admin') || pathname.startsWith('/login')) {
        // For admin routes, we don't want any of the client-side providers or nav.
        return <>{children}</>;
    }

    // For all non-admin routes, apply the client-side providers and bottom nav.
    return (
        <DbProvider>
            <LicenseProvider>
                <div>{children}</div>
                <BottomNav />
            </LicenseProvider>
        </DbProvider>
    );
}
