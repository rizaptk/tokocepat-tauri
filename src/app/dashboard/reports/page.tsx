
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
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
        title: 'Inventory Report',
        description: 'View stock levels, value, and movement history.',
        href: '/dashboard/reports/inventory',
        icon: Warehouse,
        comingSoon: false,
    },
     {
        title: 'Stock Movement Report',
        description: 'A detailed ledger of all inventory changes.',
        href: '/dashboard/reports/stock-movement',
        icon: History,
        comingSoon: false,
    },
    {
        title: 'Consumption Report',
        description: 'Track raw ingredient usage and waste.',
        href: '/dashboard/reports/consumption',
        icon: Beaker,
        comingSoon: false,
    },
    {
        title: 'Shift History',
        description: 'Review summaries for all closed shifts.',
        href: '/dashboard', // Links back to dashboard where shift list is.
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
        <div className="flex min-h-screen w-full flex-col bg-muted/40">
           <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6 z-10">
                <Button variant="outline" size="icon" className="shrink-0" asChild>
                    <Link href="/dashboard">
                        <ArrowLeft className="h-4 w-4" />
                        <span className="sr-only">Back to Dashboard</span>
                    </Link>
                </Button>
                <div className="flex-1">
                    <h1 className="text-lg font-semibold">Reports & Analytics</h1>
                </div>
           </header>
          <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {reportLinks.map((report) => (
                    <Card key={report.href} className="flex flex-col hover:border-primary/50 transition-colors">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-3">
                                <report.icon className="h-6 w-6 text-primary" />
                                {report.title}
                            </CardTitle>
                            <CardDescription>{report.description}</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-grow">
                             {report.comingSoon && (
                                <div className="text-xs font-semibold text-blue-600">COMING SOON</div>
                             )}
                        </CardContent>
                        <CardFooter>
                            <Link href={report.href} className={`ml-auto w-full`}>
                                <Button className='w-full' variant={report.comingSoon ? 'secondary' : 'default'} disabled={report.comingSoon}>
                                    View Report <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            </Link>
                        </CardFooter>
                    </Card>
                ))}
            </div>
          </main>
        </div>
    );
}
