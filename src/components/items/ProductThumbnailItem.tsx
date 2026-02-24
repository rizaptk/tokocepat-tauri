
"use client";

import Image from 'next/image';
import { Product } from '@/lib/types';
import { useStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Badge } from '../ui/badge';

type ProductThumbnailItemProps = {
  product: Product;
  onItemAdded?: () => void;
};

export function ProductThumbnailItem({ product, onItemAdded }: ProductThumbnailItemProps) {
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

  const isOutOfStock = product.track_stock && product.stock <= 0;

  return (
    <div 
      className={cn(
        "flex items-center gap-4 p-2 rounded-lg transition-colors",
        isOutOfStock 
            ? "bg-card cursor-not-allowed opacity-60" 
            : "bg-card hover:bg-accent cursor-pointer"
      )}
      onClick={!isOutOfStock ? handleAddToCart : undefined}
      role="button"
      tabIndex={isOutOfStock ? -1 : 0}
      onKeyDown={(e) => !isOutOfStock && e.key === 'Enter' && handleAddToCart()}
      aria-label={`Add ${product.name} to cart`}
      aria-disabled={isOutOfStock}
    >
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md">
            <Image
                src={product.imageUrl}
                alt={product.name}
                fill
                sizes="64px"
                className="object-cover"
                data-ai-hint={product.imageHint}
            />
             {isOutOfStock && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <Badge variant="destructive">Sold Out</Badge>
                </div>
            )}
        </div>
        <div className="flex-1">
            <p className="font-medium line-clamp-2">{product.name}</p>
            <p className="font-semibold text-sm text-foreground">{formatCurrency(product.price)}</p>
        </div>
        {product.track_stock && (
            <div className="text-right">
                <p className={cn("text-sm font-medium", product.stock < (product.low_stock_alert || 10) ? "text-destructive" : "text-muted-foreground")}>
                    {product.stock}
                </p>
                <p className="text-xs text-muted-foreground">in stock</p>
            </div>
        )}
    </div>
  );
}
