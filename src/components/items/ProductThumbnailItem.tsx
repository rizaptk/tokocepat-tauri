import { Product } from "@/lib/types";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Badge } from "../ui/badge";
import { TriangleAlert } from "lucide-react";
import { useMemo, useRef, useEffect } from "react";
import React from "react";
import { Checkbox } from "../ui/checkbox";
import { useSelectedChecked } from "@/hooks/useDeferedCheck";
import { useActiveProduct } from "@/lib/product-active-store";
import { formatIDR as formatCurrency } from "@/lib/format";

type ProductThumbnailItemProps = {
  product: Product;
  onItemClick?: (product: Product) => void;
  isSelected?: boolean;
  context?: "cashier" | "product" | "inventory";
  style?: React.CSSProperties;
};

export function ProductThumbnailItem({
  product,
  onItemClick,
  isSelected,
  context = "cashier",
  style,
}: ProductThumbnailItemProps) {
  const { categories } = useStore();
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

  // Images are optional and only shown in the product form; list/card views use
  // a lightweight letter tile so rendering stays fast with large catalogs.
  const tint = useMemo(() => {
    let h = 0;
    for (let i = 0; i < product.name.length; i++) h = (h * 31 + product.name.charCodeAt(i)) % 360;
    return h;
  }, [product.name]);

    
    const isOutOfStock = product.track_stock && product.stock <= 0;
    const isLowStock =
    product.track_stock &&
    product.low_stock_alert != null &&
    product.stock > 0 &&
    product.stock <= product.low_stock_alert;
    const is_active = product.is_active;
    const not_allowed = context === "cashier" && (isOutOfStock || !is_active);
    
    const handleSelect = () => {
      if (!not_allowed && onItemClick) {
        onItemClick(product);
      }
    };

  return (
    <div
      ref={itemRef}
      style={style}
      onClick={handleSelect}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelect(); } }}
      role="button"
      tabIndex={not_allowed ? -1 : 0}
      aria-disabled={not_allowed}
      className={cn(
        "group flex items-center gap-3 px-3 py-1.5 transition-colors duration-100 border border-border bg-card h-16 rounded-md",
        "hover:border-primary/30",
        "active:ring-1 active:ring-inset active:ring-primary",
        isSelected && "bg-background",
        isActive && "ring-1 ring-primary ring-inset text-primary bg-primary/5",
        not_allowed && "opacity-60 cursor-not-allowed",
        !is_active && "opacity-80 relative"
      )}
    >
      {/* CHECKBOX */}
      {context === 'product' && (
        <div className={cn('flex items-center justify-center',`${!!product.barcode ? '' : 'opacity-20! grayscale pointer-events-none'}`)} onClick={(e) => e.stopPropagation()}>
            <Checkbox className="rounded-none bg-card" checked={checked} onCheckedChange={toggleChecked} />
        </div>
      )}

      {/* Thumbnail */}
      <div className="relative w-10 h-10 shrink-0 rounded-md overflow-hidden border bg-muted">
        <div
          className="w-full h-full grid place-items-center"
          style={{ background: `linear-gradient(135deg, hsl(${tint} 60% 92%), hsl(${tint} 55% 84%))` }}
        >
          <span className="text-base font-black text-primary/70 select-none">
            {product.name.trim().charAt(0).toUpperCase()}
          </span>
        </div>

        {isOutOfStock && (
          <div className="absolute inset-0 bg-black/60 grid place-items-center text-[10px] font-semibold text-white text-center">
            Habis
          </div>
        )}

        {isLowStock && (
          <div className="absolute top-1 right-1">
            <TriangleAlert className="h-3.5 w-3.5 text-yellow-500 drop-shadow fill-yellow-500" />
          </div>
        )}
      </div>

      {!is_active && (
        <div className="absolute inset-x-2 inset-y-0">
          <Badge variant="destructive" className="text-xs">
            Nonaktif
          </Badge>
        </div>
      )}

      {/* Middle Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm truncate">
            {product.name}
            {product.brand && <span className="text-muted-foreground font-normal"> · {product.brand}</span>}
          </p>
        </div>

        {category && (
          <p className="text-xs text-muted-foreground/80 mt-0.5 truncate">
            {category.name}
          </p>
        )}
      </div>

      {/* Right Side (Price + Stock) */}
      <div className="flex flex-col items-end text-right shrink-0">
        <p className="font-semibold text-sm tabular-nums">
          {formatCurrency(product.price)}
        </p>

        {context !== "cashier" && product.track_stock && (
          <p
            className={cn(
              "text-xs tabular-nums mt-0.5",
              isLowStock || isOutOfStock
                ? "text-destructive font-medium"
                : "text-muted-foreground"
            )}
          >
            Stok {product.stock}
          </p>
        )}
      </div>
    </div>
  );
}
