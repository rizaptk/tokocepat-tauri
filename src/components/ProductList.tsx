
"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { Product } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { ProductCard } from '@/components/ProductCard';
import { ProductThumbnailItem } from './items/ProductThumbnailItem';
import { ProductListItem } from './items/ProductListItem';
import { useOverlayScrollbar } from '@/hooks/useScrollOverlay';
import { useProductSearch } from '@/lib/useProductSearch';
import { motion } from 'framer-motion';

type ViewMode = 'card' | 'thumbnail' | 'list';

const columnClass = {
  name: "flex items-center gap-2 flex-1 min-w-0 h-[54px]",
  category: "hidden md:flex items-center text-sm text-muted-foreground truncate max-w-[160px] w-[160px] px-2 border-l border-l-border/50 h-[54px]",
  stock: "hidden sm:flex items-center justify-end gap-1 text-sm tabular-nums shrink-0 w-20 border-l border-l-border/50 px-2 text-right h-[54px]",
  price: "flex items-center justify-end shrink-0 text-right tabular-nums whitespace-nowrap w-36 border-l border-l-border/50 h-[54px]"
}

type ProductListProps = {
  products: Product[];
  viewMode: ViewMode;
  isLoading?: boolean;
  onItemClick?: (product: Product) => void;
  selectedProductId?: string | null;
  context?: 'cashier' | 'product' | 'inventory';
  setScrollTop?: (top: number) => void;
};

// Constants for layout calculation
const CARD_MIN_WIDTH = 210;
const CARD_ROW_HEIGHT = 280;
const THUMBNAIL_ROW_HEIGHT = 82;
const LIST_ROW_HEIGHT = 56;

// --- Components for Card Grid View ---

// 1. Memoized item for performance. This is one cell in the grid.
const CardGridItem = React.memo(({ product, onItemClick, selectedProductId, context, columnCount }: { product: Product, onItemClick?: (product: Product) => void, selectedProductId?: string | null, context?: 'cashier' | 'product' | 'inventory', columnCount: number }) => {
  if (!product) return null;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      style={{ flex: `0 0 ${100 / columnCount}%`, padding: '12px', boxSizing: 'border-box', height: '100%' }}
    >
      <ProductCard
        product={product}
        onItemClick={onItemClick}
        isSelected={product.id === selectedProductId}
        context={context}
      />
    </motion.div>
  );
});
CardGridItem.displayName = 'CardGridItem';


// 2. The Row component that react-window will render.
const CardRow = ({ index, style, data }: { index: number, style: React.CSSProperties, data: any }) => {
  const { products, columnCount, totalItems, onItemClick, selectedProductId, context } = data;

  const itemsInRow = [];
  const startIndex = index * columnCount;

  for (let i = 0; i < columnCount; i++) {
    const itemIndex = startIndex + i;
    if (itemIndex < totalItems) {
      itemsInRow.push(
        <CardGridItem
          key={itemIndex}
          product={products[itemIndex]}
          onItemClick={onItemClick}
          selectedProductId={selectedProductId}
          context={context}
          columnCount={columnCount}
        />
      );
    }
  }

  return (
    <div style={{ ...style, display: 'flex' }} className='py-0 px-2 max-w-full'>
      {itemsInRow}
    </div>
  );
};

// --- Component for List/Thumbnail View ---

const ListItem = React.memo(({ index, style, data }: { index: number, style: React.CSSProperties, data: any }) => {
  const { products, viewMode, onItemClick, selectedProductId, context } = data;
  const product = products[index];

  const content = viewMode === 'thumbnail' ? (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      className="p-4 h-full"
    >
      <ProductThumbnailItem
        product={product}
        onItemClick={onItemClick}
        isSelected={product.id === selectedProductId}
        context={context}
      />
    </motion.div>
  ) : (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      className="h-full px-4"
    >
      <ProductListItem
        product={product}
        onItemClick={onItemClick}
        isSelected={product.id === selectedProductId}
        context={context}
      />
    </motion.div>
  );

  return <div style={style}>{content}</div>;
});
ListItem.displayName = 'ListItem';

