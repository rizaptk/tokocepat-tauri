import Link from 'next/link';
import {
  ArrowUpRight,
  DollarSign,
  Users,
  KeyRound,
  BarChart2 as BarChartIcon,
} from 'lucide-react';
import { format } from 'date-fns';

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
import { db } from '@/lib/firebase-admin';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"


async function getDashboardData() {
  try {
    const licensesPromise = db.collection('licenses').orderBy('createdAt', 'asc').get();
    const customersPromise = db.collection('customers').count().get();
    const paymentsPromise = db.collection('payments').get();
    const recentPaymentsPromise = db.collection('payments').orderBy('createdAt', 'desc').limit(5).get();
    
    const [licensesSnapshot, customersSnapshot, paymentsSnapshot, recentPaymentsSnapshot] = await Promise.all([
        licensesPromise,
        customersPromise,
        paymentsPromise,
        recentPaymentsPromise,
    ]);

    const totalLicenses = licensesSnapshot.size;
    const totalCustomers = customersSnapshot.data().count;
    const totalRevenue = paymentsSnapshot.docs.reduce((sum, doc) => sum + (doc.data().amount || 0), 0);
    
    const recentPayments = recentPaymentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Aggregate license data for chart
    const monthlyLicenses = licensesSnapshot.docs.reduce((acc: { [key: string]: number }, doc) => {
        const createdAt = doc.data().createdAt.toDate();
        // Use 'yyyy-MM' for sorting, then format later for display
        const monthKey = format(createdAt, 'yyyy-MM');
        acc[monthKey] = (acc[monthKey] || 0) + 1;
        return acc;
    }, {});
    
    // Create a map of the last 6 months to ensure they are all present
    const last6Months = Array.from({ length: 6 }).map((_, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        return format(d, 'yyyy-MM');
    }).reverse();

    const licenseChartData = last6Months.map(monthKey => ({
        month: format(new Date(`${monthKey}-02`), 'MMM'), // Format to 'Jan', 'Feb' etc.
        count: monthlyLicenses[monthKey] || 0
    }));

    return {
        totalRevenue,
        totalCustomers,
        totalLicenses,
        recentPayments,
        licenseChartData,
    };

  } catch (error) {
    console.error("Failed to fetch dashboard data", error);
    return {
        totalRevenue: 0,
        totalCustomers: 0,
        totalLicenses: 0,
        recentPayments: [],
        licenseChartData: [],
        error: "Could not load dashboard data. Please ensure Firestore is enabled and permissions are set."
    }
  }
}

const formatCurrency = (amount: number, currency: string = 'IDR') => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
    }).format(amount);
};


export default async function AdminDashboard() {
  const data = await getDashboardData();
  
  if (data.error) {
     return (
        <div
        className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm"
      >
        <div className="flex flex-col items-center gap-2 text-center p-8">
          <h3 className="text-2xl font-bold tracking-tight text-destructive">
            Error Loading Dashboard
          </h3>
          <p className="text-muted-foreground">
            {data.error}
          </p>
        </div>
      </div>
     )
  }

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
            <CardTitle className="text-sm font-medium">
              Total Revenue
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">
              Based on all recorded payments
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Customers
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+{data.totalCustomers}</div>
             <p className="text-xs text-muted-foreground">
              Total unique customers
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Licenses</CardTitle>
            <KeyRound className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalLicenses}</div>
            <p className="text-xs text-muted-foreground">
              Total licenses generated
            </p>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 md:gap-8 lg:grid-cols-3">
        <Card className="lg:col-span-2">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <BarChartIcon className="h-5 w-5" />
                    New Licenses (Last 6 Months)
                </CardTitle>
            </CardHeader>
            <CardContent className="pl-2">
                <ChartContainer config={chartConfig} className="h-[250px] w-full">
                    <BarChart accessibilityLayer data={data.licenseChartData}>
                        <CartesianGrid vertical={false} />
                        <XAxis
                            dataKey="month"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                        />
                        <YAxis
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            allowDecimals={false}
                        />
                        <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent indicator="dot" />}
                        />
                        <Bar dataKey="count" fill="var(--color-count)" radius={4} />
                    </BarChart>
                </ChartContainer>
            </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center">
            <div className="grid gap-2">
              <CardTitle>Recent Payments</CardTitle>
              <CardDescription>
                A list of the most recent payments.
              </CardDescription>
            </div>
            <Button asChild size="sm" className="ml-auto gap-1">
              <Link href="/admin/payments">
                View All
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>
                    Amount
                  </TableHead>
                  <TableHead>
                    Date
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentPayments.length > 0 ? data.recentPayments.map((payment: any) => (
                  <TableRow key={payment.id}>
                    <TableCell>
                      <div className="font-medium">{payment.customerEmail}</div>
                    </TableCell>
                    <TableCell>
                        {formatCurrency(payment.amount, payment.currency)}
                    </TableCell>
                     <TableCell>
                      {new Date(payment.createdAt.toDate()).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center">
                      No recent payments.
                    </TableCell>
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
