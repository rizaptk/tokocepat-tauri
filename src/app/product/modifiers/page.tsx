
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function MovedPage() {
  return (
    <div className="flex flex-1 items-center justify-center">
        <Card className="w-full max-w-md">
            <CardHeader>
                <CardTitle>Page Moved</CardTitle>
                <CardDescription>This functionality has been integrated into the main Products page.</CardDescription>
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
