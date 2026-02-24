
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
    <nav className="fixed bottom-0 left-0 right-0 z-50 h-16 border-t bg-background/95 backdrop-blur-sm md:bottom-4 md:left-1/2 md:h-auto md:w-auto md:-translate-x-1/2 md:transform md:rounded-full md:border md:bg-background/70 md:shadow-lg">
      <div className="flex h-full items-center justify-around px-2 md:gap-1 md:px-3 md:py-2">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex h-full w-full flex-col items-center justify-center gap-1 rounded-none border-b-2 border-b-transparent text-muted-foreground transition-colors hover:border-b-primary hover:text-primary md:h-auto md:w-auto md:flex-row md:gap-2 md:px-4 md:py-2',
              {
                'text-primary border-b-primary': isActive(item.href),
              }
            )}
          >
            <item.icon className="h-5 w-5" />
            <span className="hidden font-medium md:inline md:text-sm">{item.label}</span>
          </Link>
        ))}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              className="flex h-full w-full flex-col items-center justify-center gap-1 rounded-none border-b-2 border-b-transparent text-muted-foreground transition-colors hover:bg-transparent hover:border-b-primary hover:text-primary md:h-auto md:w-auto md:flex-row md:gap-2 md:px-4 md:py-2"
            >
              <Menu className="h-5 w-5" />
              <span className="hidden font-medium md:inline md:text-sm">More</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent side="top" align="center" className="mb-2 w-48 p-1">
              <Link href="/dashboard/categories" className="block w-full text-left p-2 rounded-md hover:bg-primary/80 hover:text-background text-sm">Categories</Link>
              <Link href="/dashboard/modifiers" className="block w-full text-left p-2 rounded-md hover:bg-primary/80 hover:text-background text-sm">Modifiers</Link>
              <Link href="#" className="block w-full text-left p-2 rounded-md hover:bg-primary/80 hover:text-background text-sm">Settings</Link>
              <Link href="#" className="block w-full text-left p-2 rounded-md hover:bg-primary/80 hover:text-background text-sm">Reports</Link>
          </PopoverContent>
        </Popover>
      </div>
    </nav>
  );
}
