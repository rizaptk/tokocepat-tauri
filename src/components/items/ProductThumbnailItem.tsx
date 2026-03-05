
"use client";

import Image from "next/image";
import { Product } from "@/lib/types";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Badge } from "../ui/badge";
import { SlidersHorizontal, TriangleAlert } from "lucide-react";
import { useMemo } from "react";
import React from "react";
import { Checkbox } from "../ui/checkbox";
import { useSelectedProduct } from "@/lib/product-select-store";
import { useSelectedChecked } from "@/hooks/useDeferedCheck";

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

  const handleSelect = () => {
    if (!isOutOfStock && onItemClick) {
      onItemClick(product);
    }
  };

  const isOutOfStock = product.track_stock && product.stock <= 0;
  const isLowStock =
    product.track_stock &&
    product.low_stock_alert != null &&
    product.stock > 0 &&
    product.stock <= product.low_stock_alert;
  const is_active = product.is_active;


  return (
    <div
      style={style}
      onClick={handleSelect}
      role="button"
      tabIndex={isOutOfStock ? -1 : 0}
      aria-disabled={isOutOfStock}
      className={cn(
        "group flex items-center gap-3 p-3 transition-colors duration-100 border border-border bg-card h-[78px] rounded-md",
        "hover:shadow-md",
        isSelected && "bg-background",
        isOutOfStock && "opacity-60 cursor-not-allowed",
        !is_active && "opacity-80 relative"
      )}
    >
      {/* CHECKBOX */}
      {context === 'product' && (
        <div className={cn('flex items-center justify-center',`${!!product.barcode ? '' : '!opacity-40 grayscale'}`)} onClick={(e) => e.stopPropagation()}>
            <Checkbox className="rounded-none bg-card" checked={checked} onCheckedChange={toggleChecked} />
        </div>
      )}

      {/* Thumbnail */}
      <div className="relative w-14 h-14 shrink-0 rounded-lg overflow-hidden border bg-muted">
        <Image
          src={product.imageUrl}
          alt={product.name}
          fill
          sizes="56px"
          className={cn("object-cover", isOutOfStock && "grayscale", !is_active && "grayscale")}
        />
      
        

        {isOutOfStock && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-sm font-semibold text-white">
            Sold Out
          </div>
        )}

        {isLowStock && (
          <div className="absolute top-1 right-1">
            <TriangleAlert className="h-4 w-4 text-yellow-500 drop-shadow" />
          </div>
        )}
      </div>

      {!is_active && (
        <div className="absolute inset-x-2 inset-y-0">
          <Badge variant="destructive" className="text-xs">
            Inactive
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
            Stock {product.stock}
          </p>
        )}
      </div>
    </div>
  );
}
