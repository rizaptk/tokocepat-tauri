import Link from 'next/link';
import { TokoCepatLogo } from '@/components/TokoCepatLogo';

export default function InventoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
      <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
        <Link href="/">
          <TokoCepatLogo />
        </Link>
      </header>
      <main className="flex flex-1 min-h-0">
        {children}
      </main>
    </div>
  );
}
