
"use client";

import { Product } from "@/lib/types";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { SlidersHorizontal, TriangleAlert } from "lucide-react";
import { useMemo } from "react";
import React from "react";
import { Badge } from "../ui/badge";

type ProductListItemProps = {
  product: Product;
  onItemClick?: (product: Product) => void;
  isSelected?: boolean;
  context?: "cashier" | "product" | "inventory";
  style?: React.CSSProperties;
  isEvent?: boolean;
};

const columnClass = {
  name: "flex items-center gap-2 flex-1 min-w-0 h-[54px]",
  category: "hidden md:flex items-center text-sm text-muted-foreground truncate max-w-[160px] w-[160px] px-2 border-l border-l-border/50 h-[54px]",
  stock: "hidden sm:flex items-center justify-end gap-1 text-sm tabular-nums shrink-0 w-20 border-l border-l-border/50 px-2 text-right h-[54px]",
  price: "flex items-center justify-end shrink-0 text-right tabular-nums whitespace-nowrap w-36 border-l border-l-border/50 h-[54px]"
}

export function ProductListItem({
  product,
  onItemClick,
  isSelected,
  context = "cashier",
  style,
  isEvent = false,
}: ProductListItemProps) {
  const { categories } = useStore();

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

  const handleSelect = () => {
    if (!isOutOfStock && onItemClick) {
      onItemClick(product);
    }
  };

  return (
    <>
      <div className={cn('bg-card h-[54px]')} >

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
            isOutOfStock && "opacity-60 cursor-not-allowed",
            !is_active && "opacity-80 relative"
          )}
        >
          {/* NAME SECTION */}
          <div className={columnClass.name}>
            <span className="font-medium truncate">
              {product.name}
            </span>

            {product.has_modifier && context === "product" && (
              <SlidersHorizontal className="h-3.5 w-3.5 text-primary shrink-0 ml-2" />
            )}
          </div>

          {
            !is_active && (
              <div className="absolute inset-0">
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
          {context !== "cashier" && product.track_stock && (
            <div
              className={cn(
                columnClass.stock,
                isLowStock || isOutOfStock
                  ? "text-destructive font-medium"
                  : "text-muted-foreground"
              )}
            >
              {isLowStock && <TriangleAlert className="h-3.5 w-3.5" />}
              {isOutOfStock ? 0 : product.stock}
            </div>
          )}

          {/* do not remove, filler to make table like list */}
          {context !== "cashier" && !product.track_stock && (
            <div className={columnClass.stock}>
              
            </div>
          )}


          {/* PRICE (ALWAYS VISIBLE) */}
          <div className={columnClass.price}>
            {formatCurrency(product.price)}
          </div>
        </div>
      </div>
    </>
  );
}