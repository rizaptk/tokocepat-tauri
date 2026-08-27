import { Link, useLocation } from 'react-router-dom';
import { LayoutGrid, MoreHorizontal, Package, ShoppingCart, Warehouse, BarChart as BarChartIcon, Settings, Gift, Users, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useIsMobile } from '@/lib/ismobile-store';
import { useLicense } from '@/hooks/useLicense';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutGrid },
  { href: '/cashier', label: 'Kasir', icon: ShoppingCart },
  { href: '/product', label: 'Produk', icon: Package },
];

const moreNavItems = [
  { href: '/inventory', label: 'Inventori', icon: Warehouse },
  { href: '/dashboard/promos', label: 'Promo', icon: Gift },
  { href: '/dashboard/customers', label: 'Pelanggan', icon: Users },
  { href: '/dashboard/piutang', label: 'Piutang', icon: Wallet },
  { href: '/dashboard/reports', label: 'Laporan', icon: BarChartIcon },
  { href: '/dashboard/settings', label: 'Pengaturan', icon: Settings },
];

export function BottomNav() {
  const { status: licenseStatus } = useLicense();
  const location = useLocation();
  const [isClient, setIsClient] = useState(false);
  const { isMobile } = useIsMobile();

  useEffect(() => setIsClient(true), []);

  const isLicensed = licenseStatus === 'VALID' || licenseStatus === 'EXPIRES_SOON';

  const isActive = (href: string) => {
    if (!isClient) return false;
    return href === '/dashboard' || href === '/cashier' || href === '/dashboard/settings' ? location.pathname === href : location.pathname.startsWith(href);
  };
  
  // Render only on mobile, when licensed, and not on admin pages.
  // We check isClient to ensure isMobile is resolved correctly and avoid hydration errors.
  if (!isClient || !isMobile || !isLicensed) {
      return null;
  }

  return (
    <nav
      className="fixed bottom-0 left-0 z-50 w-full border-t bg-background/95 backdrop-blur-sm"
    >
      <div className="grid h-16 grid-cols-4 items-stretch px-2">
        {navItems.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            aria-current={isActive(item.href) ? 'page' : undefined}
            className={cn(
              'flex flex-col items-center justify-center gap-1 rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-primary',
              isActive(item.href) && 'text-primary'
            )}
          >
            <item.icon className="h-5 w-5" />
            <span className="text-[10px] font-medium whitespace-nowrap">{item.label}</span>
          </Link>
        ))}

        <Popover>
          <PopoverTrigger asChild>
            <button className="flex flex-col items-center justify-center gap-1 rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-primary">
              <MoreHorizontal className="h-5 w-5" />
              <span className="text-[10px] font-medium">Lagi</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2 mb-3" sideOffset={15}>
            <div className="grid gap-1">
              {moreNavItems.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  aria-current={isActive(item.href) ? 'page' : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-primary",
                    isActive(item.href) && 'bg-accent text-primary'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </nav>
  );
}
