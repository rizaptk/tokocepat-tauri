
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, MoreHorizontal, Package, ShoppingCart, Warehouse, Menu, BarChart as BarChartIcon, Settings, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useState, useRef } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useIsMobile } from '@/lib/ismobile-store';
import { motion, AnimatePresence, Variants } from 'framer-motion';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutGrid },
  { href: '/cashier', label: 'Cashier', icon: ShoppingCart },
  { href: '/product', label: 'Products', icon: Package },
];

const moreNavItems = [
  { href: '/product/inventory', label: 'Inventory', icon: Warehouse },
  { href: '/dashboard/reports', label: 'Reports', icon: BarChartIcon },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
  { href: '/admin', label: 'Admin Panel', icon: Shield },
];

export function BottomNav() {
  const pathname = usePathname();
  const [isClient, setIsClient] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isHovered, setIsHovered] = useState(false); // Track if mouse is over navbar
  const { isMobile } = useIsMobile();
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => setIsClient(true), []);

  // --- Idle Logic with Hover Protection ---
  useEffect(() => {
    if (isMobile) {
      setIsMinimized(false);
      return;
    }

    const resetIdleTimer = () => {
      // 1. If user is currently hovering the navbar, cancel the timer and stay docked
      if (isHovered) {
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        return;
      }

      // 2. If already minimized, we do nothing (requires click to restore)
      if (isMinimized) return;

      // 3. Otherwise, start/reset the 3-second timer
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        setIsMinimized(true);
      }, 3000);
    };

    // Global activity listeners
    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart'];
    events.forEach(e => window.addEventListener(e, resetIdleTimer));

    resetIdleTimer(); // Initial check

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      events.forEach(e => window.removeEventListener(e, resetIdleTimer));
    };
  }, [isMobile, isMinimized, isHovered]); // re-run when hover state changes

  const isActive = (href: string) => {
    if (!isClient) return false;
    return href === '/dashboard' || href === '/cashier' || href === '/dashboard/settings' ? pathname === href : pathname.startsWith(href);
  };
  
  // Do not render the bottom navigation on any admin pages.
  if (pathname.startsWith('/admin')) {
      return null;
  }


  const containerVariants: Variants = {
    docked: {
      left: isMobile ? "0%" : "50%",
      x: isMobile ? "0%" : "-50%",
      bottom: isMobile ? "0px" : "24px",
      width: isMobile ? "100%" : "max-content",
      height: "64px",
      borderRadius: isMobile ? "0px" : "9999px",
      backgroundColor: "hsl(var(--background) / 0.95)",
      transition: { type: "spring", stiffness: 400, damping: 33 }
    },
    fab: {
      left: "32px",
      x: "0%",
      bottom: "24px",
      width: "56px",
      height: "56px",
      borderRadius: "9999x",
      backgroundColor: "hsl(var(--primary))",
      transition: { type: "spring", stiffness: 400, damping: 33 }
    }
  };

  return (
    <motion.nav
      layout
      layoutDependency={isMinimized} // Prevents route change "jumping"
      initial={false}
      animate={!isMobile && isMinimized ? "fab" : "docked"}
      variants={containerVariants}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "fixed z-50 border shadow-lg backdrop-blur-sm overflow-hidden flex items-center justify-center",
        !isMobile && isMinimized ? "cursor-pointer border-primary" : "border-border",
        isMobile && "border-t border-x-0 border-b-0"
      )}
      onClick={() => {
        if (isMinimized) {
          setIsMinimized(false);
          // Optional: give user a moment after clicking before timer starts again
          setIsHovered(true); 
          setTimeout(() => setIsHovered(false), 100);
        }
      }}
    >
      <AnimatePresence initial={false}>
        {!isMobile && isMinimized ? (
          <motion.div
            key="fab-icon"
            layout
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="absolute flex items-center justify-center"
          >
            <Menu className="h-6 w-6 text-primary-foreground" />
          </motion.div>
        ) : (
          <motion.div
            key="nav-content"
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={cn(
              "h-full w-full items-stretch px-2",
              isMobile ? "grid grid-cols-4" : "flex gap-1 px-4 py-1"
            )}
          >
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-primary md:w-24 md:py-2',
                  isClient && isActive(item.href) && 'text-primary'
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-[10px] md:text-xs font-medium whitespace-nowrap">{item.label}</span>
              </Link>
            ))}

            <Popover>
              <PopoverTrigger asChild>
                <button className="flex flex-col items-center justify-center gap-1 rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-primary md:w-24 md:py-2">
                  <MoreHorizontal className="h-5 w-5" />
                  <span className="text-[10px] md:text-xs font-medium">More</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2 mb-3" sideOffset={15}>
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
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}
