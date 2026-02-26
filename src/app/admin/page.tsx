'use client';

import Link from 'next/link';
import {
  ArrowUpRight,
  DollarSign,
  Users,
  KeyRound,
  BarChart2 as BarChartIcon,
} from 'lucide-react';
import { useState, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { getDashboardDataAction } from './licenses/_actions';
import { Skeleton } from '@/components/ui/skeleton';

const formatCurrency = (amount: number, currency: string = 'IDR') => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
    }).format(amount);
};

type DashboardData = {
    totalRevenue: number;
    totalCustomers: number;
    totalLicenses: number;
    recentPayments: any[];
    licenseChartData: any[];
    error?: string;
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
        const result = await getDashboardDataAction();
        setData(result as DashboardData);
        setLoading(false);
    }
    fetchData();
  }, []);
  
  if (loading) {
    return (
        <div className="space-y-8">
            <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-3">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Revenue</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader>
                  <CardContent><Skeleton className="h-8 w-1/2" /></CardContent>
                </Card>
                <Card>
                   <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Customers</CardTitle><Users className="h-4 w-4 text-muted-foreground" /></CardHeader>
                   <CardContent><Skeleton className="h-8 w-1/4" /></CardContent>
                </Card>
                <Card>
                   <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Licenses</CardTitle><KeyRound className="h-4 w-4 text-muted-foreground" /></CardHeader>
                   <CardContent><Skeleton className="h-8 w-1/4" /></CardContent>
                </Card>
            </div>
             <div className="grid gap-4 md:gap-8 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                    <CardHeader><CardTitle className="flex items-center gap-2"><BarChartIcon className="h-5 w-5" />New Licenses (Last 6 Months)</CardTitle></CardHeader>
                    <CardContent className="pl-2"><Skeleton className="h-[250px] w-full" /></CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle>Recent Payments</CardTitle><CardDescription>A list of the most recent payments.</CardDescription></CardHeader>
                    <CardContent><Skeleton className="h-40 w-full" /></CardContent>
                </Card>
             </div>
        </div>
    );
  }
  
  if (data?.error) {
     return (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm">
          <div className="flex flex-col items-center gap-2 text-center p-8">
            <h3 className="text-2xl font-bold tracking-tight text-destructive">Error Loading Dashboard</h3>
            <p className="text-muted-foreground">{data.error}</p>
          </div>
        </div>
     )
  }

  if (!data) return null;

  const chartConfig = {
    count: {
      label: "Licenses",
      color: "hsl(var(--primary))",
    },
  } satisfies ChartConfig;

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">Based on all recorded payments</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+{data.totalCustomers}</div>
             <p className="text-xs text-muted-foreground">Total unique customers</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Licenses</CardTitle>
            <KeyRound className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalLicenses}</div>
            <p className="text-xs text-muted-foreground">Total licenses generated</p>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 md:gap-8 lg:grid-cols-3">
        <Card className="lg:col-span-2">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><BarChartIcon className="h-5 w-5" />New Licenses (Last 6 Months)</CardTitle>
            </CardHeader>
            <CardContent className="pl-2">
                <ChartContainer config={chartConfig} className="h-[250px] w-full">
                    <BarChart accessibilityLayer data={data.licenseChartData}>
                        <CartesianGrid vertical={false} />
                        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                        <YAxis tickLine={false} axisLine={false} tickMargin={8} allowDecimals={false} />
                        <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                        <Bar dataKey="count" fill="var(--color-count)" radius={4} />
                    </BarChart>
                </ChartContainer>
            </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center">
            <div className="grid gap-2">
              <CardTitle>Recent Payments</CardTitle>
              <CardDescription>A list of the most recent payments.</CardDescription>
            </div>
            <Button asChild size="sm" className="ml-auto gap-1">
              <Link href="/admin/payments">View All<ArrowUpRight className="h-4 w-4" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentPayments.length > 0 ? data.recentPayments.map((payment: any) => (
                  <TableRow key={payment.id}>
                    <TableCell>
                      <div className="font-medium">{payment.customerEmail}</div>
                    </TableCell>
                    <TableCell>{formatCurrency(payment.amount, payment.currency)}</TableCell>
                     <TableCell>{new Date(payment.createdAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center">No recent payments.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
