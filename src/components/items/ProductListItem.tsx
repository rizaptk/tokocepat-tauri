

import { Product } from "@/lib/types";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { SlidersHorizontal, TriangleAlert } from "lucide-react";
import { useMemo, useRef, useEffect } from "react";
import React from "react";
import { Badge } from "../ui/badge";
import { Checkbox } from "../ui/checkbox";
import { useSelectedChecked } from "@/hooks/useDeferedCheck";
import { useActiveProduct } from "@/lib/product-active-store";

type ProductListItemProps = {
  product: Product;
  onItemClick?: (product: Product) => void;
  isSelected?: boolean;
  context?: "cashier" | "product" | "inventory";
  style?: React.CSSProperties;
  isEvent?: boolean;
};

const columnClass = {
  checkbox: "flex items-center justify-center w-9 h-[54px]",
  name: "flex items-center gap-2 flex-1 min-w-0 h-[54px]",
  category: "hidden md:flex items-center text-sm opacity-70 truncate max-w-[160px] w-[160px] px-2 border-l border-l-border/50 h-[54px]",
  stock: "hidden sm:flex items-center justify-end gap-1 text-sm tabular-nums shrink-0 w-20 border-l border-l-border/50 px-2 text-right h-[54px]",
  price: "flex items-center justify-end shrink-0 text-right tabular-nums whitespace-nowrap w-36 border-l border-l-border/50 h-[54px]"
}

export function ProductListItem({
  product,
  onItemClick,
  isSelected,
  context = "cashier",
  style,
  isEvent = false
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


  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);

  const handleSelect = () => {
    if (!isOutOfStock && onItemClick) {
      onItemClick(product);
    }
  };

  const isOutOfStock = product.has_variant ? totalVariantStock <= 0 : (product.track_stock && product.stock <= 0);
  const isLowStock = product.track_stock && product.low_stock_alert != null && product.stock > 0 && product.stock <= product.low_stock_alert;
  const is_active = product.is_active;

  const stockDisplay = useMemo(() => {
    if (product.has_variant) return totalVariantStock;
    if (product.track_stock) return product.stock;
    return null;
  }, [product, totalVariantStock]);


  return (
      <div className={cn('bg-card h-[54px]')} ref={itemRef}>
        <div
          style={style}
          onClick={handleSelect}
          role="button"
          tabIndex={isOutOfStock ? -1 : 0}
          aria-disabled={isOutOfStock}
          className={cn(
            "flex items-center px-4 gap-0 h-[54px] border-b-border border-x",
            "transition-colors",
            "hover:bg-accent",
            isEvent && 'bg-primary/5',
            isSelected && "bg-background",
            isActive && "bg-primary/10 text-primary ring-1 ring-inset ring-primary",
            isOutOfStock && "opacity-60 cursor-not-allowed",
            !is_active && "opacity-80 relative"
          )}
        >
          {/* NAME SECTION */}
          <div className={cn(columnClass.name, 'px-0')}>
            {/* CHECKBOX */}
            {context === 'product' && (
              <div className={cn(columnClass.checkbox,`${!!product.barcode ? '' : '!opacity-40 grayscale'}`)} onClick={(e) => e.stopPropagation()}>
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
            </span>

            {product.has_modifier && context === "product" && (
              <SlidersHorizontal className="h-3.5 w-3.5 text-primary shrink-0 ml-2" />
            )}
          </div>

          {
            !is_active && (
              <div className="absolute inset-x-2 inset-y-0">
                <Badge variant="destructive" className="text-xs">
                  Inactive
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
