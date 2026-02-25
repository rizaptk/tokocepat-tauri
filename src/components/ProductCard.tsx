
"use client";

import Image from 'next/image';
import { Product, Category } from '@/lib/types';
import { useStore } from '@/lib/store';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, SlidersHorizontal, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';
import React from 'react';

type ProductCardProps = {
  product: Product;
  onItemClick?: (product: Product) => void;
  isSelected?: boolean;
  context?: 'cashier' | 'product' | 'inventory';
  style?: React.CSSProperties;
};

export function ProductCard({ product, onItemClick, isSelected, context = 'cashier', style }: ProductCardProps) {
  const { categories } = useStore();
  const category = useMemo(() => categories.find(c => c.id === product.category_id), [categories, product.category_id]);

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
  const isLowStock = product.track_stock && product.low_stock_alert != null && product.stock > 0 && product.stock <= product.low_stock_alert;

  return (
    <Card 
      style={style}
      className={cn(
        "flex flex-col h-full overflow-hidden transition-all hover:shadow-lg",
        isSelected && "ring-2 ring-primary ring-offset-2",
        isOutOfStock ? "cursor-not-allowed" : "cursor-pointer",
      )}
      onClick={!isOutOfStock ? handleSelect : undefined}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => !isOutOfStock && e.key === 'Enter' && handleSelect()}
      aria-label={`Select ${product.name}`}
      aria-disabled={isOutOfStock}
    >
      <CardHeader className="p-0 relative">
        <div className="relative aspect-square w-full">
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
            className={cn("object-cover", isOutOfStock && "grayscale")}
            data-ai-hint={product.imageHint}
          />
           {isOutOfStock && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <Badge variant="destructive" className="text-sm">Out of Stock</Badge>
            </div>
          )}
          {context === 'cashier' && (
            <div className="h-7 w-7 rounded-full flex items-center justify-center bg-background absolute bottom-2 left-2">
                <ShoppingCart className="h-4 w-4 text-primary" />
            </div>)
          }
          {context !== 'cashier' && (
             <Badge variant={isLowStock ? "destructive" : "secondary"} className='absolute bottom-2 left-2'>
                {product.track_stock ? `${product.stock}` : 'Untracked'}
             </Badge>
          )}
          {category && <Badge variant="secondary" className='truncate text-xs absolute bottom-2 right-2 max-w-[70%]'>{category.name}</Badge>}
        </div>
        <div className="absolute top-2 right-2 z-10 flex gap-1">
            {product.has_modifier && context === 'product' && (
                <Badge variant="secondary" className="bg-black/50 text-white backdrop-blur-sm">
                    <SlidersHorizontal className="h-3 w-3" />
                </Badge>
            )}
            {isLowStock && (
                 <Badge variant="destructive" className="bg-yellow-500/80 text-black backdrop-blur-sm items-center">
                    <TriangleAlert className="h-3 w-3" />
                </Badge>
            )}
        </div>
      </CardHeader>
      <CardContent className="flex-grow p-4 space-y-1.5">
        <CardTitle className="text-base font-medium line-clamp-2">{product.name}</CardTitle>
      </CardContent>
      <CardFooter className="flex items-center justify-between p-4 pt-0">
        <p className="font-semibold text-foreground">{formatCurrency(product.price)}</p>
      </CardFooter>
    </Card>
  );
}
