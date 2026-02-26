import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function AdminLicensesPage() {
  return (
    <>
      <div className="flex items-center">
        <h1 className="text-lg font-semibold md:text-2xl">Licenses</h1>
      </div>
      <Card>
        <CardHeader>
            <CardTitle>License Management</CardTitle>
            <CardDescription>A list of all licenses will be displayed here.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="border border-dashed rounded-lg p-8 text-center">
                <p className="text-muted-foreground">License data will appear here soon.</p>
            </div>
        </CardContent>
      </Card>
    </>
  );
}
