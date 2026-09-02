import { Link } from 'react-router-dom';
import { LicenseManager } from '@/components/LicenseManager';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, CreditCard } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeButtons';
import { NotificationBell } from '@/components/NotificationBell';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { invoke } from '@tauri-apps/api/core';

export default function LicensePage() {
  const handleOpenPricing = () => {
    invoke('open_pricing');
  };

  return (
    <div className="flex h-screen w-full flex-col bg-muted/40">
        <header className="sticky shrink-0 top-0 z-20 flex h-10 items-center gap-4 border-b border-border/60 bg-background/80 px-4 backdrop-blur-md justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold">
                <Shield className="h-4 w-4" aria-hidden /> Lisensi
            </div>
            <div className="flex items-center gap-2">
                <NotificationBell />
                <ThemeToggle />
            </div>
        </header>
        <main className="flex flex-1 flex-col lg:flex-row min-h-0">
            <section className="lg:w-2/5 border-b shrink-0 lg:border-b-0 lg:border-r bg-background p-8 flex flex-col justify-between">
                <div className="space-y-8">
                    <div className="space-y-3">
                        <h1 className="text-3xl font-bold tracking-tight">
                            Lisensi
                        </h1>
                        <p className="text-muted-foreground">
                            Kelola lisensi produk, aktivasi, dan langganan Anda.
                        </p>
                    </div>

                    <div className="grid gap-4">
                        <div className="rounded-xl border p-4">
                            <div className="flex items-center gap-3">
                                <Shield className="h-5 w-5 text-primary" />
                                <div>
                                    <p className="text-sm font-medium">Lisensi</p>
                                    <p className="text-xs text-muted-foreground">Aktivasi & validasi</p>
                                </div>
                            </div>
                        </div>
                        <div className="rounded-xl border p-4">
                            <div className="flex items-center gap-3">
                                <CreditCard className="h-5 w-5 text-primary" />
                                <div>
                                    <p className="text-sm font-medium">Beli / Upgrade</p>
                                    <p className="text-xs text-muted-foreground">Lihat paket harga layanan di web</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="mt-8">
                    <Link to="/dashboard/settings" className="text-sm font-medium text-primary hover:underline">
                        &larr; Kembali ke Pengaturan
                    </Link>
                </div>
            </section>

            <section className="flex-1 min-h-0">
                <ScrollArea className="h-full">
                    <div className='p-8 space-y-6'>
                        <Button
                            variant="outline"
                            className="w-full sm:w-auto"
                            onClick={handleOpenPricing}
                        >
                            <CreditCard className="mr-2 h-4 w-4" /> Beli / Upgrade Lisensi
                        </Button>
                        <Card>
                            <CardHeader>
                                <CardTitle>Status Lisensi</CardTitle>
                                <CardDescription>Kelola lisensi aplikasi dan aktivasi perangkat.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <LicenseManager />
                            </CardContent>
                        </Card>
                    </div>
                </ScrollArea>
            </section>
        </main>
    </div>
  );
}