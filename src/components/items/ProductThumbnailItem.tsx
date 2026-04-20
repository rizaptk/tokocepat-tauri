import { Product } from "@/lib/types";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Badge } from "../ui/badge";
import { SlidersHorizontal, TriangleAlert } from "lucide-react";
import { useMemo, useRef, useEffect } from "react";
import React from "react";
import { Checkbox } from "../ui/checkbox";
import { useSelectedChecked } from "@/hooks/useDeferedCheck";
import { useActiveProduct } from "@/lib/product-active-store";

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

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);

    
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
      role="button"
      tabIndex={not_allowed ? -1 : 0}
      aria-disabled={not_allowed}
      className={cn(
        "group flex items-center gap-3 p-3 transition-colors duration-100 border border-border bg-card h-[78px] rounded-md",
        "hover:shadow-md",
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
      <div className="relative w-14 h-14 shrink-0 rounded-lg overflow-hidden border bg-muted">
        <img
          src={product.imageUrl}
          alt={product.name}
          className={cn("w-full h-full object-cover", isOutOfStock && "grayscale", !is_active && "grayscale")}
          loading="lazy"
        />
      
        {isOutOfStock && (
          <div className="absolute inset-0 bg-black/60 grid place-items-center text-sm font-semibold text-white text-center">
            Habis
          </div>
        )}

        {isLowStock && (
          <div className="absolute top-1 right-1">
            <TriangleAlert className="h-4 w-4 text-yellow-500 drop-shadow fill-yellow-500" />
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
          <p className="font-semibold text-base truncate">
            {product.name}
          </p>
          {product.has_modifier && context === "product" && (
            <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>

        {category && (
          <p className="text-sm text-muted-foreground/80 mt-0.5 truncate">
            {category.name}
          </p>
        )}
      </div>

      {/* Right Side (Price + Stock) */}
      <div className="flex flex-col items-end text-right">
        <p className="font-semibold text-base tabular-nums">
          {formatCurrency(product.price)}
        </p>

        {context !== "cashier" && product.track_stock && (
          <p
            className={cn(
              "text-sm tabular-nums mt-0.5",
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
