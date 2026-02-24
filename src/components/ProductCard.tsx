
"use client";

import Image from 'next/image';
import { Product } from '@/lib/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useStore } from '@/lib/store';
import { ShoppingCart } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type ProductCardProps = {
  product: Product;
  onItemAdded?: () => void;
};

export function ProductCard({ product, onItemAdded }: ProductCardProps) {
  const addToCart = useStore((state) => state.addToCart);
  const activeShift = useStore((state) => state.activeShift);
  const { toast } = useToast();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };
  
  const handleAddToCart = () => {
    if (!activeShift) {
      toast({
        variant: 'destructive',
        title: 'Shift Not Open',
        description: 'Please open a shift to start a sale.',
      });
      return;
    }
    addToCart(product);
    toast({
      title: "Added to cart",
      description: `${product.name} has been added to your cart.`,
    });
    if (onItemAdded) {
      onItemAdded();
    }
  }

  return (
    <Card 
      className="flex flex-col overflow-hidden transition-all hover:shadow-lg cursor-pointer"
      onClick={handleAddToCart}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleAddToCart()}
      aria-label={`Add ${product.name} to cart`}
    >
      <CardHeader className="p-0">
        <div className="relative aspect-square w-full">
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
            className="object-cover"
            data-ai-hint={product.imageHint}
          />
           {product.stock <= 0 && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <p className="text-white font-bold">Out of Stock</p>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-grow p-4">
        <CardTitle className="text-base font-medium line-clamp-2">{product.name}</CardTitle>
      </CardContent>
      <CardFooter className="flex items-center justify-between p-4 pt-0">
        <p className="font-semibold text-foreground">{formatCurrency(product.price)}</p>
        <Button 
            size="icon" 
            variant="ghost" 
            className="h-8 w-8 rounded-full" 
            disabled={product.stock <= 0}
        >
          <ShoppingCart className="h-5 w-5 text-primary" />
        </Button>
      </CardFooter>
    </Card>
  );
}
