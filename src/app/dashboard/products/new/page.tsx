
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { TokoCepatLogo } from "@/components/TokoCepatLogo";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { addProduct } from "@/services/productService";
import { ArrowLeft } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStore } from "@/lib/store";

// Schema for form validation
const productFormSchema = z.object({
  name: z.string().min(2, {
    message: "Product name must be at least 2 characters.",
  }),
  product_type: z.enum(["retail", "food_and_beverage"], {
    required_error: "You need to select a product type.",
  }),
  category_id: z.string().optional(),
  price: z.coerce.number().min(0, { message: "Price cannot be negative." }),
  cost_price: z.coerce.number().min(0, { message: "Cost price cannot be negative." }).optional(),
  stock: z.coerce.number().min(0, { message: "Stock cannot be negative." }),
  low_stock_alert: z.coerce.number().min(0, { message: "Low stock alert cannot be negative." }).optional(),
  track_stock: z.boolean().default(true),
  is_active: z.boolean().default(true),
  // Defaults for fields not yet in the form
  has_variant: z.boolean().default(false),
  has_modifier: z.boolean().default(false),
});

type ProductFormValues = z.infer<typeof productFormSchema>;

export default function NewProductPage() {
    const router = useRouter();
    const { toast } = useToast();
    const categories = useStore((state) => state.categories);

    const form = useForm<ProductFormValues>({
        resolver: zodResolver(productFormSchema),
        defaultValues: {
            name: "",
            product_type: "retail",
            price: 0,
            cost_price: 0,
            stock: 0,
            low_stock_alert: 0,
            track_stock: true,
            is_active: true,
            has_variant: false,
            has_modifier: false,
        },
    });

    async function onSubmit(data: ProductFormValues) {
        try {
            const newProduct = await addProduct(data);
            toast({
                title: "Product Created",
                description: `"${newProduct?.name}" has been successfully added.`,
            });
            router.push("/dashboard/products");
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error creating product",
                description: "There was a problem saving the new product.",
            });
            console.error(error);
        }
    }

    return (
        <div className="flex min-h-screen w-full flex-col bg-muted/40">
           <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
                <Button variant="outline" size="icon" asChild>
                    <Link href="/dashboard/products">
                        <ArrowLeft />
                    </Link>
                </Button>
              <TokoCepatLogo />
           </header>
          <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 items-center">
            <div className="w-full max-w-2xl">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                        <Card>
                            <CardHeader>
                                <CardTitle>Add New Product</CardTitle>
                                <CardDescription>
                                    Fill in the details to add a new product to your inventory.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <FormField
                                    control={form.control}
                                    name="product_type"
                                    render={({ field }) => (
                                        <FormItem className="space-y-3">
                                        <FormLabel>Product Type</FormLabel>
                                        <FormControl>
                                            <RadioGroup
                                            onValueChange={field.onChange}
                                            defaultValue={field.value}
                                            className="flex flex-col space-y-1"
                                            >
                                            <FormItem className="flex items-center space-x-3 space-y-0">
                                                <FormControl>
                                                <RadioGroupItem value="retail" />
                                                </FormControl>
                                                <FormLabel className="font-normal">
                                                Retail Product
                                                </FormLabel>
                                            </FormItem>
                                            <FormItem className="flex items-center space-x-3 space-y-0">
                                                <FormControl>
                                                <RadioGroupItem value="food_and_beverage" />
                                                </FormControl>
                                                <FormLabel className="font-normal">
                                                Food & Beverage
                                                </FormLabel>
                                            </FormItem>
                                            </RadioGroup>
                                        </FormControl>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Product Name</FormLabel>
                                            <FormControl>
                                                <Input placeholder="e.g. Cokelat Batang" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                
                                <FormField
                                    control={form.control}
                                    name="category_id"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Category</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a category" />
                                            </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                            {categories.map(cat => (
                                                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                            ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <FormField
                                        control={form.control}
                                        name="price"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Selling Price</FormLabel>
                                                <FormControl>
                                                     <div className="relative">
                                                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">Rp</span>
                                                        <Input type="number" placeholder="8000" className="pl-10" {...field} />
                                                    </div>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="cost_price"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Cost Price</FormLabel>
                                                <FormControl>
                                                     <div className="relative">
                                                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">Rp</span>
                                                        <Input type="number" placeholder="6500" className="pl-10" {...field} />
                                                    </div>
                                                </FormControl>
                                                 <FormDescription>
                                                    Used to calculate profit.
                                                </FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                             <CardHeader>
                                <CardTitle>Inventory</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <FormField
                                    control={form.control}
                                    name="track_stock"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                        <div className="space-y-0.5">
                                            <FormLabel className="text-base">Track Stock</FormLabel>
                                            <FormDescription>
                                            Automatically deduct stock for each sale of this item.
                                            </FormDescription>
                                        </div>
                                        <FormControl>
                                            <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                            />
                                        </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <FormField
                                        control={form.control}
                                        name="stock"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Stock Quantity</FormLabel>
                                                <FormControl>
                                                    <Input type="number" placeholder="50" {...field} disabled={!form.watch('track_stock')} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                     <FormField
                                        control={form.control}
                                        name="low_stock_alert"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Low Stock Alert</FormLabel>
                                                <FormControl>
                                                    <Input type="number" placeholder="10" {...field} disabled={!form.watch('track_stock')} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Availability</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <FormField
                                    control={form.control}
                                    name="is_active"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                        <div className="space-y-0.5">
                                            <FormLabel className="text-base">Product Active</FormLabel>
                                            <FormDescription>
                                             Allow this product to be sold in the cashier interface.
                                            </FormDescription>
                                        </div>
                                        <FormControl>
                                            <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                            />
                                        </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </CardContent>
                            <CardFooter className="flex justify-end gap-2">
                                <Button variant="outline" type="button" onClick={() => router.back()}>Cancel</Button>
                                <Button type="submit">Save Product</Button>
                            </CardFooter>
                        </Card>
                    </form>
                </Form>
            </div>
          </main>
        </div>
    )
}
