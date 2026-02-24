
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, Package, ShoppingCart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutGrid },
  { href: '/cashier', label: 'Cashier', icon: ShoppingCart },
  { href: '/dashboard/products', label: 'Products', icon: Package },
];

export function BottomNav() {
  const pathname = usePathname();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const isActive = (href: string) => {
    if (!isClient) return false;
    if (href === '/dashboard' || href === '/cashier') {
        return pathname === href;
    }
    return pathname.startsWith(href);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 h-16 border-t bg-background/95 backdrop-blur-sm md:hidden">
      <div className="grid h-full grid-cols-3 items-center justify-around px-2">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex flex-col items-center justify-center gap-1 h-full text-muted-foreground transition-colors hover:text-primary',
              {
                'text-primary border-t-2 border-primary': isActive(item.href),
              }
            )}
          >
            <item.icon className="h-5 w-5" />
            <span className="text-xs font-medium">{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
