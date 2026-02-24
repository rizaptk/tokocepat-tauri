
"use client";

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
};

const LoadingSkeleton = ({ viewMode }: { viewMode: ViewMode }) => {
    const itemCount = 12;
    if (viewMode === 'list' || viewMode === 'thumbnail') {
        return (
             <div className="flex flex-col gap-2">
                {Array.from({ length: itemCount }).map((_, index) => (
                    <Skeleton key={index} className="h-20 w-full" />
                ))}
             </div>
        )
    }
    // card view
    return (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
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


export function ProductList({ products, viewMode, isLoading }: ProductListProps) {
  if (isLoading) {
    return <LoadingSkeleton viewMode={viewMode} />;
  }
  
  if (products.length === 0) {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-semibold">No Products Found</h2>
        <p className="text-muted-foreground">Try adjusting your search term.</p>
      </div>
    )
  }

  if (viewMode === 'list') {
    return (
        <div className="flex flex-col divide-y divide-border rounded-md border">
            {products.map(product => (
                <ProductListItem key={product.id} product={product} />
            ))}
        </div>
    )
  }

  if (viewMode === 'thumbnail') {
    return (
        <div className="flex flex-col gap-2">
            {products.map(product => (
                <ProductThumbnailItem key={product.id} product={product} />
            ))}
        </div>
    )
  }

  // Default to 'card' view
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {products.map(product => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
