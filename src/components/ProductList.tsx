
"use client";

import React from 'react';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { Product } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { ProductCard } from '@/components/ProductCard';
import { ProductThumbnailItem } from './items/ProductThumbnailItem';
import { ProductListItem } from './items/ProductListItem';

type ViewMode = 'card' | 'thumbnail' | 'list';

type ProductListProps = {
  products: Product[];
  viewMode: ViewMode;
  isLoading?: boolean;
  onItemClick?: (product: Product) => void;
  selectedProductId?: string | null;
  context?: 'cashier' | 'product' | 'inventory';
};

// Constants for layout calculation
const CARD_MIN_WIDTH = 210;
const CARD_ROW_HEIGHT = 270;
const THUMBNAIL_ROW_HEIGHT = 81;
const LIST_ROW_HEIGHT = 76;

// --- Components for Card Grid View ---

// 1. Memoized item for performance. This is one cell in the grid.
const CardGridItem = React.memo(({ product, onItemClick, selectedProductId, context, columnCount }: { product: Product, onItemClick?: (product: Product) => void, selectedProductId?: string | null, context?: 'cashier' | 'product' | 'inventory', columnCount: number }) => {
  if (!product) return null;

  return (
    <div style={{ flex: `0 0 ${100 / columnCount}%`, padding: '4px', boxSizing: 'border-box', height: '100%' }}>
      <ProductCard
        product={product}
        onItemClick={onItemClick}
        isSelected={product.id === selectedProductId}
        context={context}
      />
    </div>
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
    <div style={{ ...style, display: 'flex' }}>
      {itemsInRow}
    </div>
  );
};

// --- Component for List/Thumbnail View ---

const ListItem = React.memo(({ index, style, data }: { index: number, style: React.CSSProperties, data: any }) => {
  const { products, viewMode, onItemClick, selectedProductId, context } = data;
  const product = products[index];

  const content = viewMode === 'thumbnail' ? (
    <div className="p-0 h-full">
      <ProductThumbnailItem
        product={product}
        onItemClick={onItemClick}
        isSelected={product.id === selectedProductId}
        context={context}
      />
    </div>
  ) : (
    <div className="p-0 h-full bg-card">
      <ProductListItem
        product={product}
        onItemClick={onItemClick}
        isSelected={product.id === selectedProductId}
        context={context}
      />
    </div>
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
export function ProductList({ products, viewMode, isLoading, onItemClick, selectedProductId, context = 'cashier' }: ProductListProps) {
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
        );
    }

    return (
        <div className="w-full h-full">
            <AutoSizer>
                {({ height, width }) => {
                    if (!width || !height) return null;

                    if (viewMode === 'card') {
                        const columnCount = Math.max(2, Math.floor(width / CARD_MIN_WIDTH));
                        const rowCount = Math.ceil(products.length / columnCount);
                        return (
                            <List
                                height={height}
                                width={width}
                                itemCount={rowCount}
                                itemSize={CARD_ROW_HEIGHT}
                                itemData={{
                                    products,
                                    columnCount,
                                    totalItems: products.length,
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
                                itemCount={products.length}
                                itemSize={itemHeight}
                                itemData={{
                                    products,
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
        </div>
    );
}
