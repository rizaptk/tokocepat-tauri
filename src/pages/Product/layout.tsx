import { Link } from 'react-router-dom';
import { TokoCepatLogo } from '@/components/TokoCepatLogo';
import { ThemeToggle } from '@/components/ThemeButtons';
import { NotificationBell } from '@/components/NotificationBell';

export default function ProductLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full flex-col">
      <header className="sticky top-0 z-20 flex h-12 items-center gap-4 border-b border-border/60 bg-background/80 px-4 backdrop-blur-md justify-between">
        <Link to="/">
          <TokoCepatLogo />
        </Link>
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
