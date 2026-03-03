import Link from 'next/link';
import { TokoCepatLogo } from '@/components/TokoCepatLogo';
import { ThemeToggle } from '@/components/ThemeButtons';

export default function InventoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full flex-col">
      <header className="sticky top-0 z-20 flex h-16 items-center gap-4 px-4 md:px-6 justify-between">
        <Link href="/">
          <TokoCepatLogo />
        </Link>
        <ThemeToggle />
      </header>
      <main className="flex flex-1 min-h-0">
        {children}
      </main>
    </div>
  );
}
