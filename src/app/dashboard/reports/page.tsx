
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, ArrowRight, BarChart2, BookOpen, Warehouse, ArchiveX, Beaker, History } from 'lucide-react';

const reportLinks = [
    {
        title: 'Sales Report',
        description: 'Analyze sales, profit, and trends over time.',
        href: '/dashboard/reports/sales',
        icon: BarChart2,
        comingSoon: false,
    },
    {
        title: 'Stock Summary Report',
        description: 'Opening, closing, and movement summary for all items.',
        href: '/dashboard/reports/stock-summary',
        icon: Warehouse,
        comingSoon: false,
    },
    {
        title: 'Stock Movement Ledger',
        description: 'A detailed, real-time ledger of all inventory changes.',
        href: '/dashboard/reports/stock-movement',
        icon: History,
        comingSoon: false,
    },
    {
        title: 'Consumption Report',
        description: 'Track raw ingredient usage and waste for F&B items.',
        href: '/dashboard/reports/consumption',
        icon: Beaker,
        comingSoon: false,
    },
    {
        title: 'Shift History',
        description: 'Review summaries for all closed shifts.',
        href: '/dashboard/reports/shifts',
        icon: BookOpen,
        comingSoon: false,
    },
    {
        title: 'Void Report',
        description: 'Review all voided transactions for auditing.',
        href: '/dashboard/reports/void',
        icon: ArchiveX,
        comingSoon: false,
    },
];

export default function ReportsPage() {
    return (
        <div className="flex min-h-screen w-full flex-col bg-muted/30">
            {/* Header */}
            <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-background px-6 z-10">
                <Button variant="outline" size="icon" asChild>
                    <Link href="/dashboard">
                        <ArrowLeft className="h-4 w-4" />
                        <span className="sr-only">Back</span>
                    </Link>
                </Button>
                <h1 className="text-lg font-semibold tracking-tight">
                    Reports & Analytics
                </h1>
            </header>

            {/* Split Layout */}
            <main className="flex flex-1 flex-col lg:flex-row">
                
                {/* LEFT — HERO SECTION */}
                <section className="lg:w-2/5 border-b lg:border-b-0 lg:border-r bg-background p-8 flex flex-col justify-center">
                    
                    <div className="max-w-md space-y-6">
                        <div className="space-y-3">
                            <h2 className="text-3xl font-bold tracking-tight leading-tight">
                                Operational Intelligence
                            </h2>
                            <p className="text-muted-foreground">
                                Gain real-time visibility into sales performance, 
                                inventory movement, and financial activity across 
                                your business operations.
                            </p>
                        </div>

                        {/* Optional Executive Metrics Preview */}
                        <div className="grid grid-cols-2 gap-4 pt-6">
                            <div className="rounded-xl border p-4">
                                <div className="text-xs text-muted-foreground">
                                    Active Reports
                                </div>
                                <div className="text-2xl font-semibold">
                                    {reportLinks.length}
                                </div>
                            </div>
                            <div className="rounded-xl border p-4">
                                <div className="text-xs text-muted-foreground">
                                    Data Scope
                                </div>
                                <div className="text-2xl font-semibold">
                                    Real-time
                                </div>
                            </div>
                        </div>

                        <div className="pt-6">
                            <Button size="lg" asChild>
                                <Link href="/dashboard/reports/sales">
                                    View Sales Overview
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
                            <Link key={report.href} href={report.href} className="group">
                                <Card
                                    className="
                                        h-full cursor-pointer
                                        transition-all duration-300
                                        hover:shadow-xl
                                        hover:-translate-y-1
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

    