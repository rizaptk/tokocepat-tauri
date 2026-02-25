
"use client";

import { useState, useEffect, useMemo } from 'react';
import { Header } from '@/components/Header';
import { CartDisplay } from '@/components/CartDisplay';
import { useStore } from '@/lib/store';
import { Product, CartItem } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LogIn } from 'lucide-react';
import { ProductSearchBar } from '@/components/ProductSearchBar';
import { ProductList } from '@/components/ProductList';
import { useToast } from '@/hooks/use-toast';
import { ModifierPanel } from '@/components/ModifierPanel';
import { cn } from '@/lib/utils';
import { SelectedModifier } from '@/lib/types';
import { useIsMobile } from '@/lib/ismobile-store';
import { useGlobalBarcodeScanner } from '@/hooks/use-global-barcode-scanner';

export type ViewMode = 'card' | 'thumbnail' | 'list';

export default function CashierPage() {
  // Global state from Zustand
  const { products, activeShift, openShift, saveItemToCart } = useStore();
  const { toast } = useToast();
  const { isMobile } = useIsMobile();
  
  // Local state for UI
  const [searchTerm, setSearchTerm] = useState('');
  const [openingCash, setOpeningCash] = useState(0);
  const [itemToModify, setItemToModify] = useState<Product | CartItem | null>(null);

  // Responsive and view state
  const [viewMode, setViewMode] = useState<ViewMode>('thumbnail');
  const isAutocompleteVisible = searchTerm.length > 0;

  useEffect(() => {
    // Set default view mode based on screen size
    const handleResize = () => {
        const mobile = window.innerWidth < 768;
        setViewMode(mobile ? 'thumbnail' : 'card');
    };
    window.addEventListener('resize', handleResize);
    handleResize(); // Set initial view mode
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const filteredProducts = useMemo(() => 
    products.filter(product =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase())
    ), [products, searchTerm]);

  const handleOpenShift = () => {
    openShift(openingCash);
    setOpeningCash(0);
  }

  const handleItemAdded = () => {
    setSearchTerm('');
  }

  const handleProductSelect = (product: Product) => {
    if (!activeShift) {
        toast({
            variant: "destructive",
            title: "Shift Not Open",
            description: "Please open a shift before making a sale.",
        });
        return;
    }
    if (product.has_modifier) {
        setItemToModify(product);
    } else {
        saveItemToCart(product);
    }
    
    if (isAutocompleteVisible) {
        handleItemAdded();
    }
  };

  const handleBarcodeScan = (barcode: string) => {
    const product = products.find(p => p.barcode === barcode);
    if (product) {
        handleProductSelect(product);
    } else {
        toast({
            variant: "destructive",
            title: "Product Not Found",
            description: `No product found with barcode: ${barcode}`,
        });
    }
  };

  // Setup global scanner
  useGlobalBarcodeScanner({ onScan: handleBarcodeScan });

  const handleModifierConfirm = (selectedModifiers: SelectedModifier[]) => {
    if (!itemToModify) return;
    saveItemToCart(itemToModify, selectedModifiers);
    setItemToModify(null);
    // If we were adding a new item (not editing from cart), clear search
    if (!('cartItemId' in itemToModify)) {
       handleItemAdded();
    }
  };

  const handleEditCartItem = (item: CartItem) => {
      if (item.has_modifier) {
        setItemToModify(item);
      } else {
          toast({
              title: "No modifiers",
              description: "This item does not have any modifiers to edit."
          })
      }
  }

  // This check is now handled by DbProvider, but we need to wait for activeShift to be determined.
  if (activeShift === undefined) {
    // DbProvider shows the main loading screen. We render nothing here until shift status is known.
    return null; 
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
        <main className="col-span-3 lg:col-span-2 flex flex-col overflow-hidden relative">
            <div className="bg-muted/40 z-10 border-b p-4">
               <ProductSearchBar 
                  searchTerm={searchTerm} 
                  onSearchTermChange={setSearchTerm}
                  viewMode={viewMode}
                  onViewModeChange={setViewMode}
                  onBarcodeScan={handleBarcodeScan}
                />
            </div>
          <div className="flex-1">
            <ProductList products={filteredProducts.length > 0 ? filteredProducts : []} viewMode={viewMode} isLoading={products.length === 0} onItemClick={handleProductSelect} context="cashier"/>
          </div>
        </main>
        <aside className="col-span-2 lg:col-span-1 border-l bg-background flex flex-col">
            <CartDisplay onEditItem={handleEditCartItem} />
        </aside>
      </div>

      {/* Mobile Layout: Toggle between Cart and Product List */}
      {
        isMobile &&
        <div className="md:hidden flex flex-col flex-1 overflow-hidden relative">
                <div className="p-4 border-b shrink-0 bg-background">
                    <ProductSearchBar 
                        searchTerm={searchTerm} 
                        onSearchTermChange={setSearchTerm}
                        viewMode={viewMode}
                        onViewModeChange={setViewMode}
                        onBarcodeScan={handleBarcodeScan}
                    />
                </div>
                
                {isAutocompleteVisible && (
                    <div className="absolute top-20 left-3 right-3 bottom-16 z-20 bg-background border rounded-lg shadow-lg flex">
                        <ProductList products={filteredProducts} viewMode={viewMode} isLoading={products.length === 0} onItemClick={handleProductSelect} context="cashier" />
                    </div>
                )}
                
                <div className={cn("flex-1 flex flex-col", isAutocompleteVisible ? 'opacity-20 pointer-events-none' : 'opacity-100')}>
                    <CartDisplay onEditItem={handleEditCartItem}/>
                </div>

                {/* do not remove */}
                <div className='h-16 shrink-0'></div>
        </div>
      }

       <ModifierPanel 
            item={itemToModify} 
            onOpenChange={(isOpen) => {
                if (!isOpen) {
                    setItemToModify(null);
                }
            }}
            onConfirm={handleModifierConfirm}
        />
    </div>
  );
}