// --- Loading Skeleton ---
const LoadingSkeleton = ({ viewMode }: { viewMode: ViewMode }) => {
  const itemCount = 12;
  if (viewMode === 'list' || viewMode === 'thumbnail') {
    return (
      <div className="flex flex-col gap-2 p-2">
        {Array.from({ length: itemCount }).map((_, index) => (
          <Skeleton key={index} className="h-20 w-full" />
        ))}
      </div>
    )
  }
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 p-4">
      {Array.from({ length: itemCount }).map((_, index) => (
        <div key={index} className="flex flex-col gap-2">
          <Skeleton className="aspect-square w-full rounded-lg" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-5 w-1/2" />
        </div>
      ))}
    </div>
  )
}

// --- Main ProductList Component ---
export function ProductList({ products, viewMode, isLoading, onItemClick, selectedProductId, context = 'cashier', setScrollTop }: ProductListProps) {

  const outerRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { query } = useProductSearch();

  const filteredProducts = useMemo(() => {
    if (query.length === 0) {
      return products.filter(p => p.is_active);
    }
    return products.filter(p =>
      p.is_active &&
      (p.name.toLowerCase().includes(query) || p.barcode?.includes(query))
    );
  }, [products, query]);

  const { subscribe, getScrollTop } = useOverlayScrollbar({
    outerRef, thumbRef, trackRef, containerRef, options: {
      autoHideDelay: 800,
      minThumbHeight: 24,
    }
  })

  const [isScrolling, setIsCrolling] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribe(() => {
      const scrolltop = getScrollTop();
      setIsCrolling(scrolltop > 0);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  if (isLoading) {
    return <div className="h-full w-full"><LoadingSkeleton viewMode={viewMode} /></div>;
  }

  if (filteredProducts.length === 0 && !isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-center">
        <div>
          <h2 className="text-xl font-semibold">No Products Found</h2>
          <p className="text-muted-foreground">Try adjusting your search term.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col relative">
      {
        viewMode == 'list' &&
        <div className='px-4'>
          <div className='flex w-full items-center h-[54px] border bg-card rounded-t-lg px-4'>
            <div className={columnClass.name}>
              <span className="font-medium shrink-1 text-base">Name</span>
            </div>
            <div className={columnClass.category}>
              <span className="text-base font-medium">Category</span>
            </div>
            {
              context !== 'cashier' &&
              <div className={columnClass.stock}>
                <span className="text-base font-medium">Stock</span>
              </div>
            }
            <div className={columnClass.price}>
              <span className="text-base font-medium">Price</span>
            </div>
          </div>
        </div>
      }
      <div className="relative flex-1 overflow-hidden" ref={containerRef}>
        <div className={`absolute top-0 h-0 transition-opacity duration-150 pointer-events-none shadow border-b left-1 right-1 z-10 ${isScrolling ? 'opacity-100' : 'opacity-0'}`}></div>
        <AutoSizer>
          {({ height, width }) => {
            if (!width || !height) return null;

            if (viewMode === 'card') {
              const columnCount = Math.max(2, Math.floor(width / CARD_MIN_WIDTH));
              const rowCount = Math.ceil(filteredProducts.length / columnCount);
              return (
                <List
                  height={height}
                  width={width}
                  itemCount={rowCount}
                  itemSize={CARD_ROW_HEIGHT}
                  className='no-scrollbar'
                  outerRef={outerRef}
                  itemData={{
                    products: filteredProducts,
                    columnCount,
                    totalItems: filteredProducts.length,
                    onItemClick,
                    selectedProductId,
                    context
                  }}
                >
                  {CardRow}
                </List>
              );
            } else { // 'list' or 'thumbnail'
              const itemHeight = viewMode === 'list' ? LIST_ROW_HEIGHT : THUMBNAIL_ROW_HEIGHT;
              return (
                <List
                  height={height}
                  width={width}
                  itemCount={filteredProducts.length}
                  itemSize={itemHeight}
                  className='no-scrollbar'
                  outerRef={outerRef}
                  itemData={{
                    products: filteredProducts,
                    viewMode,
                    onItemClick,
                    selectedProductId,
                    context
                  }}
                >
                  {ListItem}
                </List>
              );
            }
          }}
        </AutoSizer>
        {/* Overlay Scrollbar */}
        <div
          ref={trackRef}
          className="absolute right-4 top-0 bottom-0 w-2 opacity-0 transition-opacity duration-200 z-20"
        >
          <div
            ref={thumbRef}
            className="absolute w-full rounded-full bg-primary/40 hover:bg-primary/60 cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}
