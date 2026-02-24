
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, Menu, Package, ShoppingCart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutGrid },
  { href: '/cashier', label: 'Cashier', icon: ShoppingCart },
  { href: '/dashboard/products', label: 'Stock', icon: Package },
];

export function BottomNav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    // Exact match for some routes, startsWith for others
    if (href === '/dashboard' || href === '/cashier' || href === '/') {
        return pathname === href;
    }
    return pathname.startsWith(href);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 h-16 border-t bg-background/95 backdrop-blur-sm md:hidden">
      <div className="grid h-full grid-cols-4 items-center justify-around px-2">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex h-full flex-col items-center justify-center gap-1 rounded-lg text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-primary',
              {
                'text-primary bg-accent': isActive(item.href),
              }
            )}
          >
            <item.icon className="h-5 w-5" />
            <span>{item.label}</span>
          </Link>
        ))}
        <Popover>
          <PopoverTrigger asChild>
            <button
              className={cn(
                'flex h-full flex-col items-center justify-center gap-1 rounded-lg text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-primary'
              )}
            >
              <Menu className="h-5 w-5" />
              <span>More</span>
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" align="center" className="mb-2 w-48 p-1">
              <Link href="/dashboard/categories" className="block w-full text-left p-2 rounded-md hover:bg-accent text-sm">Categories</Link>
              <Link href="#" className="block w-full text-left p-2 rounded-md hover:bg-accent text-sm">Settings</Link>
              <Link href="#" className="block w-full text-left p-2 rounded-md hover:bg-accent text-sm">Reports</Link>
          </PopoverContent>
        </Popover>
      </div>
    </nav>
  );
}
