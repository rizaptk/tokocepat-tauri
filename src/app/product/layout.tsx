import Link from 'next/link';
import { TokoCepatLogo } from '@/components/TokoCepatLogo';

export default function ProductLayout({
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
      <main className="flex flex-1">
        {children}
      </main>
    </div>
  );
}
