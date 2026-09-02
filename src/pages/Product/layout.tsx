import { Package } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeButtons';
import { NotificationBell } from '@/components/NotificationBell';

export default function ProductLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full flex-col">
      <header className="sticky top-0 z-20 flex h-10 items-center gap-4 border-b border-border/60 bg-background/80 px-4 backdrop-blur-md justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Package className="h-4 w-4" aria-hidden /> Produk
        </div>
        <div className="flex items-center gap-2">
            <NotificationBell />
            <ThemeToggle />
        </div>
      </header>
      <main className="flex flex-1">
        {children}
      </main>
    </div>
  );
}
