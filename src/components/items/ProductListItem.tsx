
"use client";

import { Product } from '@/lib/types';
import { useStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type ProductListItemProps = {
  product: Product;
  onItemAdded?: () => void;
};

export function ProductListItem({ product, onItemAdded }: ProductListItemProps) {
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
        "flex items-center justify-between p-3 transition-colors",
        isOutOfStock 
            ? "bg-muted/50 cursor-not-allowed opacity-60" 
            : "hover:bg-accent cursor-pointer"
      )}
      onClick={!isOutOfStock ? handleAddToCart : undefined}
      role="button"
      tabIndex={isOutOfStock ? -1 : 0}
      onKeyDown={(e) => !isOutOfStock && e.key === 'Enter' && handleAddToCart()}
      aria-label={`Add ${product.name} to cart`}
      aria-disabled={isOutOfStock}
    >
      <span className="font-medium">{product.name}</span>
      <span className="font-semibold text-foreground">{formatCurrency(product.price)}</span>
    </div>
  );
}
