"use client";

import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { ProductGrid } from '@/components/ProductGrid';
import { Cart } from '@/components/Cart';
import { MobileCart } from '@/components/MobileCart';
import { useStore } from '@/lib/store';
import type { Product } from '@/lib/types';
import { subscribeToProducts } from '@/services/productService';


export default function PosApp() {
  const products = useStore((state) => state.products);
  const setProducts = useStore((state) => state.setProducts);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const setupSubscription = async () => {
      try {
        unsubscribe = await subscribeToProducts(
          (productList: Product[]) => {
            setProducts(productList);
            setIsLoading(false);
          },
          (error: Error) => {
            console.error('Failed to subscribe to products:', error);
            setIsLoading(false);
          }
        );
      } catch (error) {
        console.error('Failed to setup database subscription:', error);
        setIsLoading(false);
      }
    };

    setupSubscription();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [setProducts]);

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex h-screen w-full bg-muted/40">
      <div className="flex flex-col flex-1">
        <Header searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
        <main className="flex-1 p-4 md:p-6 overflow-y-auto">
          <ProductGrid products={filteredProducts} isLoading={isLoading} />
        </main>
      </div>
      <Cart />
      <MobileCart />
    </div>
  );
}
