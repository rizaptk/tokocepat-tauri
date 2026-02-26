import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function AdminCustomersPage() {
  return (
    <>
      <div className="flex items-center">
        <h1 className="text-lg font-semibold md:text-2xl">Customers</h1>
      </div>
      <Card>
        <CardHeader>
            <CardTitle>Customer Management</CardTitle>
            <CardDescription>A list of all customers will be displayed here.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="border border-dashed rounded-lg p-8 text-center">
                <p className="text-muted-foreground">Customer data will appear here soon.</p>
            </div>
        </CardContent>
      </Card>
    </>
  );
}
