import { Link, useLocation } from 'react-router-dom';
import {
    LayoutGrid,
    ShoppingCart,
    Package,
    Warehouse,
    BarChart as BarChartIcon,
    Settings,
    ShieldAlert,
    Gift,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/lib/ismobile-store';
import { useLicense } from '@/hooks/useLicense';
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useStore } from '@/lib/store';

const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutGrid },
    { href: '/cashier', label: 'Kasir', icon: ShoppingCart },
    { href: '/product', label: 'Produk', icon: Package },
    { href: '/inventory', label: 'Inventori', icon: Warehouse },
    { href: '/dashboard/promos', label: 'Promo', icon: Gift },
    { href: '/dashboard/reports', label: 'Laporan', icon: BarChartIcon },
    { href: '/dashboard/settings', label: 'Pengaturan', icon: Settings },
];


export function SideNav() {
    const location = useLocation();
    const { isMobile } = useIsMobile();
    const reducedMotion = usePrefersReducedMotion();
    const { status: licenseStatus } = useLicense();
    const [isClient, setIsClient] = useState(false);
    const { customAccess } = useStore();

    useEffect(() => setIsClient(true), []);

    const filteredNav = useMemo(() => {
        if (!customAccess?.access) {
            return navItems;
        }

        return navItems.filter(f => customAccess.access?.includes(f.label.toLowerCase()));
    },[customAccess]);

    const isLicensed = licenseStatus === 'VALID' || licenseStatus === 'EXPIRES_SOON';

    const isActive = (href: string) => {
        // Exact match for dashboard, otherwise prefix match
        if (href === '/dashboard') {
            return location.pathname === href;
        }
        return location.pathname.startsWith(href);
    };

    // Render only on desktop, when licensed, and not on admin pages.
    if (!isClient || isMobile || !isLicensed) {
        return null;
    }

    return (
<aside className="fixed left-0 top-0 z-40 flex h-full w-12 flex-col border-r border-sidebar-border bg-sidebar bg-opacity-95 backdrop-blur-xl">
            <div aria-hidden className="aurora-rail pointer-events-none absolute inset-0" />
            <div aria-hidden className="gloss-chrome pointer-events-none absolute inset-x-0 top-0 h-px" />
            <nav className="relative flex h-full flex-col items-center justify-center">
                <TooltipProvider>
                    <div className="flex flex-col items-center gap-1.5 px-1.5 py-3">
                        {filteredNav.map((item) => (
                            <Tooltip key={item.href}>
                                <TooltipTrigger asChild>
                                    <Link
                                        to={item.href}
                                        aria-current={isActive(item.href) ? 'page' : undefined}
                                        className={cn(
                                            "group relative flex h-9 w-9 shrink-0 items-center justify-center rounded-[2px]",
                                            "transition-colors duration-150",
                                            isActive(item.href)
                                                ? "text-sidebar-active-foreground"
                                                : "text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground"
                                        )}
                                    >
                                        {isActive(item.href) && (
                                            reducedMotion ? (
                                                <div className="absolute inset-0 rounded-[2px] bg-sidebar-active" />
                                            ) : (
                                                <motion.div
                                                    layoutId="active-nav-bg"
                                                    className="absolute inset-0 rounded-[2px] bg-sidebar-active"
                                                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                                />
                                            )
                                        )}

                                        <item.icon
                                            className="relative z-10 h-4.5 w-4.5 transition-colors duration-150"
                                        />

                                        <span className="sr-only">{item.label}</span>
                                    </Link>
                                </TooltipTrigger>

                                <TooltipContent side="right">
                                    <p>{item.label}</p>
                                </TooltipContent>
                            </Tooltip>
                        ))}
                        {
                            isActive('/license') &&
                            <Tooltip key="license">
                                <TooltipTrigger asChild>
                                    <Link to="/license" aria-current={isActive('/license') ? 'page' : undefined} className={cn(
                                            "group relative flex h-9 w-9 shrink-0 items-center justify-center rounded-[2px]",
                                            "transition-colors duration-150",
                                            "text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground"
                                        )}>
                                            {isActive('/license') && (
                                                reducedMotion ? (
                                                    <div className="absolute inset-0 rounded-[2px] bg-sidebar-active" />
                                                ) : (
                                                    <motion.div
                                                        layoutId="active-nav-bg"
                                                        className="absolute inset-0 rounded-[2px] bg-sidebar-active"
                                                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                                    />
                                                )
                                            )}
                                            <ShieldAlert className="relative z-10 h-4.5 w-4.5 transition-colors duration-150" />
                                            <span className="sr-only">Lisensi</span>
                                    </Link>
                                </TooltipTrigger>
                            </Tooltip>
                        }
                    </div>
                </TooltipProvider>
            </nav>
        </aside>
    )
}