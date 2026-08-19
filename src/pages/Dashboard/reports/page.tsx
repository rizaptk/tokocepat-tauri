import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, ArrowRight, BarChart2, BookOpen, Warehouse, ArchiveX, History, ShieldCheck, Landmark, ReceiptText, TicketPercent } from 'lucide-react';
import { NotificationBell } from '@/components/NotificationBell';
import { ThemeToggle } from '@/components/ThemeButtons';

const reportLinks = [
    {
        title: 'Laporan Penjualan',
        description: 'Analisis omzet, laba, dan tren performa.',
        href: '/dashboard/reports/sales',
        icon: BarChart2,
        comingSoon: false,
    },
    {
        title: 'Ringkasan Stok',
        description: 'Stok awal, akhir, dan mutasi seluruh item.',
        href: '/dashboard/reports/stock-summary',
        icon: Warehouse,
        comingSoon: false,
    },
    {
        title: 'Buku Besar Stok',
        description: 'Detail riwayat perubahan inventori real-time.',
        href: '/dashboard/reports/stock-movement',
        icon: History,
        comingSoon: false,
    },
    {
        title: 'Riwayat Sif',
        description: 'Tinjau ringkasan seluruh sif yang telah tutup.',
        href: '/dashboard/reports/shifts',
        icon: BookOpen,
        comingSoon: false,
    },
    {
        title: 'Laporan Void',
        description: 'Audit seluruh transaksi yang dibatalkan.',
        href: '/dashboard/reports/void',
        icon: ArchiveX,
        comingSoon: false,
    },
    {
        title: 'Laporan Konsinyasi',
        description: 'Tinjau bagi hasil titipan dan sisa stok harian.',
        href: '/dashboard/reports/consignments',
        icon: Landmark, // imported from lucide-react
        comingSoon: false,
    },
    {
        title: 'Audit Bisnis',
        description: 'Rekonsiliasi margin laba dengan selisih kas.',
        href: '/dashboard/reports/profit',
        icon: ShieldCheck,
        comingSoon: false,
    },
    {
        title: 'Audit Pajak',
        description: 'Konsolidasi data pajak untuk pelaporan.',
        href: '/dashboard/reports/tax',
        icon: ReceiptText,
        comingSoon: false,
    },
    {
        title: 'Performa Promo & Voucher',
        description: 'Analisis dampak diskon dan pemakaian voucher.',
        href: '/dashboard/reports/promos',
        icon: TicketPercent,
        comingSoon: false,
    },
];

export default function ReportsPage() {
    const nav = useNavigate();
    return (
        <div className="flex min-h-screen w-full flex-col bg-muted/40">
            {/* Header */}
            <header className="sticky top-0 flex h-10 items-center gap-4 border-b border-border/60 bg-background/80 px-4 backdrop-blur-md z-20">
                <Button variant="outline" size="icon" className="shrink-0" asChild>
                    <Link to="#" onClick={() => nav(-1)}>
                        <ArrowLeft className="h-4 w-4" />
                        <span className="sr-only">Kembali</span>
                    </Link>
                </Button>
                <h1 className="text-lg font-semibold tracking-tight flex-1">
                    Laporan & Analitik
                </h1>
                <div className="flex items-center gap-2">
                    <NotificationBell />
                    <ThemeToggle />
                </div>
            </header>

            {/* Split Layout */}
            <main className="flex flex-1 flex-col lg:flex-row">
                
                {/* LEFT — HERO SECTION */}
                <section className="lg:w-2/5 border-b lg:border-b-0 lg:border-r bg-background p-8 flex flex-col justify-center">
                    
                    <div className="max-w-md space-y-6">
                        <div className="space-y-3">
                            <h2 className="text-3xl font-bold tracking-tight leading-tight">
                                Intelijen Operasional
                            </h2>
                            <p className="text-muted-foreground">
                                Pantau performa penjualan, mutasi stok, dan aktivitas keuangan bisnis Anda secara real-time.
                            </p>
                        </div>

                        {/* Optional Executive Metrics Preview */}
                        <div className="grid grid-cols-2 gap-4 pt-6">
                            <div className="rounded-xl border p-4">
                                <div className="text-xs text-muted-foreground">
                                    Laporan Aktif
                                </div>
                                <div className="text-2xl font-semibold">
                                    {reportLinks.length}
                                </div>
                            </div>
                            <div className="rounded-xl border p-4">
                                <div className="text-xs text-muted-foreground">
                                    Cakupan Data
                                </div>
                                <div className="text-2xl font-semibold">
                                    Real-time
                                </div>
                            </div>
                        </div>

                        <div className="pt-6">
                            <Button size="lg" asChild>
                                <Link to="/dashboard/reports/sales">
                                    Lihat Ikhtisar Penjualan
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Link>
                            </Button>
                        </div>
                    </div>
                </section>

                {/* RIGHT — REPORT CARDS */}
                <section className="flex-1 p-8">
                    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                        {reportLinks.map((report) => (
                            <Link key={report.href} to={report.href} className="group">
                                <Card
                                    className="
                                        h-full cursor-pointer
                                        transition-colors duration-200
                                        hover:border-primary/40
                                    "
                                >
                                    <CardHeader>
                                        <CardTitle className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                                                    <report.icon className="h-5 w-5" />
                                                </div>
                                                <span className="text-base font-semibold">
                                                    {report.title}
                                                </span>
                                            </div>

                                            <ArrowRight className="h-4 w-4 opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-1" />
                                        </CardTitle>

                                        <CardDescription className="mt-2 text-sm">
                                            {report.description}
                                        </CardDescription>
                                    </CardHeader>
                                </Card>
                            </Link>
                        ))}
                    </div>
                </section>
            </main>
        </div>
    );
}
