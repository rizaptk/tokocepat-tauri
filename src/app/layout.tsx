import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { DbProvider } from '@/components/DbProvider';
import { BottomNav } from '@/components/BottomNav';
import { MobileChecker } from '@/components/MobileChecker';
import { LicenseProvider } from '@/components/LicenseProvider';

export const metadata: Metadata = {
  title: 'TokoCepat',
  description: 'A fast point-of-sale system for efficient cashier operations.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body antialiased">
        <MobileChecker />
        <DbProvider>
          <LicenseProvider>
            <div>{children}</div>
            <BottomNav />
          </LicenseProvider>
        </DbProvider>
        <Toaster />
      </body>
    </html>
  );
}
