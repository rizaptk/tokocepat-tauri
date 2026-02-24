
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, Library, MoreHorizontal, Package, ShoppingCart, SlidersHorizontal, Warehouse } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutGrid },
  { href: '/cashier', label: 'Cashier', icon: ShoppingCart },
  { href: '/product', label: 'Products', icon: Package },
];

const moreNavItems = [
    { href: '/product/inventory', label: 'Inventory', icon: Warehouse },
]

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
    <nav className="fixed bottom-0 left-0 right-0 z-50 h-16 border-t bg-background/95 backdrop-blur-sm md:bottom-4 md:left-1/2 md:h-auto md:-translate-x-1/2 md:w-auto md:rounded-full md:border">
      <div className="grid h-full grid-cols-4 items-center justify-around px-2 md:flex md:w-full md:gap-1 md:px-4 md:py-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex h-full w-full flex-col items-center justify-center gap-1 rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-primary md:h-auto md:w-20 md:py-2',
              isClient && isActive(item.href) && 'text-primary'
            )}
          >
            <item.icon className="h-5 w-5" />
            <span className="text-xs font-medium">{item.label}</span>
          </Link>
        ))}
         <Popover>
            <PopoverTrigger asChild>
                <button className="flex h-full w-full flex-col items-center justify-center gap-1 rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-primary md:h-auto md:w-20 md:py-2">
                    <MoreHorizontal className="h-5 w-5" />
                    <span className="text-xs font-medium">More</span>
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2 mb-3">
                <div className="grid gap-1">
                    {moreNavItems.map((item) => (
                         <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-primary",
                                isClient && isActive(item.href) && 'bg-accent text-primary'
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
