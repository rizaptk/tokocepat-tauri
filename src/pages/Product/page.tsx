import { useState, useEffect, useMemo } from "react";
import { useStore } from "@/lib/store";
import { Product, CatalogProduct } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

// UI Components
import { Button } from "@/components/ui/button";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ProductSearchBar } from "@/components/ProductSearchBar";
import { ProductList } from "@/components/ProductList";
import { exportBarcodeStickersToPdf } from "@/lib/export";
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";


// Icons
import { PlusCircle, Printer, Package } from "lucide-react";

// Services
import { useGlobalBarcodeScanner } from "@/hooks/use-global-barcode-scanner";

// Sub-components
import { ProductEditor } from "./_components/ProductEditor";
import { useSelectedProduct } from "@/lib/product-select-store";
import { useProductSearch } from "@/lib/useProductSearch";
import { PackageSearch } from "lucide-react";


export default function ProductManagementPage() {
    const { products, catalog } = useStore();
    const { toast } = useToast();
    const [viewMode, setViewMode] = useState<"card" | "thumbnail" | "list">('list');
    const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [activeTab, setActiveTab] = useState("product");
    const [promoCatalog, setPromoCatalog] = useState<CatalogProduct | null>(null);
    const { query } = useProductSearch();
    const { selectedIds: selectedProductIds, clearSelected } = useSelectedProduct();
    const [printOptions, setPrintOptions] = useState({
        repeat: 1,
        labelWidthMm: 38,
        labelHeightMm: 13,
        pageSizeName: 'A4',
    });

    const paperSizeMap: Record<string, [number, number] | undefined> = {
        'A4': [595.28, 841.89],
        'Letter': [612, 792],
    };

    const selectedProducts = useMemo(
        () => products.filter(p => selectedProductIds.has(p.id) && p.barcode),
        [products, selectedProductIds]
    );

    // Estimate how many labels fit per sheet (2.835 pt / mm)
    const layoutEstimate = useMemo(() => {
        const pageSize = paperSizeMap[printOptions.pageSizeName] ?? paperSizeMap['A4']!;
        const lw = printOptions.labelWidthMm * 2.83465;
        const lh = printOptions.labelHeightMm * 2.83465;
        const margin = 5 * 2.83465;
        const gap = 2 * 2.83465;
        const cols = Math.floor((pageSize[0] - margin * 2 + gap) / (lw + gap));
        const rows = Math.floor((pageSize[1] - margin * 2 + gap) / (lh + gap));
        return { perSheet: Math.max(1, cols * rows), cols, rows };
    }, [printOptions]);

    const totalLabels = selectedProducts.length * printOptions.repeat;
    const estimatedSheets = Math.max(1, Math.ceil(totalLabels / layoutEstimate.perSheet));

    useEffect(() => {
        // Desktop default: tight table view; compact list view on smaller screens.
        setViewMode(window.innerWidth < 768 ? 'thumbnail' : 'list');
    }, []);

    const handleSelectProduct = (product: Product) => {
        setSelectedProductId(product.id);
        setActiveTab("product");
        if (window.innerWidth < 768) {
            setIsDrawerOpen(true);
        }
    };

    const handlePrintLabels = () => {
        if (selectedProducts.length === 0) {
            toast({
                variant: "destructive",
                title: "Tidak Ada Produk Terpilih",
                description: "Silakan pilih produk yang memiliki barcode untuk mencetak label.",
            });
            return;
        }
        exportBarcodeStickersToPdf(selectedProducts, {
            repeat: printOptions.repeat,
            labelWidthMm: printOptions.labelWidthMm,
            labelHeightMm: printOptions.labelHeightMm,
            pageSize: paperSizeMap[printOptions.pageSizeName],
        });
    };


    const handleBarcodeScan = (barcode: string) => {
        const product = products.find(p => p.barcode === barcode || p.sku === barcode);
        if (product) {
            handleSelectProduct(product);
            return;
        }
        // Fall back to the bundled catalog for reference.
        const catalogItem = catalog.find(p => p.barcode === barcode);
        if (catalogItem) {
            handleCatalogSelect(catalogItem);
            return;
        }
        toast({
            variant: "destructive",
            title: "Produk Tidak Ditemukan",
            description: `Tidak ada produk dengan kode barcode/SKU: ${barcode}`,
        });
    };

    useGlobalBarcodeScanner({ onScan: handleBarcodeScan });

    const handleAddNew = () => {
        setSelectedProductId(null);
        setPromoCatalog(null);
        setActiveTab("product");
        setIsDrawerOpen(true);
    }

    const handleCatalogSelect = (item: CatalogProduct) => {
        // Already promoted? Open that product instead.
        const existing = products.find(p => p.barcode === item.barcode);
        if (existing) {
            handleSelectProduct(existing);
            return;
        }
        // Otherwise prefill the "Tambah Produk" form; promote happens on save.
        setPromoCatalog(item);
        setSelectedProductId(null);
        setActiveTab("product");
        if (window.innerWidth < 768) {
            setIsDrawerOpen(true);
        }
    }

    const handleSaveChanges = () => {
        setSelectedProductId(null);
        setPromoCatalog(null);
        // data will refetch via zustand listener, no need for manual refresh
        if (window.innerWidth < 768) {
            setIsDrawerOpen(false);
        }
    }

    const handleCloseEditor = () => {
        clearSelected();
        setSelectedProductId(null);
        setPromoCatalog(null);
        if (window.innerWidth < 768) {
            setIsDrawerOpen(false);
        }
    }

    const [filter, setFilter] = useState('all');

    // Catalog fallback: only surfaced when the query finds nothing in `products`.
    const catalogHits = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return [];
        return catalog
            .filter(p =>
                p.name.toLowerCase().includes(q)
                || p.barcode?.includes(q)
                || p.brand?.toLowerCase().includes(q)
                || p.brand_owner?.toLowerCase().includes(q)
                || p.generic_name?.toLowerCase().includes(q)
            )
            .slice(0, 40);
    }, [catalog, query]);

    const displayedProducts = useMemo(() => {
        let items = [...products];
        if (filter === 'all') {
            items = items.filter(p => p.is_active);
        }
        else if (filter === 'retail') {
            items = items.filter(p => p.is_active);
        }
        else if (filter === 'consignment') {
            items = items.filter(p => p.is_consignment && p.is_active);
        }
        else if (filter === 'variants') {
            items = items.filter(p => p.has_variant && p.is_active);
        }
        else if (filter === 'inactive') {
            items = items.filter(p => !p.is_active);
        }

        const q = query.trim().toLowerCase();
        if (q) {
            items = items.filter(p => p.name.toLowerCase().includes(q) || p.barcode?.toLowerCase().includes(q));
        }
        return items;
    }, [products, filter, query]);

    const dlgTrigger = (
        <Button variant="outline" size="sm" className="hidden md:flex relative rounded-md h-8 shrink-0" disabled={selectedProductIds.size === 0}>
            <Printer className="h-4 w-4" />
            {selectedProductIds.size > 0 && (
                <div className="text-[10px] grid place-items-center leading-none absolute -top-0.5 -right-0.5 bg-destructive rounded-full text-destructive-foreground size-4">
                    {selectedProductIds.size}
                </div>
            )}
        </Button>
    );

    const printDialogContent = (
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                    <Printer className="size-4" /> Cetak Label Barcode
                </DialogTitle>
                <DialogDescription>
                    {selectedProducts.length} produk dipilih · {totalLabels} label · kira-kira {estimatedSheets} lembar {printOptions.pageSizeName}.
                </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-2">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="repeat" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Stiker per produk
                        </Label>
                        <Input
                            id="repeat"
                            type="number"
                            min={1}
                            value={printOptions.repeat}
                            onChange={(e) => setPrintOptions(o => ({ ...o, repeat: Math.max(1, parseInt(e.target.value) || 1) }))}
                            size="sm"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="pageSize" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Kertas</Label>
                        <Select
                            defaultValue={printOptions.pageSizeName}
                            onValueChange={(value) => setPrintOptions(o => ({ ...o, pageSizeName: value }))}
                        >
                            <SelectTrigger id="pageSize">
                                <SelectValue placeholder="Pilih ukuran" />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.keys(paperSizeMap).map(name => (
                                    <SelectItem key={name} value={name}>{name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="labelWidth" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Lebar (mm)</Label>
                        <Input
                            id="labelWidth"
                            type="number"
                            defaultValue={printOptions.labelWidthMm}
                            onChange={(e) => setPrintOptions(o => ({ ...o, labelWidthMm: parseInt(e.target.value) || 38 }))}
                            size="sm"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="labelHeight" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tinggi (mm)</Label>
                        <Input
                            id="labelHeight"
                            type="number"
                            defaultValue={printOptions.labelHeightMm}
                            onChange={(e) => setPrintOptions(o => ({ ...o, labelHeightMm: parseInt(e.target.value) || 13 }))}
                            size="sm"
                        />
                    </div>
                </div>

                <div className="rounded-md border bg-muted/40 p-2.5 text-xs text-muted-foreground grid grid-cols-3 gap-2 tabular-nums">
                    <div>
                        <div className="uppercase tracking-wider text-[10px]">Per lembar</div>
                        <div className="font-semibold text-foreground">{layoutEstimate.perSheet} label</div>
                    </div>
                    <div>
                        <div className="uppercase tracking-wider text-[10px]">Grid</div>
                        <div className="font-semibold text-foreground">{layoutEstimate.cols} × {layoutEstimate.rows}</div>
                    </div>
                    <div>
                        <div className="uppercase tracking-wider text-[10px]">Perkiraan</div>
                        <div className="font-semibold text-foreground">{estimatedSheets} lembar</div>
                    </div>
                </div>

                {selectedProducts.length > 0 && (
                    <div className="max-h-28 overflow-auto border rounded-md divide-y divide-border/50">
                        {selectedProducts.slice(0, 8).map(p => (
                            <div key={p.id} className="flex items-center justify-between px-3 py-1.5 text-xs">
                                <span className="font-medium truncate">{p.name}</span>
                                <Badge variant="outline" className="ml-2 h-4 px-1.5 font-mono text-[10px]">{p.barcode}</Badge>
                            </div>
                        ))}
                        {selectedProducts.length > 8 && (
                            <div className="px-3 py-1.5 text-[11px] text-muted-foreground">
                                +{selectedProducts.length - 8} produk lainnya…
                            </div>
                        )}
                    </div>
                )}
            </div>

            <DialogFooter>
                <Button size="sm" onClick={handlePrintLabels}>
                    <Printer className="mr-1.5 h-4 w-4" /> Cetak {totalLabels} Label
                </Button>
            </DialogFooter>
        </DialogContent>
    );

    return (
        <div className="w-full h-[calc(100vh-3rem)] md:grid md:grid-cols-10 min-h-0">
            {/* Left Panel: Product List */}
            <div className="col-span-10 md:col-span-5 lg:col-span-6 h-full flex flex-col min-h-0">
                <div className="px-3 pt-3 pb-2 flex flex-col w-full gap-2">
                    <div className="flex items-center gap-2">
                        <ProductSearchBar
                            viewMode={viewMode}
                            onViewModeChange={setViewMode}
                            onBarcodeScan={handleBarcodeScan}
                        />
                        <Dialog>
                            <DialogTrigger asChild>{dlgTrigger}</DialogTrigger>
                            {printDialogContent}
                        </Dialog>
                        <Button onClick={handleAddNew} size="sm" className="shrink-0 h-8">
                            <PlusCircle className="mr-1.5 h-4 w-4" /> Tambah
                        </Button>
                    </div>

                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                        <FilterPill active={filter === 'all'} onClick={() => setFilter('all')}>Semua (Aktif)</FilterPill>
                        <FilterPill active={filter === 'retail'} onClick={() => setFilter('retail')}>Retail</FilterPill>
                        <Separator orientation="vertical" className="h-4 my-auto" />
                        <FilterPill active={filter === 'consignment'} onClick={() => setFilter('consignment')}>Konsinyasi</FilterPill>
                        <FilterPill active={filter === 'variants'} onClick={() => setFilter('variants')}>Varian</FilterPill>
                        <FilterPill active={filter === 'inactive'} onClick={() => setFilter('inactive')}>Nonaktif</FilterPill>
                    </div>
                </div>
                <div className="grow min-h-0">
                    {displayedProducts.length === 0 && query.trim().length > 0 && catalogHits.length > 0 ? (
                        <div className="h-full flex flex-col min-h-0">
                            <div className="px-3 pt-2 pb-1 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                                <PackageSearch className="size-3.5" />
                                Katalog Referensi ({catalogHits.length}) — pilih lalu simpan untuk menjadikannya produk
                            </div>
                            <div className="flex-1 min-h-0 overflow-auto no-scrollbar divide-y divide-border/50">
                                {catalogHits.map(item => (
                                    <CatalogHitRow key={item.id} item={item} onSelect={() => handleCatalogSelect(item)} />
                                ))}
                            </div>
                        </div>
                    ) : (
                        <ProductList
                            products={displayedProducts}
                            viewMode={viewMode}
                            onItemClick={handleSelectProduct}
                            selectedProductId={selectedProductId}
                            context="product"
                        />
                    )}
                </div>
                {window.innerWidth >= 768 && viewMode === 'list' && (
                    <div className="px-3 pb-2 pt-1 flex items-center gap-3 text-[11px] text-muted-foreground shrink-0">
                        <span className="flex items-center gap-1.5"><Package className="size-3.5" /> {displayedProducts.length} produk</span>
                        <span className="flex items-center gap-1">Centang produk untuk mencetak label barcode.</span>
                    </div>
                )}
                <div className="p-3 md:hidden flex gap-2 shrink-0">
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="w-full" disabled={selectedProductIds.size === 0}>
                                <Printer className="mr-2 h-4 w-4" /> Cetak ({selectedProductIds.size})
                            </Button>
                        </DialogTrigger>
                        {printDialogContent}
                    </Dialog>
                </div>
            </div>

            {/* Right Panel: Editor (Desktop) */}
            <aside className="hidden md:block col-span-5 lg:col-span-4 h-full min-h-0">
                <ProductEditor
                    selectedProductId={selectedProductId}
                    onProductUpdate={handleSaveChanges}
                    onClose={handleCloseEditor}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    catalogPrefill={promoCatalog}
                />
            </aside>

            {/* Editor Drawer (Mobile) */}
            <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
                <SheetContent side="right" className="w-full sm:w-125 p-0 flex flex-col">
                    <SheetHeader className="p-4 border-b shrink-0">
                        <SheetTitle>{selectedProductId ? 'Ubah Produk' : promoCatalog ? 'Produk Baru dari Katalog' : 'Tambah Produk'}</SheetTitle>
                    </SheetHeader>
                    <ProductEditor
                        selectedProductId={selectedProductId}
                        onProductUpdate={handleSaveChanges}
                        onClose={handleCloseEditor}
                        activeTab={activeTab}
                        onTabChange={setActiveTab}
                        catalogPrefill={promoCatalog}
                    />
                </SheetContent>
            </Sheet>
        </div>
    );
}

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <Button variant={active ? 'secondary' : 'outline'} size="sm" className="rounded-md px-2.5 h-7 shrink-0 text-xs" onClick={onClick}>
            {children}
        </Button>
    );
}

