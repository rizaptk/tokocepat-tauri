import Link from 'next/link';
import { TokoCepatLogo } from '@/components/TokoCepatLogo';
import { ThemeToggle } from '@/components/ThemeButtons';

export default function ReportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
      <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6 justify-between">
        <Link href="/">
          <TokoCepatLogo />
        </Link>
        <div className="flex items-center gap-2">
            <ThemeToggle />
        </div>
      </header>
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
