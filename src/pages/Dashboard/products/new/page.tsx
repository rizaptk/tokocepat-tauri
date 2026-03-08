
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function DeprecatedProductPage() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-md">
            <CardHeader>
                <CardTitle>Page Deprecated</CardTitle>
                <CardDescription>
                    This page is no longer in use. Please use the new unified product management interface.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Button asChild>
                    <Link href="/product">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Go to Products
                    </Link>
                </Button>
            </CardContent>
        </Card>
    </div>
  );
}
