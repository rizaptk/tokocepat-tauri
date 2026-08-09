import { useLocation } from 'react-router-dom';
import { DbProvider } from '@/components/DbProvider';
import { LicenseProvider } from '@/components/LicenseProvider';
import { BottomNav } from '@/components/BottomNav';
import { useIsMobile } from '@/lib/ismobile-store';
import { SideNav } from './SideNav';
import { useLicense } from '@/hooks/useLicense';
import { useMemo } from 'react';
import { ThemeSwitcher } from './ThemeSwitcher';
import { GlobalShiftSync } from '@/services/shiftService';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
    const location = useLocation();
    const {isMobile} = useIsMobile();
    const { status: licenseStatus } = useLicense();

    const isLicensed = useMemo(() => {
        return licenseStatus === 'VALID' || licenseStatus === 'EXPIRES_SOON';
    }, [licenseStatus]);

    if (location.pathname === '/login') {
        // For login page, we don't want any of the client-side providers or nav.
        return <>{children}</>;
    }

    // For all non-admin routes, apply the client-side providers and bottom nav.
    return (
        <DbProvider>
            <ThemeSwitcher />
            <LicenseProvider>
                <div className={!isMobile && isLicensed ? 'pl-12' : ''}>{children}</div>
                {
                    isLicensed &&
                    (
                        isMobile ?
                        <BottomNav /> :
                        <SideNav />
                    )
                }
                {isLicensed && <GlobalShiftSync />}
            </LicenseProvider>
        </DbProvider>
    );
}
