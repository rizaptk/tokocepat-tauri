
"use client";

import Link from "next/link";
import { useStore } from "@/lib/store";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>All Products</CardTitle>
                <Button asChild size="sm">
                    <Link href="/product/new">
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Product
                    </Link>
                </Button>
            </CardHeader>
            <CardContent>
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
    )
}
