
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Product } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { ProductCard } from '@/components/ProductCard';
import { ProductThumbnailItem } from './items/ProductThumbnailItem';
import { ProductListItem } from './items/ProductListItem';
import { FixedSizeGrid, FixedSizeList } from 'react-window';

type ViewMode = 'card' | 'thumbnail' | 'list';

type ProductListProps = {
  products: Product[];
  viewMode: ViewMode;
  isLoading?: boolean;
  onItemClick?: (product: Product) => void;
  selectedProductId?: string | null;
  context?: 'cashier' | 'product' | 'inventory';
};

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

const CARD_WIDTH = 210; 
const CARD_HEIGHT = 290;
const THUMBNAIL_HEIGHT = 88;
const LIST_ITEM_HEIGHT = 76;

export function ProductList({ products, viewMode, isLoading, onItemClick, selectedProductId, context = 'cashier' }: ProductListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (containerRef.current) {
      const observer = new ResizeObserver(entries => {
        if (entries[0]) {
          const { width, height } = entries[0].contentRect;
          setSize({ width, height });
        }
      });
      observer.observe(containerRef.current);
      return () => observer.disconnect();
    }
  }, []);

  if (isLoading) {
    return <div className="h-full w-full"><LoadingSkeleton viewMode={viewMode} /></div>;
  }
  
  if (products.length === 0 && !isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-center">
        <div>
          <h2 className="text-xl font-semibold">No Products Found</h2>
          <p className="text-muted-foreground">Try adjusting your search term.</p>
        </div>
      </div>
    )
  }

  const { width, height } = size;
  
  if (width === 0 || height === 0) {
    return <div ref={containerRef} className="w-full h-full" />;
  }
  
  if (viewMode === 'list') {
    const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
        const product = products[index];
        return <div style={style} className="px-4"><ProductListItem key={product.id} product={product} onItemClick={onItemClick} isSelected={product.id === selectedProductId} context={context} /></div>;
    };
    return (
        <div ref={containerRef} className="w-full h-full">
            <FixedSizeList height={height} width={width} itemCount={products.length} itemSize={LIST_ITEM_HEIGHT}>
                {Row}
            </FixedSizeList>
        </div>
    );
  }

  if (viewMode === 'thumbnail') {
    const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
        const product = products[index];
        return <div style={style} className="px-2 py-1"><ProductThumbnailItem key={product.id} product={product} onItemClick={onItemClick} isSelected={product.id === selectedProductId} context={context} /></div>;
    };
    return (
        <div ref={containerRef} className="w-full h-full">
            <FixedSizeList height={height} width={width} itemCount={products.length} itemSize={THUMBNAIL_HEIGHT}>
                {Row}
            </FixedSizeList>
        </div>
    );
  }

  // Card View
  const columnCount = width < 500 ? 2 : Math.max(1, Math.floor(width / CARD_WIDTH));
  const isSingleColumn = columnCount === 1;
  const dynamicCardHeight = isSingleColumn ? 380 : CARD_HEIGHT;
  const rowCount = Math.ceil(products.length / columnCount);
  const columnWidth = Math.floor(width / columnCount);

  const Cell = ({ columnIndex, rowIndex, style }: { columnIndex: number; rowIndex: number; style: React.CSSProperties }) => {
      const index = rowIndex * columnCount + columnIndex;
      if (index >= products.length) {
        return null;
      }
      const product = products[index];
      return (
        <div style={style}>
            <div className="p-2 h-full w-full">
                <ProductCard key={product.id} product={product} onItemClick={onItemClick} isSelected={product.id === selectedProductId} context={context} />
            </div>
        </div>
      );
  };
  
  return (
    <div ref={containerRef} className="w-full h-full">
      <FixedSizeGrid columnCount={columnCount} columnWidth={columnWidth} height={height} rowCount={rowCount} rowHeight={dynamicCardHeight} width={width}>
        {Cell}
      </FixedSizeGrid>
    </div>
  );
}
