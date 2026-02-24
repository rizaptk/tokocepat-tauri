import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { TokoCepatLogo } from "@/components/TokoCepatLogo";

export default function NewProductPage() {
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
                    <CardTitle>Add New Product</CardTitle>
                    <CardDescription>
                        Fill in the details to add a new product to your inventory.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p>This form is under construction.</p>
                </CardContent>
            </Card>
          </main>
        </div>
    )
}
