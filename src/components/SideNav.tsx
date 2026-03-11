import { Link, useLocation } from 'react-router-dom';
import {
    LayoutGrid,
    ShoppingCart,
    Package,
    Warehouse,
    BarChart as BarChartIcon,
    Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/lib/ismobile-store';
import { useLicense } from '@/hooks/useLicense';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutGrid },
    { href: '/cashier', label: 'Cashier', icon: ShoppingCart },
    { href: '/product', label: 'Products', icon: Package },
    { href: '/inventory', label: 'Inventory', icon: Warehouse },
    { href: '/dashboard/reports', label: 'Reports', icon: BarChartIcon },
    { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

export function SideNav() {
    const location = useLocation();
    const { isMobile } = useIsMobile();
    const { status: licenseStatus } = useLicense();
    const [isClient, setIsClient] = useState(false);

    useEffect(() => setIsClient(true), []);

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
        <aside className="fixed left-0 top-0 z-40 flex h-full w-16 flex-col bg-sidebar border-r">
            <nav className="flex h-full flex-col items-center justify-center">
                <TooltipProvider>
                    <div className="flex flex-col items-center gap-4 px-2 py-5">
                        {navItems.map((item) => (
                            <Tooltip key={item.href}>
                                <TooltipTrigger asChild>
                                    <Link
                                        to={item.href}
                                        className={cn(
                                            "group relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                                            "transition-colors duration-200",
                                            isActive(item.href)
                                                ? "text-sidebar-active-foreground"
                                                : "text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground"
                                        )}
                                    >
                                        {isActive(item.href) && (
                                            <motion.div
                                                layoutId="active-nav-bg"
                                                className="absolute inset-0 rounded-xl bg-sidebar-active"
                                                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                            />
                                        )}

                                        <item.icon
                                            className="relative z-10 h-5 w-5 transition-colors duration-200"
                                        />

                                        <span className="sr-only">{item.label}</span>
                                    </Link>
                                </TooltipTrigger>

                                <TooltipContent side="right">
                                    <p>{item.label}</p>
                                </TooltipContent>
                            </Tooltip>
                        ))}
                    </div>
                </TooltipProvider>
            </nav>
        </aside>
    )
}
