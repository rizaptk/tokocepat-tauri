import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function AdminPaymentsPage() {
  return (
    <>
      <div className="flex items-center">
        <h1 className="text-lg font-semibold md:text-2xl">Payments</h1>
      </div>
      <Card>
        <CardHeader>
            <CardTitle>Payment History</CardTitle>
            <CardDescription>A log of all payment transactions will be displayed here.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="border border-dashed rounded-lg p-8 text-center">
                <p className="text-muted-foreground">Payment data will appear here soon.</p>
            </div>
        </CardContent>
      </Card>
    </>
  );
}
