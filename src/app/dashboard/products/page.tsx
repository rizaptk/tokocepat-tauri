
"use client";

import Link from "next/link";
import { useStore } from "@/lib/store";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TokoCepatLogo } from "@/components/TokoCepatLogo";
import { Button } from "@/components/ui/button";
import { Library, PlusCircle, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DashboardPageHeader } from "@/components/DashboardPageHeader";

export default function ProductsManagementPage() {
    const products = useStore((state) => state.products);
    
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('id-ID', {
          style: 'currency',
          currency: 'IDR',
          minimumFractionDigits: 0,
        }).format(amount);
      };

    return (
        <div className="flex min-h-screen w-full flex-col bg-muted/40">
           <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
              <Link href="/">
                <TokoCepatLogo />
              </Link>
           </header>
          <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
            <DashboardPageHeader
                title="Stock & Product Management"
                description="Here you can manage products, categories, modifiers, and view stock levels."
            >
                <Button variant="outline" asChild>
                    <Link href="/dashboard/categories">
                        <Library className="mr-2 h-4 w-4" /> Manage Categories
                    </Link>
                </Button>
                <Button variant="outline" asChild>
                    <Link href="/dashboard/modifiers">
                        <SlidersHorizontal className="mr-2 h-4 w-4" /> Manage Modifiers
                    </Link>
                </Button>
                <Button asChild>
                    <Link href="/dashboard/products/new">
                        <PlusCircle className="mr-2 h-4 w-4" /> Add New Product
                    </Link>
                </Button>
            </DashboardPageHeader>
            <Card>
                <CardContent className="p-6">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Product Name</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Price</TableHead>
                                <TableHead className="text-right">Stock</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {products.map(product => (
                                <TableRow key={product.id}>
                                    <TableCell className="font-medium">{product.name}</TableCell>
                                    <TableCell>
                                        <Badge variant={product.is_active ? "default" : "outline"}>
                                            {product.is_active ? "Active" : "Inactive"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>{formatCurrency(product.price)}</TableCell>
                                    <TableCell className={`text-right font-medium ${product.stock < 10 && product.track_stock ? 'text-destructive' : ''}`}>
                                        {product.track_stock ? product.stock : 'Untracked'}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
                 <CardFooter>
                    <div className="text-xs text-muted-foreground">
                        Showing <strong>{products.length}</strong> products
                    </div>
                </CardFooter>
            </Card>
          </main>
        </div>
    )
}
