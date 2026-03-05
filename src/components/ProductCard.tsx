
"use client";

import Image from 'next/image';
import { Product } from '@/lib/types';
import { useStore } from '@/lib/store';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, SlidersHorizontal, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';
import React, { useEffect, useRef } from 'react';
import { Checkbox } from './ui/checkbox';
import { useSelectedChecked } from '@/hooks/useDeferedCheck';
import { useActiveProduct } from '@/lib/product-active-store';

type ProductCardProps = {
  product: Product;
  onItemClick?: (product: Product) => void;
  isSelected?: boolean;
  context?: 'cashier' | 'product' | 'inventory';
  style?: React.CSSProperties;
};

export function ProductCard({ product, onItemClick, isSelected, context = 'cashier', style }: ProductCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const { categories } = useStore();
  const category = useMemo(() => categories.find(c => c.id === product.category_id), [categories, product.category_id]);

  const [checked, toggleChecked] = useSelectedChecked(product.id);
  const { activeId } = useActiveProduct();

  const arrowActive = activeId === product.id;

  useEffect(() => {
    if (arrowActive && cardRef.current) {
      cardRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [arrowActive]);

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
  const is_active = product.is_active;

  // const isChecked = selectedProductIds?.has(product.id) ?? false;

  return (
    <Card 
      ref={cardRef}
      style={style}
      className={cn(
        "flex flex-col h-full overflow-hidden transition-all hover:shadow-lg relative",
        isSelected && "ring-2 ring-primary ring-offset-2",
        isOutOfStock ? "cursor-not-allowed" : "cursor-pointer",
        !is_active && "opacity-80",
        arrowActive && "ring-4 ring-primary ring-offset-2 shadow-lg"

      )}
      onClick={!isOutOfStock ? handleSelect : undefined}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => !isOutOfStock && e.key === 'Enter' && handleSelect()}
      aria-label={`Select ${product.name}`}
      aria-disabled={isOutOfStock}
    >
      {context === 'product' &&  product.barcode && (
        <div className="absolute top-2 left-2 z-20 p-1 bg-background/50 backdrop-blur-sm rounded-sm size-8 grid place-items-center" onClick={(e) => e.stopPropagation()}>
            <Checkbox className='rounded-none bg-card' checked={checked} onCheckedChange={toggleChecked} />
        </div>
      )}

      <CardHeader className="p-0 relative">
        <div className="relative sm:aspect-[5/3] aspec-[4/3] w-full">
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
            className={cn("object-cover", isOutOfStock && "grayscale", !is_active && "grayscale")}
            data-ai-hint={product.imageHint}
          />
          {
            !is_active && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <Badge variant="destructive" className="text-sm">Inactive</Badge>
              </div>
            )
          }
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
      <CardContent className="p-4 space-y-1.5">
        <CardTitle className="text-base font-medium line-clamp-2">{product.name}</CardTitle>
      </CardContent>
      <CardFooter className="flex items-center justify-between p-4 pt-0 mt-auto">
        <p className="font-semibold text-foreground">{formatCurrency(product.price)}</p>
      </CardFooter>
    </Card>
  );
}
