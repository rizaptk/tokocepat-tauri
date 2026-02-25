
"use client";

import Image from 'next/image';
import { Product, Category } from '@/lib/types';
import { useStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { Badge } from '../ui/badge';
import { SlidersHorizontal, TriangleAlert } from 'lucide-react';
import { useMemo } from 'react';
import React from 'react';

type ProductThumbnailItemProps = {
  product: Product;
  onItemClick?: (product: Product) => void;
  isSelected?: boolean;
  context?: 'cashier' | 'product' | 'inventory';
  style?: React.CSSProperties;
};

export function ProductThumbnailItem({ product, onItemClick, isSelected, context = 'cashier', style }: ProductThumbnailItemProps) {
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
    <div 
      style={style}
      className={cn(
        "flex items-center gap-2 p-2 rounded-none transition-colors",
        isOutOfStock 
            ? "bg-card cursor-not-allowed opacity-60" 
            : "bg-card hover:bg-accent cursor-pointer",
        isSelected && "ring-2 ring-inset ring-primary"
      )}
      onClick={!isOutOfStock ? handleSelect : undefined}
      role="button"
      tabIndex={isOutOfStock ? -1 : 0}
      onKeyDown={(e) => !isOutOfStock && e.key === 'Enter' && handleSelect()}
      aria-label={`Select ${product.name}`}
      aria-disabled={isOutOfStock}
    >
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md">
            <Image
                src={product.imageUrl}
                alt={product.name}
                fill
                sizes="64px"
                className={cn("object-cover", isOutOfStock && "grayscale")}
                data-ai-hint={product.imageHint}
            />
             {isOutOfStock && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <Badge variant="destructive">Sold Out</Badge>
                </div>
            )}
             {isLowStock && (
                <div className="absolute top-1 right-1">
                    <Badge variant="destructive" className="bg-yellow-500/80 text-black items-center p-1 h-5 w-5 justify-center">
                        <TriangleAlert className="h-3 w-3" />
                    </Badge>
                </div>
            )}
        </div>
        <div className="flex-1 space-y-1 flex items-center flex-wrap justify-between px-2 grow">
            <p className="font-medium line-clamp-2 flex items-center gap-2">
                {product.name}
                {product.has_modifier && context === 'product' && <SlidersHorizontal className="h-3 w-3 text-muted-foreground" />}
            </p>
            <div className="flex items-center gap-2 justify-between w-full">
                {category && <Badge variant="secondary" className="text-xs opacity-80">{category.name}</Badge>}
                <p className="font-semibold text-sm text-foreground">{formatCurrency(product.price)}</p>
            </div>
        </div>
        {context !== 'cashier' && product.track_stock && (
            <div className="text-right">
                <p className={cn("text-lg font-bold", isLowStock || isOutOfStock ? "text-destructive" : "text-foreground")}>
                    {product.stock}
                </p>
                <p className="text-xs text-muted-foreground">in stock</p>
            </div>
        )}
    </div>
  );
}
