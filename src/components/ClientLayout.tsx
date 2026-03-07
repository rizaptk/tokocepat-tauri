
"use client";

import { usePathname } from 'next/navigation';
import { DbProvider } from '@/components/DbProvider';
import { LicenseProvider } from '@/components/LicenseProvider';
import { BottomNav } from '@/components/BottomNav';
import { BackupManager } from './BackupManager';
import { useIsMobile } from '@/lib/ismobile-store';
import { SideNav } from './SideNav';
import { useLicense } from '@/hooks/useLicense';
import { useMemo } from 'react';
import { PrintManager } from './PrintManager';
import { ThemeSwitcher } from './ThemeSwitcher';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const {isMobile} = useIsMobile();
    const { status: licenseStatus } = useLicense();

    const isLicensed = useMemo(() => {
        return licenseStatus === 'VALID' || licenseStatus === 'EXPIRES_SOON';
    }, [licenseStatus]);

    if (pathname.startsWith('/admin') || pathname === '/login' || pathname.startsWith('/report')) {
        // For admin routes and the report page, we don't want any of the client-side providers or nav.
        return <>{children}</>;
    }

    // For all non-admin routes, apply the client-side providers and bottom nav.
    return (
        <DbProvider>
            <ThemeSwitcher />
            <BackupManager />
            <LicenseProvider>
                <PrintManager />
                <div className={!isMobile && isLicensed ? 'pl-16' : ''}>{children}</div>
                {
                    isLicensed &&
                    (
                        isMobile ?
                        <BottomNav /> :
                        <SideNav />
                    )
                }
            </LicenseProvider>
        </DbProvider>
    );
}
