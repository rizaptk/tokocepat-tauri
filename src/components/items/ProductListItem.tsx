
"use client";

import { Product } from '@/lib/types';
import { cn } from '@/lib/utils';

type ProductListItemProps = {
  product: Product;
  onItemAdded?: (product: Product) => void;
};

export function ProductListItem({ product, onItemAdded }: ProductListItemProps) {

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };
  
  const handleSelect = () => {
    if (onItemAdded) {
      onItemAdded(product);
    }
  }
  
  const isOutOfStock = product.track_stock && product.stock <= 0;

  return (
    <div 
      className={cn(
        "flex items-center justify-between p-3 transition-colors",
        isOutOfStock 
            ? "bg-muted/50 cursor-not-allowed opacity-60" 
            : "hover:bg-accent cursor-pointer"
      )}
      onClick={!isOutOfStock ? handleSelect : undefined}
      role="button"
      tabIndex={isOutOfStock ? -1 : 0}
      onKeyDown={(e) => !isOutOfStock && e.key === 'Enter' && handleSelect()}
      aria-label={`Add ${product.name} to cart`}
      aria-disabled={isOutOfStock}
    >
      <span className="font-medium">{product.name}</span>
      <span className="font-semibold text-foreground">{formatCurrency(product.price)}</span>
    </div>
  );
}
