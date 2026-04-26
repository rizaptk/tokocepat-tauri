import { useState, useEffect, useMemo } from 'react';
import { Header } from '@/components/Header';
import { CartDisplay } from '@/components/CartDisplay';
import { useStore } from '@/lib/store';
import { Product, CartItem, ProductVariant } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LogIn } from 'lucide-react';
import { ProductSearchBar } from '@/components/ProductSearchBar';
import { ProductList } from '@/components/ProductList';
import { useToast } from '@/hooks/use-toast';
import { ModifierPanel } from '@/components/ModifierPanel';
import { VariantPanel } from '@/components/VariantPanel';
import { cn } from '@/lib/utils';
import { SelectedModifier } from '@/lib/types';
import { useIsMobile } from '@/lib/ismobile-store';
import { useGlobalBarcodeScanner } from '@/hooks/use-global-barcode-scanner';
import { useSettingsStore } from '@/lib/settings';
import { useProductSearch } from '@/lib/useProductSearch';

export type ViewMode = 'card' | 'thumbnail' | 'list';

// This represents an item that has had a variant selected but is not yet in the cart
type ItemWithVariant = Product & { _selectedVariant: ProductVariant };

export default function DefaultCashierPage() {
    // Global state from Zustand
    const { products, activeShift, openShift, saveItemToCart, categories } = useStore();
    const { toast } = useToast();
    const { isMobile } = useIsMobile();
    const { query } = useProductSearch();

    const [openingCash, setOpeningCash] = useState(0);
    const [itemToSelectVariant, setItemToSelectVariant] = useState<Product | null>(null);
    const [itemToModify, setItemToModify] = useState<Product | CartItem | ItemWithVariant | null>(null);

    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [scrollTop, setScrollTop] = useState(0);

    // Responsive and view state
    const isAutocompleteVisible = query.length > 0;
    const { showToast, showMode, setShowMode } = useSettingsStore();

    useEffect(() => {
        // Set default view mode based on screen size
        const handleResize = () => {
            const mobile = window.innerWidth < 768;
            setShowMode({ cart: mobile ? 'thumbnail' : showMode.cart });
        };
        window.addEventListener('resize', handleResize);
        handleResize(); // Set initial view mode
        return () => window.removeEventListener('resize', handleResize);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const displayedProducts = useMemo(() => {
        return products.filter(p => {
            const matchesCategory = !selectedCategoryId || p.category_id === selectedCategoryId;
            return p.is_active && matchesCategory;
        });
    }, [products, selectedCategoryId]);


    const handleOpenShift = () => {
        openShift(openingCash);
        setOpeningCash(0);
    }

    const handleProductSelect = (product: Product) => {
        if (!activeShift) {
            toast({
                variant: "destructive",
                title: "Sif Belum Dibuka",
                description: "Silakan buka sif sebelum melakukan penjualan.",
            });
            return;
        }

        if (product.has_variant) {
            setItemToSelectVariant(product);
        } else if (product.has_modifier) {
            setItemToModify(product);
        } else {
            saveItemToCart(product);
        }
    };

    const handleVariantConfirm = (selectedVariant: ProductVariant) => {
        const item = itemToSelectVariant;
        setItemToSelectVariant(null);
        if (!item) return;

        // Create a temporary "composite" item that holds the original product data
        // plus the selected variant, with an updated price.
        const compositeItem: ItemWithVariant = {
            ...item,
            price: item.price + selectedVariant.additional_price,
            _selectedVariant: selectedVariant,
        };

        if (item.has_modifier) {
            // Pass this composite item to the modifier panel
            setItemToModify(compositeItem);
        } else {
            // No modifiers, save directly to cart
            saveItemToCart(compositeItem, [], selectedVariant);
        }
    };

    const handleBarcodeScan = (barcode: string) => {
        const product = products.find(p => p.barcode === barcode && !!p.is_active);
        if (product) {
            handleProductSelect(product);
        } else {
            toast({
                variant: "destructive",
                title: "Produk Tidak Ditemukan",
                description: `Tidak ada produk dengan barcode: ${barcode}`,
            });
        }
    };

    // Setup global scanner
    useGlobalBarcodeScanner({ onScan: handleBarcodeScan });

    const handleModifierConfirm = (selectedModifiers: SelectedModifier[]) => {
        if (!itemToModify) return;

        const item = itemToModify;
        const selectedVariant = '_selectedVariant' in item ? (item as ItemWithVariant)._selectedVariant : undefined;

        saveItemToCart(item, selectedModifiers, selectedVariant);
        setItemToModify(null);
    };

    const handleEditCartItem = (item: CartItem) => {
        // For now, only allow editing modifiers. Variant editing can be added later.
        if (item.has_modifier) {
            setItemToModify(item);
        } else {
            showToast.noModifier &&
                toast({
                    title: "Tidak ada opsi tambahan",
                    description: "Item ini tidak memiliki varian atau modifier untuk diubah."
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
                        <CardTitle>Buka Sif Baru</CardTitle>
                        <CardDescription>Masukkan jumlah kas awal di laci Anda untuk memulai penjualan.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col sm:flex-row items-center gap-4">
                        <div className="flex-1 w-full">
                            <Label htmlFor="opening-cash" className="sr-only">Kas Awal</Label>
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">Rp</span>
                                <Input
                                    id="opening-cash"
                                    type="number"
                                    placeholder="Masukkan jumlah kas awal"
                                    value={openingCash || ''}
                                    onChange={(e) => setOpeningCash(Number(e.target.value))}
                                    className="pl-10 text-lg"
                                    autoFocus
                                    onKeyDown={(e) => e.code === 'Enter' && handleOpenShift()}
                                />
                            </div>
                        </div>
                        <Button onClick={handleOpenShift} className="w-full sm:w-auto" disabled={openingCash <= 0}>
                            <LogIn className="mr-2 h-4 w-4" /> Mulai
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="h-screen w-full flex flex-col">
            <Header />

            {/* Desktop & Tablet Layout: Split View */}
            <div className="hidden md:grid md:grid-cols-2 xl:grid-cols-10 flex-1 overflow-hidden">
                <main className="xl:col-span-6 flex flex-col overflow-hidden relative">
                    <div className={`z-10 p-4 flex flex-col gap-4 border-b transition-all ${scrollTop > 0 ? 'border-b-border shadow-md' : 'border-b-transparent'}`}>
                        <ProductSearchBar
                            viewMode={showMode.cart}
                            onViewModeChange={(view) => setShowMode({ cart: view })}
                            onBarcodeScan={handleBarcodeScan}
                        />
                        {
                            categories.length > 0 &&
                            <div className='flex flex-row items-center gap-4 overflow-x-auto no-scrollbar'>
                                <Button
                                    variant={selectedCategoryId === null ? 'secondary' : 'outline'}
                                    size="sm"
                                    className="rounded-full px-4 shrink-0"
                                    onClick={() => setSelectedCategoryId(null)}
                                >
                                    Semua
                                </Button>
                                {
                                    categories.map(category => (
                                        <Button
                                            key={category.id}
                                            variant={selectedCategoryId === category.id ? 'secondary' : 'outline'}
                                            size="sm"
                                            className="rounded-full px-4 shrink-0"
                                            onClick={() => setSelectedCategoryId(category.id)}
                                        >
                                            {category.name}
                                        </Button>
                                    ))
                                }
                            </div>
                        }
                    </div>
                    <div className="flex-1">
                        <ProductList products={displayedProducts} viewMode={showMode.cart} isLoading={products.length === 0} onItemClick={handleProductSelect} context="cashier" setScrollTop={setScrollTop} />
                    </div>
                </main>
                <aside className="xl:col-span-4 flex flex-col min-h-0">
                    <CartDisplay onEditItem={handleEditCartItem} />
                </aside>
            </div>

            {/* Mobile Layout: Toggle between Cart and Product List */}
            {
                isMobile &&
                <div className="md:hidden flex flex-col flex-1 overflow-hidden relative">
                    <div className="p-4 shrink-0 bg-background">
                        <ProductSearchBar
                            // searchTerm={query}
                            viewMode={showMode.cart}
                            onViewModeChange={(view) => setShowMode({ cart: view })}
                            onBarcodeScan={handleBarcodeScan}
                        />
                    </div>

                    {isAutocompleteVisible && (
                        <div className="absolute top-16 left-0 right-0 bottom-16 z-20 flex">
                            <ProductList products={displayedProducts} viewMode={showMode.cart} isLoading={products.length === 0} onItemClick={handleProductSelect} context="cashier" />
                        </div>
                    )}

                    <div className={cn("flex-1 flex flex-col", isAutocompleteVisible ? 'opacity-20 pointer-events-none' : 'opacity-100')}>
                        <CartDisplay onEditItem={handleEditCartItem} />
                    </div>

                    {/* do not remove */}
                    <div className='h-16 shrink-0'></div>
                </div>
            }

            <VariantPanel
                item={itemToSelectVariant}
                onOpenChange={(isOpen) => {
                    if (!isOpen) {
                        setItemToSelectVariant(null);
                    }
                }}
                onConfirm={handleVariantConfirm}
            />
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
