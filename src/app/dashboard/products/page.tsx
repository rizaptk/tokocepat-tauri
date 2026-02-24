import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { TokoCepatLogo } from "@/components/TokoCepatLogo";
import { Button } from "@/components/ui/button";

export default function ProductsManagementPage() {
    return (
        <div className="flex min-h-screen w-full flex-col bg-muted/40">
           <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
              <Link href="/">
                <TokoCepatLogo />
              </Link>
           </header>
          <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
            <Card>
                <CardHeader>
                    <CardTitle>Stock & Product Management</CardTitle>
                    <CardDescription>
                        Here you can manage products, categories, modifiers, and view stock levels.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
                        <p className="text-muted-foreground">This section is under construction.</p>
                        <Button asChild>
                            <Link href="/dashboard/products/new">Add New Product</Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>
          </main>
        </div>
    )
}
