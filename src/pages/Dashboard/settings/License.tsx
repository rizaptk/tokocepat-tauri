import { Link } from 'react-router-dom';
import { LicenseManager } from '@/components/LicenseManager';
import { SubscriptionManager } from './_components/SubscriptionManager';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, CreditCard } from 'lucide-react';
import { TokoCepatLogo } from '@/components/TokoCepatLogo';
import { ThemeToggle } from '@/components/ThemeButtons';
import { NotificationBell } from '@/components/NotificationBell';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function LicensePage() {
  return (
    <div className="flex h-screen w-full flex-col bg-muted/40">
        <header className="sticky shrink-0 top-0 z-20 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6 justify-between">
            <Link to="/dashboard/settings">
                <TokoCepatLogo />
            </Link>
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
                            Lisensi & Langganan
                        </h1>
                        <p className="text-muted-foreground">
                            Kelola lisensi produk, aktivasi, dan detail penagihan Anda.
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
                                    <p className="text-sm font-medium">Langganan</p>
                                    <p className="text-xs text-muted-foreground">Tagihan & paket</p>
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
                    <div className='p-8'>
                        <Tabs defaultValue="license" className="w-full" layoutId='lisensi'>
                            <TabsList defaultValue="license" className="w-full mb-8 justify-start">
                                <TabsTrigger value="license"><Shield className="mr-2 h-4 w-4" />Lisensi</TabsTrigger>
                                <TabsTrigger value="subscription"><CreditCard className="mr-2 h-4 w-4" />Langganan</TabsTrigger>
                            </TabsList>
                            
                            <TabsContent value="license">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Status Lisensi</CardTitle>
                                        <CardDescription>Kelola lisensi aplikasi dan aktivasi perangkat.</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <LicenseManager />
                                    </CardContent>
                                </Card>
                            </TabsContent>
                            
                            <TabsContent value="subscription">
                                <SubscriptionManager />
                            </TabsContent>
                        </Tabs>
                    </div>
                </ScrollArea>
            </section>
        </main>
    </div>
  );
}