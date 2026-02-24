
"use client";

import Image from 'next/image';
import { Product } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Badge } from '../ui/badge';

type ProductThumbnailItemProps = {
  product: Product;
  onItemClick?: (product: Product) => void;
  isSelected?: boolean;
};

export function ProductThumbnailItem({ product, onItemClick, isSelected }: ProductThumbnailItemProps) {

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };
  
  const handleSelect = () => {
    if (onItemClick) {
      onItemClick(product);
    }
  }

  const isOutOfStock = product.track_stock && product.stock <= 0;

  return (
    <div 
      className={cn(
        "flex items-center gap-4 p-2 rounded-lg transition-colors",
        isOutOfStock 
            ? "bg-card cursor-not-allowed opacity-60" 
            : "bg-card hover:bg-accent cursor-pointer",
        isSelected && "bg-accent"
      )}
      onClick={!isOutOfStock ? handleSelect : undefined}
      role="button"
      tabIndex={isOutOfStock ? -1 : 0}
      onKeyDown={(e) => !isOutOfStock && e.key === 'Enter' && handleSelect()}
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
