
"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Product } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { ProductCard } from '@/components/ProductCard';
import { ProductThumbnailItem } from './items/ProductThumbnailItem';
import { ProductListItem } from './items/ProductListItem';
import { cn } from '@/lib/utils';

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

const OVERSCAN = 5; // Number of items to render above and below the viewport
const CARD_ROW_HEIGHT_MOBILE = 380;
const CARD_ROW_HEIGHT_DESKTOP = 290;
const THUMBNAIL_HEIGHT = 88;
const LIST_ITEM_HEIGHT = 76;
const CARD_MIN_WIDTH = 210;

export function ProductList({ products, viewMode, isLoading, onItemClick, selectedProductId, context = 'cashier' }: ProductListProps) {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
    const [scrollTop, setScrollTop] = useState(0);

    // Get container dimensions for calculations
    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const resizeObserver = new ResizeObserver(entries => {
            if (entries[0]) {
                const { width, height } = entries[0].contentRect;
                setContainerSize({ width, height });
            }
        });
        resizeObserver.observe(container);
        return () => resizeObserver.disconnect();
    }, []);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        setScrollTop(e.currentTarget.scrollTop);
    };

    const virtualization = useMemo(() => {
        if (containerSize.height === 0 || containerSize.width === 0) {
            return { visibleItems: [], totalHeight: 0, offset: 0, columnCount: 1 };
        }

        if (viewMode === 'card') {
            const isMobileView = containerSize.width < 500;
            const columnCount = isMobileView ? 2 : Math.max(1, Math.floor(containerSize.width / CARD_MIN_WIDTH));
            const cardRowHeight = columnCount === 1 ? CARD_ROW_HEIGHT_MOBILE : CARD_ROW_HEIGHT_DESKTOP;
            
            const rowCount = Math.ceil(products.length / columnCount);
            const totalHeight = rowCount * cardRowHeight;
            
            const startRow = Math.max(0, Math.floor(scrollTop / cardRowHeight) - OVERSCAN);
            const visibleRowCount = Math.ceil(containerSize.height / cardRowHeight) + (2 * OVERSCAN);

            const startIndex = startRow * columnCount;
            const endIndex = Math.min(products.length, (startRow + visibleRowCount) * columnCount);
            
            const visibleItems = products.slice(startIndex, endIndex);
            const offset = startRow * cardRowHeight;

            return { visibleItems, totalHeight, offset, columnCount };

        } else {
            // Logic for 'list' and 'thumbnail'
            const itemHeight = viewMode === 'list' ? LIST_ITEM_HEIGHT : THUMBNAIL_HEIGHT;
            const totalHeight = products.length * itemHeight;
            
            const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - OVERSCAN);
            const visibleItemCount = Math.ceil(containerSize.height / itemHeight) + (2 * OVERSCAN);
            const endIndex = Math.min(products.length, startIndex + visibleItemCount);

            const visibleItems = products.slice(startIndex, endIndex);
            const offset = startIndex * itemHeight;

            return { visibleItems, totalHeight, offset, columnCount: 1 };
        }
    }, [products, viewMode, containerSize, scrollTop]);


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
    
    const { visibleItems, totalHeight, offset, columnCount } = virtualization;

    const renderItem = (product: Product) => {
        const isSelected = product.id === selectedProductId;
        switch (viewMode) {
            case 'card':
                return <ProductCard key={product.id} product={product} onItemClick={onItemClick} isSelected={isSelected} context={context} />;
            case 'thumbnail':
                return <ProductThumbnailItem key={product.id} product={product} onItemClick={onItemClick} isSelected={isSelected} context={context} />;
            case 'list':
                return <ProductListItem key={product.id} product={product} onItemClick={onItemClick} isSelected={isSelected} context={context} />;
            default:
                return null;
        }
    };
    
    return (
        <div ref={scrollContainerRef} onScroll={handleScroll} className="w-full h-full overflow-y-auto">
            <div style={{ height: `${totalHeight}px`, position: 'relative' }}>
                <div 
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${offset}px)`,
                    }}
                >
                    {viewMode === 'card' ? (
                         <div 
                            className="grid p-2 gap-2"
                            style={{ gridTemplateColumns: `repeat(${columnCount}, 1fr)`}}
                         >
                            {visibleItems.map(renderItem)}
                         </div>
                    ) : (
                         <div className="flex flex-col p-2 gap-2">
                             {visibleItems.map(renderItem)}
                         </div>
                    )}
                </div>
            </div>
        </div>
    );
}