const formatIDR = (amt: number) => new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
}).format(amt);

function CatalogHitRow({ item, onSelect }: { item: CatalogProduct; onSelect: () => void }) {
    const brandLabel = item.brand || item.generic_name;
    return (
        <div
            role="button"
            tabIndex={0}
            onClick={onSelect}
            onKeyDown={(e) => e.key === 'Enter' && onSelect()}
            className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-accent transition-colors"
        >
            {item.image_url ? (
                <img
                    src={item.image_url}
                    alt={item.name}
                    className="h-10 w-10 shrink-0 rounded-md border border-border/60 object-cover"
                    loading="lazy"
                />
            ) : (
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-border/60 bg-muted/40 text-muted-foreground">
                    <Package className="h-4 w-4" />
                </div>
            )}
            <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.name}</p>
                {brandLabel && (
                    <p className="truncate text-[11px] text-muted-foreground">{brandLabel}</p>
                )}
                <p className="truncate text-[10px] text-muted-foreground/70 font-mono">{item.barcode}</p>
            </div>
            <span className="hidden shrink-0 max-w-[120px] truncate text-[11px] text-muted-foreground sm:block">{item.category_name}</span>
            <Badge variant="outline" className="shrink-0 h-4 px-1.5 text-[10px]">Katalog</Badge>
            <span className="shrink-0 text-sm font-semibold tabular-nums w-20 text-right">{formatIDR(item.price)}</span>
        </div>
    );
}