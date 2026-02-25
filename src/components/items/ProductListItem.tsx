
"use client";

import { Product, Category } from '@/lib/types';
import { useStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { Badge } from '../ui/badge';
import { SlidersHorizontal, TriangleAlert } from 'lucide-react';
import { useMemo } from 'react';
import React from 'react';

type ProductListItemProps = {
  product: Product;
  onItemClick?: (product: Product) => void;
  isSelected?: boolean;
  context?: 'cashier' | 'product' | 'inventory';
  style?: React.CSSProperties;
};

export function ProductListItem({ product, onItemClick, isSelected, context = 'cashier', style }: ProductListItemProps) {
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
        "flex items-center gap-4 p-2 transition-colors h-full border-b",
        isOutOfStock 
            ? "bg-muted/50 cursor-not-allowed opacity-60" 
            : "hover:bg-accent cursor-pointer",
        isSelected && "ring-2 ring-inset ring-primary"
      )}
      onClick={!isOutOfStock ? handleSelect : undefined}
      role="button"
      tabIndex={isOutOfStock ? -1 : 0}
      onKeyDown={(e) => !isOutOfStock && e.key === 'Enter' && handleSelect()}
      aria-label={`Select ${product.name}`}
      aria-disabled={isOutOfStock}
    >
        <div className="flex-1 space-y-1 flex items-center justify-between max-sm:flex-wrap">
            <div className="flex items-center gap-2">
                <span className="font-medium">{product.name}</span>
                {product.has_modifier && context === 'product' && <SlidersHorizontal className="h-3 w-3 text-muted-foreground" />}
            </div>
            {category && <Badge variant="secondary" className="text-xs opacity-80">{category.name}</Badge>}
        </div>

        <div className="flex items-center gap-4">
             {isLowStock && (
                <Badge variant="destructive" className="bg-yellow-500/80 text-black items-center gap-1">
                    <TriangleAlert className="h-3 w-3" /> Low
                </Badge>
             )}
             {context !== 'cashier' && product.track_stock && (
                <Badge variant={isOutOfStock ? "destructive" : "secondary"}>
                    {product.stock} in stock
                </Badge>
            )}
            <span className="font-semibold text-foreground w-24 text-right">{formatCurrency(product.price)}</span>
        </div>
    </div>
  );
}
