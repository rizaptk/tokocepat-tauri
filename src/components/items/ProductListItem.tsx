
// "use client";

// import { Product, Category } from '@/lib/types';
// import { useStore } from '@/lib/store';
// import { cn } from '@/lib/utils';
// import { Badge } from '../ui/badge';
// import { SlidersHorizontal, TriangleAlert } from 'lucide-react';
// import { useMemo } from 'react';
// import React from 'react';

// type ProductListItemProps = {
//   product: Product;
//   onItemClick?: (product: Product) => void;
//   isSelected?: boolean;
//   context?: 'cashier' | 'product' | 'inventory';
//   style?: React.CSSProperties;
// };

// export function ProductListItem({ product, onItemClick, isSelected, context = 'cashier', style }: ProductListItemProps) {
//   const { categories } = useStore();
//   const category = useMemo(() => categories.find(c => c.id === product.category_id), [categories, product.category_id]);
  
//   const formatCurrency = (amount: number) => {
//     return new Intl.NumberFormat('id-ID', {
//       style: 'currency',
//       currency: 'IDR',
//       minimumFractionDigits: 0,
//     }).format(amount);
//   };
  
//   const handleSelect = () => {
//     if (onItemClick) {
//       onItemClick(product);
//     }
//   }
  
//   const isOutOfStock = product.track_stock && product.stock <= 0;
//   const isLowStock = product.track_stock && product.low_stock_alert != null && product.stock > 0 && product.stock <= product.low_stock_alert;

//   return (
//     <div 
//       style={style}
//       className={cn(
//         "flex items-center gap-4 py-1 px-4 transition-colors h-full border-b bg-card",
//         isOutOfStock 
//             ? "bg-muted/50 cursor-not-allowed opacity-60" 
//             : "hover:bg-accent cursor-pointer",
//         isSelected && "ring-2 ring-inset ring-primary"
//       )}
//       onClick={!isOutOfStock ? handleSelect : undefined}
//       role="button"
//       tabIndex={isOutOfStock ? -1 : 0}
//       onKeyDown={(e) => !isOutOfStock && e.key === 'Enter' && handleSelect()}
//       aria-label={`Select ${product.name}`}
//       aria-disabled={isOutOfStock}
//     >
//         <div className="flex-1 space-y-1 flex items-center justify-between max-sm:flex-wrap">
//             <div className="flex items-center gap-2">
//                 <span className="font-medium">{product.name}</span>
//                 {product.has_modifier && context === 'product' && <SlidersHorizontal className="h-3 w-3 text-muted-foreground" />}
//             </div>
//             {category && <Badge variant="secondary" className="text-xs opacity-80">{category.name}</Badge>}
//         </div>

//         <div className="flex items-center gap-4">
//              {isLowStock && (
//                 <Badge variant="destructive" className="bg-yellow-500/80 text-black items-center gap-1">
//                     <TriangleAlert className="h-3 w-3" /> Low
//                 </Badge>
//              )}
//              {context !== 'cashier' && product.track_stock && (
//                 <Badge variant={isOutOfStock ? "destructive" : "default"}>
//                     {product.stock}
//                 </Badge>
//             )}
//             <span className="font-semibold text-foreground w-24 text-right">{formatCurrency(product.price)}</span>
//         </div>
//     </div>
//   );
// }

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
};

export function ProductListItem({
  product,
  onItemClick,
  isSelected,
  context = "cashier",
  style,
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
    <div
      style={style}
      onClick={handleSelect}
      role="button"
      tabIndex={isOutOfStock ? -1 : 0}
      aria-disabled={isOutOfStock}
      className={cn(
        "flex items-center px-4 gap-0 border border-transparent h-[54px] bg-card border-b-border",
        "transition-colors",
        "hover:bg-accent",
        isSelected && "border-primary",
        isOutOfStock && "opacity-60 cursor-not-allowed",
        !is_active && "opacity-80 relative"
      )}
    >
      {/* NAME SECTION */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
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
        <span className="hidden md:block text-sm text-muted-foreground truncate max-w-[160px] w-[160px] px-2 border-l py-0.5">
          {category.name}
        </span>
      )}

      {/* STOCK */}
      {context !== "cashier" && product.track_stock && (
        <div
          className={cn(
            "hidden sm:flex gap-1 text-sm tabular-nums shrink-0 w-20 border-l px-2 text-right py-0.5",
            isLowStock || isOutOfStock
              ? "text-destructive font-medium"
              : ""
          )}
        >
          {isLowStock && <TriangleAlert className="h-3.5 w-3.5" />}
          {isOutOfStock ? 0 : product.stock}
        </div>
      )}

      {/* do not remove, filler to make table like list */}
      {context !== "cashier" && !product.track_stock && (
        <div className="hidden sm:flex gap-1 text-sm tabular-nums shrink-0 w-20 border-l px-2 text-right py-0.5">
          
        </div>
      )}


      {/* PRICE (ALWAYS VISIBLE) */}
      <div className="shrink-0 text-right font-medium tabular-nums whitespace-nowrap w-32 border-l">
        {formatCurrency(product.price)}
      </div>
    </div>
  );
}