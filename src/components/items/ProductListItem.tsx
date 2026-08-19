import { Product } from "@/lib/types";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { TriangleAlert } from "lucide-react";
import { useMemo, useRef, useEffect, useCallback } from "react";
import React from "react";
import { Badge } from "../ui/badge";
import { Checkbox } from "../ui/checkbox";
import { useSelectedChecked } from "@/hooks/useDeferedCheck";
import { useActiveProduct } from "@/lib/product-active-store";
import { formatIDR as formatCurrency } from "@/lib/format";

type ProductListItemProps = {
  product: Product;
  onItemClick?: (product: Product) => void;
  isSelected?: boolean;
  context?: "cashier" | "product" | "inventory";
  style?: React.CSSProperties;
};

const columnClass = {
  checkbox: "flex items-center justify-center w-9 h-10",
  name: "flex items-center gap-2 flex-1 min-w-0 h-10",
  category: "hidden md:flex items-center text-sm opacity-70 truncate max-w-[160px] w-[160px] px-2 border-l border-l-border/50 h-10",
  stock: "hidden sm:flex items-center justify-end gap-1 text-sm tabular-nums shrink-0 w-20 border-l border-l-border/50 px-2 text-right h-10",
  price: "flex items-center justify-end shrink-0 text-right tabular-nums whitespace-nowrap w-28 border-l border-l-border/50 h-10"
}

export function ProductListItem({
  product,
  onItemClick,
  isSelected,
  context = "cashier",
  style,
}: ProductListItemProps) {
  const { categories, productVariants } = useStore();
  const [checked, toggleChecked] = useSelectedChecked(product.id);
  const itemRef = useRef<HTMLDivElement>(null);
  
  const { activeId, navigationSource, clearNavigationSource } = useActiveProduct();
  const isActive = activeId === product.id;

  useEffect(() => {
    if (isActive && navigationSource === 'keyboard') {
      itemRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      clearNavigationSource();
    }
  }, [isActive, navigationSource, clearNavigationSource]);
  
  const category = useMemo(
    () => categories.find((c) => c.id === product.category_id),
    [categories, product.category_id]
  );
  
  const totalVariantStock = useMemo(() => {
    if (!product.has_variant) return 0;
    return productVariants
      .filter(v => v.product_id === product.id)
      .reduce((sum, v) => sum + v.stock, 0);
  }, [productVariants, product.id, product.has_variant]);

    
    const isOutOfStock = product.has_variant ? totalVariantStock <= 0 : (product.track_stock && product.stock <= 0);
    const isLowStock = product.track_stock && product.low_stock_alert != null && product.stock > 0 && product.stock <= product.low_stock_alert;
    const is_active = product.is_active;
    const not_allowed = context === "cashier" && (isOutOfStock || !is_active);
    
    const handleSelect = useCallback(() => {
      if (!not_allowed && onItemClick) {
        onItemClick(product);
      }
    },[not_allowed, onItemClick, product])

  const stockDisplay = useMemo(() => {
    if (product.has_variant) return totalVariantStock;
    if (product.track_stock) return product.stock;
    return null;
  }, [product, totalVariantStock]);


  return (
      <div className={cn('bg-card h-10')} ref={itemRef}>
        <div
          style={style}
          onClick={handleSelect}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelect(); } }}
          role="button"
          tabIndex={not_allowed ? -1 : 0}
          aria-disabled={not_allowed}
          className={cn(
            "flex items-center px-3 gap-0 h-10 border-b-border border-x",
            "transition-colors",
            "hover:bg-accent",
            "active:ring-1 active:ring-inset active:ring-primary",
            isSelected && "bg-background",
            isActive && "bg-primary/10 text-primary ring-1 ring-inset ring-primary",
            not_allowed && "opacity-60 cursor-not-allowed",
            !is_active && "opacity-80 relative"
          )}
        >
          {/* NAME SECTION */}
          <div className={cn(columnClass.name, 'px-0')}>
            {/* CHECKBOX */}
            {context === 'product' && (
              <div className={cn(columnClass.checkbox,`${!!product.barcode ? '' : 'opacity-40! grayscale'}`)} onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  disabled={!product.barcode}
                  className={`rounded-none bg-card`}
                  checked={checked}
                  onCheckedChange={toggleChecked}
                />
              </div>
            )}
            <span className="font-medium truncate">
              {product.name}
              {product.brand && <span className="text-muted-foreground font-normal"> · {product.brand}</span>}
            </span>
          </div>

          {
            !is_active && (
              <div className="absolute inset-x-2 inset-y-0">
                <Badge variant="destructive" className="text-xs">
                  Nonaktif
                </Badge>
              </div>
            )
          }

          {/* CATEGORY (hide earlier on small screens) */}
          {category && (
            <span className={columnClass.category}>
              {category.name}
            </span>
          )}

          {/* STOCK */}
          {context !== "cashier" && (
            <div
              className={cn(
                columnClass.stock,
                (isLowStock && !product.has_variant) || (stockDisplay !== null && stockDisplay <= 0)
                  ? "text-destructive font-medium"
                  : "text-muted-foreground"
              )}
            >
              {isLowStock && !product.has_variant && <TriangleAlert className="h-3.5 w-3.5" />}
              {stockDisplay !== null ? stockDisplay : '-'}
            </div>
          )}


          {/* PRICE (ALWAYS VISIBLE) */}
          <div className={columnClass.price}>
            {formatCurrency(product.price)}
          </div>
        </div>
      </div>
  );
}
