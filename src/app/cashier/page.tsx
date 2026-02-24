
"use client";

import { useState, useEffect, useMemo } from 'react';
import { Header } from '@/components/Header';
import { CartDisplay } from '@/components/CartDisplay';
import { useStore } from '@/lib/store';
import { useDbStore } from '@/lib/db-store';
import { Product, ProductVariant, ModifierGroup, Transaction, Shift, StoreConfig, Category } from '@/lib/types';
import { TokoCepatLogo } from '@/components/TokoCepatLogo';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LogIn } from 'lucide-react';
import { seedDatabase } from '@/lib/database';
import { ProductSearchBar } from '@/components/ProductSearchBar';
import { ProductList } from '@/components/ProductList';

export type ViewMode = 'card' | 'thumbnail' | 'list';

export default function CashierPage() {
  // Global state
  const { products, setProducts, setProductVariants, setModifierGroups, setTransactions, setShifts, setStoreConfig, setCategories, activeShift, openShift, cart } = useStore();
  const { isInitialized, db, firesqlite } = useDbStore();
  
  // Local state
  const [searchTerm, setSearchTerm] = useState('');
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [openingCash, setOpeningCash] = useState(0);

  // Responsive and view state
  const [viewMode, setViewMode] = useState<ViewMode>('thumbnail');

  useEffect(() => {
    // Set default view mode based on screen size
    const handleResize = () => {
        const isMobile = window.innerWidth < 768;
        setViewMode(isMobile ? 'thumbnail' : 'card');
    };
    window.addEventListener('resize', handleResize);
    handleResize(); // Set initial view mode
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isInitialized || !db || !firesqlite) return;

    let unsubProducts: (() => void) | undefined;
    let unsubVariants: (() => void) | undefined;
    let unsubModifiers: (() => void) | undefined;
    let unsubTransactions: (() => void) | undefined;
    let unsubShifts: (() => void) | undefined;
    let unsubStoreConfig: (() => void) | undefined;
    let unsubCategories: (() => void) | undefined;

    const setupData = async () => {
      try {
        await seedDatabase(firesqlite, db);
        
        const { collection, doc, onSnapshot } = firesqlite;
        
        unsubStoreConfig = onSnapshot(doc(db, 'store_config', 'main'), (docSnap: any) => {
            if (docSnap.exists()) {
                setStoreConfig(docSnap.data() as StoreConfig);
            }
        });
        
        unsubProducts = onSnapshot(collection(db, 'products'), (snapshot: any) => {
          const productList = snapshot.docs.map((doc: any) => doc.data() as Product);
          setProducts(productList);
          if (isDataLoading) setIsDataLoading(false);
        });

        unsubVariants = onSnapshot(collection(db, 'product_variants'), (snapshot: any) => {
            const variantList = snapshot.docs.map((doc: any) => doc.data() as ProductVariant);
            setProductVariants(variantList);
        });

        unsubModifiers = onSnapshot(collection(db, 'modifier_groups'), (snapshot: any) => {
            const groupList = snapshot.docs.map((doc: any) => doc.data() as ModifierGroup);
            setModifierGroups(groupList);
        });

        unsubTransactions = onSnapshot(collection(db, 'transactions'), (snapshot: any) => {
            const transactionList = snapshot.docs.map((doc: any) => doc.data() as Transaction);
            setTransactions(transactionList);
        });

        unsubShifts = onSnapshot(collection(db, 'shifts'), (snapshot: any) => {
          const shiftList = snapshot.docs.map((doc: any) => doc.data() as Shift);
          setShifts(shiftList);
        });

        unsubCategories = onSnapshot(collection(db, 'categories'), (snapshot: any) => {
            const categoryList = snapshot.docs.map((doc: any) => doc.data() as Category);
            setCategories(categoryList);
        });

      } catch (error: any) {
        console.error("Failed to subscribe to data:", error);
        setIsDataLoading(false);
      }
    };

    setupData();

    return () => {
      if (unsubProducts) unsubProducts();
      if (unsubVariants) unsubVariants();
      if (unsubModifiers) unsubModifiers();
      if (unsubTransactions) unsubTransactions();
      if (unsubShifts) unsubShifts();
      if (unsubStoreConfig) unsubStoreConfig();
      if (unsubCategories) unsubCategories();
    };
  }, [isInitialized, db, firesqlite, setProducts, setProductVariants, setModifierGroups, setTransactions, setShifts, setStoreConfig, setCategories, isDataLoading]);

  const filteredProducts = useMemo(() => 
    products.filter(product =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase())
    ), [products, searchTerm]);

  const isAutocompleteVisible = searchTerm.length > 0;

  const handleOpenShift = () => {
    openShift(openingCash);
    setOpeningCash(0);
  }

  const handleItemAddedToCart = () => {
    setSearchTerm('');
  }

  if (!isInitialized) {
      return (
        <div className="flex h-screen w-full items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-4">
            <TokoCepatLogo />
            <p className="text-muted-foreground">Initializing Database...</p>
            <div className="w-48 h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary animate-pulse w-full"></div>
            </div>
          </div>
        </div>
      )
  }

  if (!activeShift) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-md">
            <CardHeader>
                <CardTitle>Open a New Shift</CardTitle>
                <CardDescription>Enter the starting cash amount in your drawer to begin making sales.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row items-center gap-4">
                <div className="flex-1 w-full">
                    <Label htmlFor="opening-cash" className="sr-only">Opening Cash</Label>
                    <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">Rp</span>
                        <Input 
                            id="opening-cash"
                            type="number" 
                            placeholder="Enter opening cash amount" 
                            value={openingCash || ''}
                            onChange={(e) => setOpeningCash(Number(e.target.value))}
                            className="pl-10 text-lg"
                            autoFocus
                        />
                    </div>
                </div>
                <Button onClick={handleOpenShift} className="w-full sm:w-auto" disabled={openingCash <= 0}>
                    <LogIn className="mr-2 h-4 w-4" /> Start Shift
                </Button>
            </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="h-screen w-full bg-muted/40 flex flex-col">
      <Header />

      {/* Desktop & Tablet Layout: Split View */}
      <div className="hidden md:grid md:grid-cols-5 lg:grid-cols-3 flex-1 overflow-hidden">
        <main className="col-span-3 lg:col-span-2 flex flex-col p-4 overflow-y-auto relative">
            <div className="mb-4 sticky top-0 bg-muted/40 py-2 z-10">
               <ProductSearchBar 
                  searchTerm={searchTerm} 
                  onSearchTermChange={setSearchTerm}
                  viewMode={viewMode}
                  onViewModeChange={setViewMode}
                />
            </div>
            {isAutocompleteVisible && (
                <div className="absolute top-20 left-4 right-4 z-20 bg-background border rounded-lg shadow-lg max-h-[60vh] overflow-y-auto">
                     <ProductList products={filteredProducts} viewMode={viewMode} isLoading={isDataLoading} onItemAdded={handleItemAddedToCart} />
                </div>
            )}
          <ProductList products={filteredProducts.length > 0 ? filteredProducts : products} viewMode={viewMode} isLoading={isDataLoading} onItemAdded={handleItemAddedToCart}/>
        </main>
        <aside className="col-span-2 lg:col-span-1 border-l bg-background flex flex-col">
            <CartDisplay />
        </aside>
      </div>

      {/* Mobile Layout: Cart First with Search */}
      <div className="md:hidden flex flex-col flex-1 overflow-hidden relative">
            <div className="p-4 border-b shrink-0">
                 <ProductSearchBar 
                    searchTerm={searchTerm} 
                    onSearchTermChange={setSearchTerm}
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                />
            </div>
             {isAutocompleteVisible && (
                <div className="absolute top-20 left-4 right-4 z-20 bg-background border rounded-lg shadow-lg max-h-[60vh] overflow-y-auto">
                    <ProductList products={filteredProducts} viewMode={viewMode} isLoading={isDataLoading} onItemAdded={handleItemAddedToCart} />
                </div>
            )}
            <CartDisplay />
      </div>
    </div>
  );
}
