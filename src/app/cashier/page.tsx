"use client";

import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { ProductGrid } from '@/components/ProductGrid';
import { CartDisplay } from '@/components/CartDisplay';
import { useStore } from '@/lib/store';
import { useDbStore } from '@/lib/db-store';
import { Product, ProductVariant, ModifierGroup, Transaction, Shift, StoreConfig, Category } from '@/lib/types';
import { TokoCepatLogo } from '@/components/TokoCepatLogo';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LogIn, Search, Barcode, SlidersHorizontal } from 'lucide-react';
import { seedDatabase } from '@/lib/database';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger, } from "@/components/ui/sheet";

export default function CashierPage() {
  const products = useStore((state) => state.products);
  const setProducts = useStore((state) => state.setProducts);
  const setProductVariants = useStore((state) => state.setProductVariants);
  const setModifierGroups = useStore((state) => state.setModifierGroups);
  const setTransactions = useStore((state) => state.setTransactions);
  const setShifts = useStore((state) => state.setShifts);
  const setStoreConfig = useStore((state) => state.setStoreConfig);
  const setCategories = useStore((state) => state.setCategories);
  const activeShift = useStore((state) => state.activeShift);
  const openShift = useStore((state) => state.openShift);

  const [searchTerm, setSearchTerm] = useState('');
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [openingCash, setOpeningCash] = useState(0);
  const [isProductSheetOpen, setIsProductSheetOpen] = useState(false);

  const { isInitialized, db, firesqlite } = useDbStore();

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

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenShift = () => {
    openShift(openingCash);
    setOpeningCash(0);
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

      {/* Desktop Layout: Split View */}
      <div className="hidden md:grid md:grid-cols-3 flex-1 overflow-hidden">
        <main className="col-span-2 flex flex-col p-4 overflow-y-auto">
            <div className="flex items-center gap-4 mb-4">
                <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Search products..."
                        className="w-full pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <Dialog>
                    <DialogTrigger asChild>
                        <Button variant="outline" size="icon">
                            <Barcode className="h-5 w-5" />
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                        <DialogTitle>Barcode Scanner</DialogTitle>
                        <DialogDescription>
                            This feature is for demonstration purposes. In a real app, this would open the device's camera to scan product barcodes.
                        </DialogDescription>
                        </DialogHeader>
                        <div className="flex flex-col items-center justify-center gap-4 py-8">
                        <Barcode className="h-24 w-24 text-muted-foreground" />
                        <p className="text-muted-foreground">Ready to scan</p>
                        </div>
                    </DialogContent>
                </Dialog>
                <Button variant="outline"><SlidersHorizontal className="mr-2 h-4 w-4" /> Filters</Button>
            </div>
          <ProductGrid products={filteredProducts} isLoading={isDataLoading} />
        </main>
        <aside className="col-span-1 border-l bg-background flex flex-col">
            <CartDisplay />
        </aside>
      </div>

      {/* Mobile Layout: Cart First */}
      <div className="md:hidden flex flex-col flex-1 overflow-hidden">
        <div className="p-4 border-b">
            <div 
                className="relative flex items-center"
                onClick={() => setIsProductSheetOpen(true)}
            >
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <div className="w-full pl-10 pr-4 py-2 rounded-md border border-input bg-background cursor-pointer text-muted-foreground">
                    Search products to add...
                </div>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto">
            <CartDisplay />
        </div>
        
        <Sheet open={isProductSheetOpen} onOpenChange={setIsProductSheetOpen}>
            <SheetContent side="bottom" className="h-5/6 flex flex-col">
                <SheetHeader className="p-4">
                    <SheetTitle>Select Products</SheetTitle>
                    <SheetDescription>Search and tap a product to add it to the cart.</SheetDescription>
                </SheetHeader>
                 <div className="flex items-center gap-4 px-4 pb-4 border-b">
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Search products..."
                            className="w-full pl-8"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            autoFocus
                        />
                    </div>
                     <Dialog>
                        <DialogTrigger asChild>
                            <Button variant="outline" size="icon">
                                <Barcode className="h-5 w-5" />
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                            <DialogTitle>Barcode Scanner</DialogTitle>
                            <DialogDescription>
                                Feature coming soon.
                            </DialogDescription>
                            </DialogHeader>
                            <div className="flex flex-col items-center justify-center gap-4 py-8">
                            <Barcode className="h-24 w-24 text-muted-foreground" />
                            <p className="text-muted-foreground">Ready to scan</p>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                     <ProductGrid products={filteredProducts} isLoading={isDataLoading} />
                </div>
            </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
