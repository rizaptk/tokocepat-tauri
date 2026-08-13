import { Product } from '@/lib/types';
import { formatIDR as formatCurrency } from "@/lib/format";
import { useStore } from '@/lib/store';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Layers2, ShoppingCart, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMemo, useEffect, useRef } from 'react';
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
  const { categories, productVariants } = useStore();
  
  const category = useMemo(() => categories.find(c => c.id === product.category_id), [categories, product.category_id]);
  const variants = useMemo(() => product.has_variant ? productVariants.filter(v => v.product_id === product.id) : [], [productVariants, product.id, product.has_variant]);
  
  const totalVariantStock = useMemo(() => {
    if (!product.has_variant) return 0;
    return variants.reduce((sum, v) => sum + v.stock, 0);
  }, [variants, product.has_variant]);

  // Images are optional and only shown in the product form; lists/cards use a
  // lightweight letter tile so rendering stays fast with large catalogs.
  const tint = useMemo(() => {
    let h = 0;
    for (let i = 0; i < product.name.length; i++) h = (h * 31 + product.name.charCodeAt(i)) % 360;
    return h;
  }, [product.name]);


  const { activeId, navigationSource, clearNavigationSource } = useActiveProduct();
  const isActive = activeId === product.id;

  const [checked, toggleChecked] = useSelectedChecked(product.id);

  useEffect(() => {
    if (isActive && navigationSource === 'keyboard') {
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      clearNavigationSource();
    }
  }, [isActive, navigationSource, clearNavigationSource]);

  
  
  const handleSelect = () => {
    if (onItemClick) {
      onItemClick(product);
    }
  }

  const isOutOfStock = product.has_variant ? totalVariantStock <= 0 : (product.track_stock && product.stock <= 0);
  const isLowStock = product.track_stock && product.low_stock_alert != null && product.stock > 0 && product.stock <= product.low_stock_alert;
  const is_active = product.is_active;
  const not_allowed = context === "cashier" && (isOutOfStock || !is_active);


  return (
      <Card 
        ref={cardRef}
        style={style}
        className={cn(
          "flex flex-col h-full overflow-hidden transition-colors hover:border-primary/40 relative active:ring-2 active:ring-primary active:ring-offset-0 border border-border",
          isSelected && "ring-2 ring-primary ring-offset-2",
          not_allowed ? "cursor-not-allowed" : "cursor-pointer",
          !is_active && "opacity-80",
          isActive && "ring-2 ring-primary ring-offset-0"
        )}
        onClick={!not_allowed ? handleSelect : undefined}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => !not_allowed && e.key === 'Enter' && handleSelect()}
        aria-label={`Select ${product.name}`}
        aria-disabled={isOutOfStock}
      >
        {context === 'product' &&  product.barcode && (
          <div className="absolute top-2 right-2 z-20 p-1 bg-background/50 backdrop-blur-sm rounded-sm size-8 grid place-items-center" onClick={(e) => e.stopPropagation()}>
              <Checkbox className='rounded-none bg-card' checked={checked} onCheckedChange={toggleChecked} />
          </div>
        )}

        <CardHeader className="p-0 relative">
          <div className="relative sm:aspect-5/3 aspect-4/3 w-full bg-muted">
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, hsl(${tint} 60% 92%), hsl(${tint} 55% 84%))` }}
            >
              <span className="text-5xl font-black text-primary/70 select-none">
                {product.name.trim().charAt(0).toUpperCase()}
              </span>
            </div>
            {
              !is_active && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <Badge variant="destructive" className="text-sm">Nonaktif</Badge>
                </div>
              )
            }
            {isOutOfStock && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <Badge variant="destructive" className="text-sm">Stok Habis</Badge>
              </div>
            )}
            
            {product.has_variant && (
              <div className='absolute left-1 top-2 flex flex-col gap-1'>
                <Badge variant="secondary" className='bg-background/70 hover:bg-background backdrop-blur-md text-[10px] h-5 px-1.5 border-none ring-1 ring-border/60 flex gap-1 w-fit' title={'Varian'}>
                  <Layers2 className="h-3 w-3 text-primary" />
                  <span>{variants?.length} Varian</span>
                </Badge>
              </div>
            )}

            {context !== 'cashier' && (
              <Badge variant={isLowStock ? "destructive" : "secondary"} className='absolute bottom-2 left-2'>
                {product.has_variant ? `${totalVariantStock}` : (product.track_stock ? `${product.stock}` : 'Tanpa Stok')}
              </Badge>
            )}
            {category && <Badge variant="secondary" className='truncate text-xs absolute bottom-2 right-2 max-w-[70%]'>{category.name}</Badge>}
          </div>
          <div className="absolute top-2 right-1 z-10 flex gap-1">
              {isLowStock && (
                  <Badge variant="destructive" className="bg-yellow-500/80 text-black backdrop-blur-sm items-center">
                      <TriangleAlert className="h-3 w-3" />
                  </Badge>
              )}
          </div>
        </CardHeader>
        <CardContent className="p-4 space-y-1.5">
          <CardTitle className="text-base font-medium line-clamp-2">{product.name}</CardTitle>
          {product.brand && <p className="text-xs text-muted-foreground truncate">{product.brand}</p>}
        </CardContent>
        <CardFooter className="flex items-center justify-between p-4 pt-0 mt-auto">
          <span className="font-semibold text-foreground">{formatCurrency(product.price)}</span>
          {context === 'cashier' && (
              <div className="h-7 w-7 rounded-full border flex items-center justify-center bg-background">
                <ShoppingCart className="h-4 w-4 text-primary" />
              </div>)
            }
        </CardFooter>
      </Card>
  );
}
