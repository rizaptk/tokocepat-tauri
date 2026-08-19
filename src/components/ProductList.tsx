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
import { useGlobalKeydown } from '@/hooks/use-global-keydown';
import { useActiveProduct } from '@/lib/product-active-store';

type ViewMode = 'card' | 'thumbnail' | 'list';

const columnClass = {
  name: "flex items-center gap-2 flex-1 min-w-0 h-8",
  brand: "hidden sm:flex items-center text-sm text-muted-foreground truncate max-w-[140px] w-[140px] px-2 border-l border-l-border/50 h-8",
  category: "hidden md:flex items-center text-sm text-muted-foreground truncate max-w-[160px] w-[160px] px-2 border-l border-l-border/50 h-8",
  price: "flex items-center justify-end shrink-0 text-right tabular-nums whitespace-nowrap w-28 border-l border-l-border/50 h-8"
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
const CARD_ROW_HEIGHT = 260;
const THUMBNAIL_ROW_HEIGHT = 72;
const LIST_ROW_HEIGHT = 36;

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
      className="px-5 py-1 h-full"
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
      className="h-full px-3"
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
export function ProductList({ products, viewMode, isLoading, onItemClick, selectedProductId, context = 'cashier' }: ProductListProps) {

  const outerRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { query } = useProductSearch();
  const { activeIndex, activeId, setActive, clearActive } = useActiveProduct();
  const [isScrolling, setIsScrolling] = useState(false);

  const filteredProducts = useMemo(() => {
    if (query.length === 0) {
      return products;
    }
    return products.filter(p =>
      (p.name.toLowerCase().includes(query) || p.barcode?.includes(query))
    );
  }, [products, query]);

  // --- Keyboard Navigation ---
  const handleNavigate = (direction: 'up' | 'down' | 'left' | 'right') => {
    if (filteredProducts.length === 0) return;

    let newIndex = activeIndex ?? -1;

    if (viewMode === 'card') {
      if (!containerRef.current) return;
      const width = containerRef.current.offsetWidth;
      const columnCount = Math.max(1, Math.floor(width / CARD_MIN_WIDTH));

      // const currentRow = Math.floor(newIndex / columnCount);
      // const currentCol = newIndex % columnCount;
      if (direction === 'down') newIndex = Math.min(newIndex + columnCount, filteredProducts.length - 1);
      else if (direction === 'up') newIndex = Math.max(newIndex - columnCount, 0);
      else if (direction === 'right') newIndex = Math.min(newIndex + 1, filteredProducts.length - 1);
      else if (direction === 'left') newIndex = Math.max(newIndex - 1, 0);
    } else { // list or thumbnail
      if (direction === 'down') newIndex = newIndex >= filteredProducts.length - 1 ? 0 : newIndex + 1;
      else if (direction === 'up') newIndex = newIndex <= 0 ? filteredProducts.length - 1 : newIndex - 1;
    }

    if (newIndex >= 0 && newIndex < filteredProducts.length) {
      setActive(newIndex, filteredProducts[newIndex].id, 'keyboard');
    }
  }

  useGlobalKeydown({ key: 'ArrowDown', handler: () => handleNavigate('down'), enabled: context === 'cashier' || context === 'product', bindTo: containerRef });
  useGlobalKeydown({ key: 'ArrowUp', handler: () => handleNavigate('up'), enabled: context === 'cashier' || context === 'product', bindTo: containerRef });
  useGlobalKeydown({ key: 'ArrowRight', handler: () => handleNavigate('right'), enabled: context === 'cashier' || context === 'product', bindTo: containerRef });
  useGlobalKeydown({ key: 'ArrowLeft', handler: () => handleNavigate('left'), enabled: context === 'cashier' || context === 'product', bindTo: containerRef });

  const handleActionKey = () => {
    if (activeId === null) return;
    const product = filteredProducts.find(p => p.id === activeId);
    if (product && onItemClick) {
      onItemClick(product);
      clearActive();
    }
  }
  useGlobalKeydown({ key: 'Enter', handler: handleActionKey, enabled: context === 'cashier' || context === 'product', bindTo: containerRef });
  useGlobalKeydown({ key: 'Space', handler: handleActionKey, enabled: context === 'cashier' || context === 'product', bindTo: containerRef });
  // --- End Keyboard Navigation ---


  const { subscribe, getScrollTop } = useOverlayScrollbar({
    outerRef, thumbRef, trackRef, containerRef, options: {
      autoHideDelay: 800,
      minThumbHeight: 24,
    }
  })

  useEffect(() => {
    const unsubscribe = subscribe(() => {
      const scrolltop = getScrollTop();
      setIsScrolling(scrolltop > 0);
    });
    return () => {
      unsubscribe();
    };
  }, [subscribe, getScrollTop]);

  if (isLoading) {
    return <div className="h-full w-full"><LoadingSkeleton viewMode={viewMode} /></div>;
  }

  if (filteredProducts.length === 0 && !isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-center">
        <div>
          <h2 className="text-xl font-semibold">Produk Tidak Ditemukan</h2>
          <p className="text-muted-foreground">Coba gunakan kata kunci pencarian lain.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col relative">
      {
        viewMode === 'list' &&
        <div className='px-3'>
          <div className='flex w-full items-center h-8 border bg-card rounded-t border-b-0 px-3'>
            <div className={columnClass.name}>
              {context === 'product' && <div className="w-9 shrink-0" aria-hidden="true" />}
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nama</span>
            </div>
            <div className={columnClass.brand}>
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Merek</span>
            </div>
            <div className={columnClass.category}>
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Kategori</span>
            </div>
            <div className={columnClass.price}>
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Harga</span>
            </div>
          </div>
        </div>
      }
      <div className="relative flex-1 overflow-hidden" ref={containerRef}>
        <div className={`absolute h-0 transition-opacity duration-150 pointer-events-none shadow border-b ${viewMode === 'list' ? '-top-px left-3 right-3' : 'left-2 right-2 top-0'} z-10 ${isScrolling ? 'opacity-100' : 'opacity-0'}`}></div>
        <AutoSizer>
          {({ height, width }) => {
            if (!width || !height) return null;

            if (viewMode === 'card') {
              const columnCount = Math.max(1, Math.floor(width / CARD_MIN_WIDTH));
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
                    columnCount: columnCount,
                    totalItems: filteredProducts.length,
                    onItemClick,
                    selectedProductId,
                    context,
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
                    context,
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
          className="absolute right-2 top-0 bottom-0 w-2 opacity-0 transition-opacity duration-200 z-20"
        >
          <div
            ref={thumbRef}
            className="absolute w-full rounded-full bg-border/40 hover:bg-border/70 cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}
