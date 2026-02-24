
import { TokoCepatLogo } from "@/components/TokoCepatLogo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LayoutDashboard, ShoppingCart } from "lucide-react";
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-muted/40 p-4">
      <div className="flex flex-col items-center gap-6">
        <TokoCepatLogo />
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Welcome to TokoCepat</CardTitle>
            <CardDescription>Your fast and reliable point-of-sale solution.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Button asChild size="lg">
              <Link href="/cashier">
                <ShoppingCart className="mr-2" />
                Go to Cashier
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/dashboard">
                <LayoutDashboard className="mr-2" />
                Go to Dashboard
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
