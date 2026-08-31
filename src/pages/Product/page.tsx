import { useState, useMemo, useRef, useEffect } from "react";
import { useStore } from "@/lib/store";
import { Product, CatalogProduct } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { invoke } from '@tauri-apps/api/core';
import { useDbStore } from '@/lib/db-store';

// UI Components
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ProductSearchBar } from "@/components/ProductSearchBar";
import { ProductList } from "@/components/ProductList";
import { buildBarcodeStickersPdfBytes } from "@/lib/export";
import { PdfPreviewSheet } from "@/components/PdfPreviewSheet";
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
import { cn } from "@/lib/utils";


// Icons
import { Printer, Package, Loader2 } from "lucide-react";

// Services
import { useGlobalBarcodeScanner } from "@/hooks/use-global-barcode-scanner";

// Sub-components
import { ProductEditor } from "./_components/ProductEditor";
import { useSelectedProduct } from "@/lib/product-select-store";
import { useProductSearch } from "@/lib/useProductSearch";
import { useCatalogSearch, getCatalogItemByBarcode } from "@/lib/useCatalogSearch";
import { PackageSearch } from "lucide-react";


export default function ProductManagementPage() {
    const { products } = useStore();
    const { toast } = useToast();
    const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
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
    const pdf = usePdfGeneration();
    const [isGenerating, setIsGenerating] = useState(false);

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

    const handleSelectProduct = (product: Product) => {
        setSelectedProductId(product.id);
        setActiveTab("product");
    };

    const handlePrintLabels = async () => {
        if (selectedProducts.length === 0) {
            toast({
                variant: "destructive",
                title: "Tidak Ada Produk Terpilih",
                description: "Silakan pilih produk yang memiliki barcode untuk mencetak label.",
            });
            return;
        }
        setIsGenerating(true);
        try {
            pdf.setTitle('Label Barcode');
            pdf.setFilename('barcodestickers.pdf');
            pdf.start('Label Barcode');
            await new Promise(r => setTimeout(r, 30));
            const bytes = await buildBarcodeStickersPdfBytes(selectedProducts, {
                repeat: printOptions.repeat,
                labelWidthMm: printOptions.labelWidthMm,
                labelHeightMm: printOptions.labelHeightMm,
                pageSize: paperSizeMap[printOptions.pageSizeName],
            });
            pdf.finish(bytes as unknown as Uint8Array);
        } catch (e: any) {
            toast({ variant: "destructive", title: "Gagal cetak", description: String(e?.message || e) });
        } finally {
            setIsGenerating(false);
        }
    };


    const handleBarcodeScan = async (barcode: string) => {
        const product = products.find(p => p.barcode === barcode || p.sku === barcode);
        if (product) {
            handleSelectProduct(product);
            return;
        }
        // Fall back to the bundled catalog for reference (lazy, cached).
        const catalogItem = await getCatalogItemByBarcode(barcode);
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
    }

    const handleSaveChanges = () => {
        setSelectedProductId(null);
        setPromoCatalog(null);
        // data will refetch via zustand listener, no need for manual refresh
    }

    const handleCloseEditor = () => {
        clearSelected();
        setSelectedProductId(null);
        setPromoCatalog(null);
    }

    const [filter, setFilter] = useState('all');
    const [searchMode, setSearchMode] = useState<'product' | 'catalog'>('product');
    const [catalogReady, setCatalogReady] = useState<boolean | null>(null);
    const [catalogImporting, setCatalogImporting] = useState(false);

    // Lazy: import catalog only on first visit to Katalog tab, show loading until cached
    useEffect(() => {
        if (searchMode !== 'catalog' || catalogReady !== null) return;
        let cancelled = false;
        (async () => {
            const { db, firesqlite } = useDbStore.getState();
            if (!db || !firesqlite) { if (!cancelled) setCatalogReady(true); return; }
            try {
                const { doc, getDoc } = firesqlite;
                const snap = await getDoc(doc(db, 'app_state', 'catalog_import'));
                if (!cancelled && snap.exists()) { setCatalogReady(true); return; }
            } catch {}
            if (cancelled) return;
            setCatalogImporting(true);
            try {
                await invoke<number>('import_catalog');
                if (!cancelled) setCatalogReady(true);
            } catch (e) {
                console.warn('Catalog import failed', e);
                if (!cancelled) setCatalogReady(true); // allow search to try anyway (cache may still load)
            } finally {
                if (!cancelled) setCatalogImporting(false);
            }
        })();
        return () => { cancelled = true; };
    }, [searchMode, catalogReady]);

    const catalogListRef = useRef<HTMLDivElement>(null);

    // Jump keyboard focus from the search bar into the catalog result list.
    const handleCatalogArrowNav = (dir: 'down' | 'up') => {
        if (searchMode !== 'catalog' || filteredCatalogHits.length === 0) return;
        const container = catalogListRef.current;
        if (!container) return;
        const items = Array.from(container.querySelectorAll<HTMLElement>('[data-catalog-row]'));
        if (items.length === 0) return;
        items[dir === 'down' ? 0 : items.length - 1].focus();
    };

    // Catalog: lazy only when Katalog tab active + query — keeps app start fast.
    const { hits: catalogHits, loading: catalogLoading } = useCatalogSearch(query, searchMode === 'catalog');
    const catalogLoadingCombined = catalogImporting || catalogLoading;

    // Never suggest a catalog item that is already a product (same barcode).
    const filteredCatalogHits = useMemo(() => {
        const productBarcodes = new Set(products.map(p => p.barcode).filter(Boolean));
        return catalogHits.filter(item => !productBarcodes.has(item.barcode));
    }, [catalogHits, products]);

    // Infinite scroll: render the first `catalogVisibleCount` hits, then load
    // more in batches as the user scrolls the catalog result list.
    const CATALOG_PAGE_SIZE = 40;
    const [catalogVisibleCount, setCatalogVisibleCount] = useState(CATALOG_PAGE_SIZE);
    const catalogSentinelRef = useRef<HTMLDivElement>(null);
    const catalogScrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setCatalogVisibleCount(CATALOG_PAGE_SIZE);
    }, [query]);

    useEffect(() => {
        const sentinel = catalogSentinelRef.current;
        const scrollRoot = catalogScrollRef.current;
        if (!sentinel || !scrollRoot) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0]?.isIntersecting) {
                    setCatalogVisibleCount(prev => Math.min(prev + CATALOG_PAGE_SIZE, filteredCatalogHits.length));
                }
            },
            { root: scrollRoot, rootMargin: '200px' }
        );
        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [query, filteredCatalogHits.length]);

    const visibleCatalogHits = useMemo(
        () => filteredCatalogHits.slice(0, catalogVisibleCount),
        [filteredCatalogHits, catalogVisibleCount]
    );

    const displayedProducts = useMemo(() => {
        let items = [...products];
        if (filter === 'all') {
            items = items.filter(p => p.is_active);
        }
        else if (filter === 'retail') {
            items = items.filter(p => p.is_active);
        }
        else if (filter === 'wholesale') {
            items = items.filter(p => p.isWholesaleEnabled && p.is_active);
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
        <Button variant="outline" size="sm" className="hidden md:flex relative rounded-md h-8 shrink-0" aria-label="Cetak label barcode" disabled={selectedProductIds.size === 0}>
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
                <Button size="sm" onClick={handlePrintLabels} disabled={isGenerating}>
                    {isGenerating ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Printer className="mr-1.5 h-4 w-4" />} Cetak {totalLabels} Label
                </Button>
            </DialogFooter>
        </DialogContent>
    );

    return (
        <div className="w-full h-[calc(100vh-3rem)] grid grid-cols-10 min-h-0">
            {/* Left Panel: Product List */}
            <div className="col-span-5 lg:col-span-6 h-full flex flex-col min-h-0">
                <div className="px-3 pt-3 pb-2 flex flex-col w-full gap-2">
                    <div className="flex items-center gap-2">
                        <ProductSearchBar
                            onBarcodeScan={handleBarcodeScan}
                            onArrowNav={handleCatalogArrowNav}
                        />
                        <Dialog>
                            <DialogTrigger asChild>{dlgTrigger}</DialogTrigger>
                            {printDialogContent}
                        </Dialog>
                    </div>

                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                        <div className="flex items-center gap-1.5 bg-muted/60 rounded-md p-1 shrink-0">
                            <PillButton
                                active={searchMode === 'product'}
                                onClick={() => setSearchMode('product')}
                            >
                                <Package className="size-3.5" /> Produk
                            </PillButton>
                            <PillButton
                                active={searchMode === 'catalog'}
                                onClick={() => setSearchMode('catalog')}
                            >
                                <PackageSearch className="size-3.5" /> Katalog
                            </PillButton>
                        </div>
                        <Separator orientation="vertical" className="h-4 my-auto" />
                        {searchMode === 'product' ? (
                            <>
                                <FilterPill active={filter === 'all'} onClick={() => setFilter('all')}>Semua (Aktif)</FilterPill>
                                <FilterPill active={filter === 'retail'} onClick={() => setFilter('retail')}>Retail</FilterPill>
                                <FilterPill active={filter === 'wholesale'} onClick={() => setFilter('wholesale')}>Grosir</FilterPill>
                                <Separator orientation="vertical" className="h-4 my-auto" />
                                <FilterPill active={filter === 'consignment'} onClick={() => setFilter('consignment')}>Konsinyasi</FilterPill>
                                <FilterPill active={filter === 'variants'} onClick={() => setFilter('variants')}>Varian</FilterPill>
                                <FilterPill active={filter === 'inactive'} onClick={() => setFilter('inactive')}>Nonaktif</FilterPill>
                            </>
                        ) : null}
                    </div>
                </div>
                <div className="grow min-h-0">
                    {searchMode === 'product' ? (
                        query.trim().length > 0 ? (
                            <div className="h-full flex flex-col min-h-0">
                                {displayedProducts.length > 0 && (
                                    <div className="min-h-0 flex-1">
                                        <div className="px-3 pt-2 pb-1 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                                            <Package className="size-3.5" />
                                            Produk ({displayedProducts.length})
                                        </div>
                                        <ProductList
                                            products={displayedProducts}
                                            viewMode="list"
                                            onItemClick={handleSelectProduct}
                                            selectedProductId={selectedProductId}
                                            context="product"
                                        />
                                    </div>
                                )}

                                {displayedProducts.length === 0 && (
                                    <div className="flex-1 flex items-center justify-center text-center">
                                        <div>
                                            <h2 className="text-xl font-semibold">Tidak Ditemukan di Produk</h2>
                                            <p className="text-muted-foreground mt-1">
                                                Tidak ada produk toko yang cocok. Coba cari di <b>Katalog Referensi</b> untuk melihat & menambahkan produk baru.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <ProductList
                                products={displayedProducts}
                                viewMode="list"
                                onItemClick={handleSelectProduct}
                                selectedProductId={selectedProductId}
                                context="product"
                            />
                        )
                    ) : (
                        /* ----------------------------- CATALOG MODE ----------------------------- */
                        query.trim().length > 0 ? (
                            <div className="h-full flex flex-col min-h-0">
                                {catalogLoadingCombined ? (
                                    <div className="flex-1 flex items-center justify-center text-center">
                                        <div>
                                            <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />
                                            <p className="text-muted-foreground mt-2 text-sm">{catalogImporting ? 'Mengimpor katalog 11k... (sekali saja)' : 'Memuat katalog referensi...'}</p>
                                            {catalogImporting && <p className="text-xs text-muted-foreground/70 mt-1">Cache ke kastoko.db — tetap bisa pakai tab Produk</p>}
                                        </div>
                                    </div>
                                ) : filteredCatalogHits.length > 0 ? (
                                    <div ref={catalogScrollRef} className="min-h-0 flex-1 overflow-auto no-scrollbar">
                                        <div className="px-3 pt-2 pb-1 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                                            <PackageSearch className="size-3.5" />
                                            Katalog Referensi ({filteredCatalogHits.length}) — pilih lalu simpan untuk menjadikannya produk
                                        </div>
                                        <div
                                            ref={catalogListRef}
                                            className="divide-y divide-border/50"
                                            onKeyDown={(e) => {
                                                if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
                                                e.preventDefault();
                                                const items = Array.from(
                                                    (e.currentTarget as HTMLDivElement).querySelectorAll<HTMLElement>('[data-catalog-row]')
                                                );
                                                if (items.length === 0) return;
                                                const idx = items.indexOf(document.activeElement as HTMLElement);
                                                const target =
                                                    idx === -1
                                                        ? (e.key === 'ArrowDown' ? items[0] : items[items.length - 1])
                                                        : (e.key === 'ArrowDown' ? items[Math.min(idx + 1, items.length - 1)] : items[Math.max(idx - 1, 0)]);
                                                target.focus();
                                            }}
                                        >
                                            {visibleCatalogHits.map(item => (
                                                <CatalogHitRow key={item.id} item={item} onSelect={() => handleCatalogSelect(item)} />
                                            ))}
                                            {visibleCatalogHits.length < filteredCatalogHits.length && (
                                                <div ref={catalogSentinelRef} className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground">
                                                    <Loader2 className="size-3.5 animate-spin" /> Memuat lebih banyak...
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex-1 flex items-center justify-center text-center">
                                        <div>
                                            <h2 className="text-xl font-semibold">Tidak Ditemukan di Katalog</h2>
                                            <p className="text-muted-foreground mt-1">
                                                Tidak ada item katalog referensi yang cocok. Coba kata kunci lain atau pindah ke mode <b>Produk</b>.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="h-full flex items-center justify-center text-center">
                                <div>
                                    <PackageSearch className="mx-auto size-8 text-muted-foreground" />
                                    <h2 className="text-lg font-semibold mt-2">Cari di Katalog Referensi</h2>
                                    <p className="text-muted-foreground mt-1 text-sm max-w-60">
                                        Ketik nama, barcode, merek, atau generik untuk mencari katalog. Pilih item lalu simpan untuk menjadikannya produk toko.
                                    </p>
                                </div>
                            </div>
                        )
                    )}
                </div>
                {window.innerWidth >= 768 && (
                    <div className="px-3 pb-2 pt-1 flex items-center gap-3 text-[11px] text-muted-foreground shrink-0">
                        <span className="flex items-center gap-1.5">
                            {searchMode === 'catalog'
                                ? <><PackageSearch className="size-3.5" /> Katalog referensi (pencarian langsung di katalog)</>
                                : <><Package className="size-3.5" /> {displayedProducts.length} produk</>}
                        </span>
                        {searchMode === 'product' && (
                            <span className="flex items-center gap-1">Centang produk untuk mencetak label barcode.</span>
                        )}
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

            {/* Right Panel: Editor */}
            <aside className="col-span-5 lg:col-span-4 h-full min-h-0">
                <ProductEditor
                    selectedProductId={selectedProductId}
                    onProductUpdate={handleSaveChanges}
                    onClose={handleCloseEditor}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    catalogPrefill={promoCatalog}
                />
            </aside>
            <PdfPreviewSheet open={pdf.previewOpen} onOpenChange={pdf.setPreviewOpen} pdfBytes={pdf.pdfBytes} title={`Label Barcode — ${selectedProducts.length} produk`} filename={`barcode_labels_${selectedProducts.length}produk.pdf`} />
            <PdfGeneratingOverlay open={pdf.open} onCancel={pdf.cancel} title={pdf.title} elapsedMs={pdf.elapsedMs} pageCount={pdf.pageCount} />
        </div>
    );
}

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <Button
            variant="ghost"
            size="sm"
            className={cn(
                "rounded-md px-2.5 h-7 shrink-0 text-xs",
                active ? "bg-background text-foreground ring-1 ring-inset ring-border" : "text-muted-foreground hover:text-foreground"
            )}
            aria-pressed={active}
            onClick={onClick}
        >
            {children}
        </Button>
    );
}

function PillButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <Button
            variant="ghost"
            size="sm"
            className={cn(
                "rounded-md px-2.5 h-7 shrink-0 text-xs gap-1.5",
                active ? "bg-background text-foreground ring-1 ring-inset ring-border" : "text-muted-foreground hover:text-foreground"
            )}
            aria-pressed={active}
            onClick={onClick}
        >
            {children}
        </Button>
    );
}

import { formatIDR } from "@/lib/format";
import { usePdfGeneration, PdfGeneratingOverlay } from '@/hooks/usePdfGeneration';

function CatalogHitRow({ item, onSelect }: { item: CatalogProduct; onSelect: () => void }) {
    const brandLabel = item.brand || item.generic_name;
    return (
        <div
            role="button"
            tabIndex={0}
            data-catalog-row
            onClick={onSelect}
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    onSelect();
                }
            }}
            className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-accent focus-visible:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset transition-colors"
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