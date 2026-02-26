import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function DeprecatedLoginPage() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-md">
            <CardHeader>
                <CardTitle>Page Moved</CardTitle>
                <CardDescription>
                    The login page has been moved to <code className="font-mono bg-muted p-1 rounded">/admin/login</code> to better separate the admin panel from the offline POS application.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Button asChild>
                    <Link href="/admin/login">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Go to Admin Login
                    </Link>
                </Button>
            </CardContent>
        </Card>
    </div>
  );
}
