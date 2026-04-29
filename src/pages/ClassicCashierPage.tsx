import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useStore } from '@/lib/store';
import { Header } from '@/components/Header';
import { Product, CartItem, SelectedModifier, ProductVariant, StoreConfig, Transaction } from '@/lib/types';
import { useProductSearch } from '@/lib/useProductSearch';
import { useGlobalBarcodeScanner } from '@/hooks/use-global-barcode-scanner';
import { useToast } from '@/hooks/use-toast';
import { 
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Trash2, Plus, Minus, ReceiptCent, Printer, CheckCircle2, LogIn, Settings2, ParkingSquare, ArrowLeft, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { VariantPanel } from '@/components/VariantPanel';
import { ModifierPanel } from '@/components/ModifierPanel';
import { useGlobalKeydown } from '@/hooks/use-global-keydown';
import { usePrintStore } from '@/lib/print-store';
import { Badge } from '@/components/ui/badge';
import { useCurrencyFormat } from '@/hooks/useCurrencyFormat';
import { ScrollArea } from '@/components/ui/scroll-area';
import { voidTransaction } from '@/services/transactionService';
import { format } from 'date-fns';

const formatIDR = (amt: number) => new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0 
}).format(amt);

type ItemWithVariant = Product & { _selectedVariant: ProductVariant };

// Helper function for accurate tax calculation based on store settings
const getTaxRateForItem = (item: CartItem | Product, storeConfig: StoreConfig): number => {
    const { tax_settings, tax_rate } = storeConfig;
    if (!tax_settings) return tax_rate;
    if (item.category_id) {
        const override = tax_settings.category_overrides.find(co => co.category_id === item.category_id);
        if (override && typeof override.tax_rate === 'number') return override.tax_rate;
    }
    return tax_settings.default_rate;
};

export default function ClassicCashierPage() {
    const { 
        products, cart, saveItemToCart, updateQuantity, removeFromCart, 
        checkout, activeShift, openShift, storeConfig, transactions,
        parkCart
    } = useStore();
    
    const { toast } = useToast();
    const { addToQueue } = usePrintStore();
    const { query, setQuery } = useProductSearch();
    const curr = useCurrencyFormat();
    
    // Refs for keyboard focus
    const cashInputRef = useRef<HTMLInputElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    
    const [openingCash, setOpeningCash] = useState(0);
    const [cashReceived, setCashReceived] = useState<string>('');
    const [successData, setSuccessData] = useState<{ change: number, invoice: string } | null>(null);
    const [itemToSelectVariant, setItemToSelectVariant] = useState<Product | null>(null);
    const [itemToModify, setItemToModify] = useState<Product | CartItem | ItemWithVariant | null>(null);
    const [searchIndex, setSearchIndex] = useState(-1);

    // --- History State ---
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [reviewingTx, setReviewingTx] = useState<Transaction | null>(null);
    const [voidReason, setVoidReason] = useState("");
    const [isVoiding, setIsVoiding] = useState(false);


    const shiftTransactions = useMemo(() => 
        transactions.filter(t => t.shift_id === activeShift?.id).sort((a, b) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ), 
    [transactions, activeShift]);

    // --- Search Logic ---
    const searchResults = useMemo(() => {
        if (!query) return [];
        return products.filter(p => 
            p.name.toLowerCase().includes(query.toLowerCase()) || 
            p.barcode?.includes(query)
        ).slice(0, 8);
    }, [products, query]);

    useEffect(() => { setSearchIndex(-1); }, [query]);

    // --- Totals Calculation ---
    const { subtotal, tax, total, totalQty } = useMemo(() => {
        const sub = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const taxAmt = cart.reduce((taxSum, item) => {
            if (!storeConfig) return taxSum + (item.price * item.quantity * 0.11);
            const rate = getTaxRateForItem(item, storeConfig);
            return taxSum + (item.price * item.quantity * rate);
        }, 0);
        const qty = cart.reduce((sum, item) => sum + item.quantity, 0);
        return { subtotal: sub, tax: taxAmt, total: sub + taxAmt, totalQty: qty };
    }, [cart, storeConfig]);

    // --- ADAPTED: Smart Cash Suggestions (from PaymentModal.tsx) ---
    const cashSuggestions = useMemo(() => {
        if (!total || total <= 0) return [];
        const ceil20 = Math.ceil(total / 20000) * 20000;
        const ceil50 = Math.ceil(total / 50000) * 50000;
        const remainder100 = total % 100000;

        if (remainder100 >= 120000 - 100000 && remainder100 < 50000) {
            return [total, ceil50];
        }
        const diffTo50 = ceil50 - total;
        if (diffTo50 <= 5000) {
            return [total, ceil50];
        }
        const result: number[] = [ceil20];
        if (ceil50 !== ceil20) result.push(ceil50);
        
        return [total, ...result.slice(0, 2)];
    }, [total]);


    const change = (parseFloat(cashReceived) || 0) - total;

    const handleParkAction = () => {
        if (cart.length > 0) {
            parkCart();
            toast({ title: "Transaksi Diparkir", description: "Gunakan menu Parkir di header untuk memulihkan." });
        }
    };

    // --- Product Selection Flow ---
    const handleProductSelect = useCallback((product: Product) => {
        if (!activeShift) return;
        setQuery('');
        if (product.has_variant) {
            setItemToSelectVariant(product);
        } else if (product.has_modifier) {
            setItemToModify(product);
        } else {
            saveItemToCart(product);
        }
    }, [activeShift, saveItemToCart, setQuery]);

    const handleBarcodeScan = (barcode: string) => {
        const product = products.find(p => p.barcode === barcode && p.is_active);
        if (product) {
            handleProductSelect(product);
        } else {
            toast({ variant: "destructive", title: "Produk tidak ditemukan", description: barcode });
        }
    };

    useGlobalBarcodeScanner({ onScan: handleBarcodeScan });

    // --- Keyboard Shortcuts ---
    useGlobalKeydown({ key: 'f1', handler: () => searchInputRef.current?.focus(), enabled: true });
    useGlobalKeydown({ key: 'f2', handler: () => setIsHistoryOpen(true), enabled: true });
    useGlobalKeydown({ key: 'f3', handler: handleParkAction, enabled: cart.length > 0 });
    useGlobalKeydown({ key: 'f8', handler: () => cashInputRef.current?.focus(), enabled: true });
    
    const handleVoid = async () => {
        if (!reviewingTx || !voidReason.trim()) return;
        setIsVoiding(true);
        try {
            await voidTransaction(reviewingTx.id, voidReason);
            toast({ title: 'Transaksi Dibatalkan', description: `Invoice ${reviewingTx.invoice_number} berhasil di-void.` });
            setReviewingTx(null);
            setVoidReason("");
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Gagal Void', description: error.message });
        } finally {
            setIsVoiding(false);
        }
    };


    const handleSearchKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            setSearchIndex(prev => Math.min(prev + 1, searchResults.length - 1));
        } else if (e.key === 'ArrowUp') {
            setSearchIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter' && searchIndex >= 0) {
            handleProductSelect(searchResults[searchIndex]);
        }
    };

    // --- Confirmation Handlers ---
    const handleVariantConfirm = (selectedVariant: ProductVariant) => {
        const item = itemToSelectVariant;
        setItemToSelectVariant(null);
        if (!item) return;
        const composite: ItemWithVariant = { ...item, price: item.price + selectedVariant.additional_price, _selectedVariant: selectedVariant };
        if (item.has_modifier) setItemToModify(composite);
        else saveItemToCart(composite, [], selectedVariant);
    };

    const handleModifierConfirm = (selectedModifiers: SelectedModifier[]) => {
        if (!itemToModify) return;
        const item = itemToModify;
        const selectedVariant = '_selectedVariant' in item ? (item as ItemWithVariant)._selectedVariant : undefined;
        saveItemToCart(item, selectedModifiers, selectedVariant);
        setItemToModify(null);
    };

    const handleProcessPayment = async () => {
        if (change < 0 || cart.length === 0) return;
        try {
            const invoiceNum = `INV-${Date.now().toString().slice(-6)}`;
            await checkout(parseFloat(cashReceived));
            setSuccessData({ change, invoice: invoiceNum });
            // setCashReceived('');
            curr.setRaw('0');
        } catch (error) {
            toast({ variant: "destructive", title: "Gagal memproses pembayaran" });
        }
    };

    useEffect(() => {
        setCashReceived(curr.raw);
    },[curr.raw])

    // --- Shift Guard ---
    if (!activeShift) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-muted/40 p-4">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle>Buka Sif Baru</CardTitle>
                        <CardDescription>Masukkan kas awal untuk memulai.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">Rp</span>
                            <Input 
                                type="number" value={openingCash || ''} 
                                onChange={(e) => setOpeningCash(Number(e.target.value))}
                                className="pl-10 text-lg" autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && openShift(openingCash)}
                            />
                        </div>
                        <Button onClick={() => openShift(openingCash)} className="w-full" disabled={openingCash < 0}>
                            <LogIn className="mr-2 h-4 w-4" /> Mulai Sif
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="h-screen w-full flex flex-col bg-muted/20">
            <Header />

            <div className="flex-1 grid grid-cols-12 overflow-hidden p-4 gap-4">
                {/* LEFT: CART TABLE */}
                <main className="col-span-8 flex flex-col gap-4 min-h-0">
                    <Card className="flex-1 flex flex-col min-h-0 shadow-sm border-none">
                        <div className="p-4 border-b bg-card rounded-t-md">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                                <Input 
                                    ref={searchInputRef}
                                    placeholder="Cari Produk atau Scan Barcode (F1)..." 
                                    className={`pl-10 h-12 text-lg ${searchResults.length > 0 ? 'rounded-b-none' : ''}`}
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    onKeyDown={handleSearchKeyDown}
                                    autoFocus
                                />
                                {searchResults.length > 0 && (
                                    <div className="absolute top-full -left-0.5 -right-0.5 z-50 mt-1 bg-popover border rounded-b-md shadow-xl ring-2 ring-primary">
                                        {searchResults.map((p, i) => (
                                            <div 
                                                key={p.id}
                                                className={cn(
                                                    "p-3 cursor-pointer flex justify-between items-center border-b last:border-0",
                                                    searchIndex === i ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                                                )}
                                                onClick={() => handleProductSelect(p)}
                                            >
                                                <div>
                                                    <p className="font-medium">{p.name}</p>
                                                    <p className={cn("text-xs", searchIndex === i ? "text-primary-foreground/80" : "text-muted-foreground")}>{p.barcode || 'Tanpa Barcode'}</p>
                                                </div>
                                                <p className="font-bold">{formatIDR(p.price)}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto">
                            <Table>
                                <TableHeader className="sticky top-0 bg-card z-10 shadow-sm">
                                    <TableRow>
                                        <TableHead className="w-12.5">No</TableHead>
                                        <TableHead>Produk</TableHead>
                                        <TableHead className="text-right">Harga</TableHead>
                                        <TableHead className="text-center w-37.5">Qty</TableHead>
                                        <TableHead className="text-right">Subtotal</TableHead>
                                        <TableHead className="w-10"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {cart.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="h-64 text-center text-muted-foreground">
                                                Belum ada item. Scan barcode atau cari produk.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        cart.map((item, idx) => (
                                            <TableRow key={item.cartItemId} className="group">
                                                <TableCell>{idx + 1}</TableCell>
                                                <TableCell className="font-medium">
                                                    <div>{item.name}</div>
                                                    {item.selectedVariant && <Badge variant="outline" className="text-[10px] h-4 px-1 mt-1">Var: {item.selectedVariant.name}</Badge>}
                                                    {item.selectedModifiers && item.selectedModifiers.length > 0 && (
                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                            {item.selectedModifiers.map(mod => (
                                                                <Badge key={`${mod.groupId}-${mod.item.id}`} variant="warning" className="text-[10px] font-normal px-1 py-0 opacity-90 hover:opacity-100 border-none text-warning-foreground">
                                                                    {mod.item.name} {mod.item.additional_price > 0 && `(+${mod.item.additional_price/1000}k)`}
                                                                </Badge>
                                                            ))}
                                                            <Button variant="ghost" size="icon" className="size-4 rounded-full" onClick={() => setItemToModify(item)}>
                                                                <Settings2 className="size-3" />
                                                            </Button>
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">{formatIDR(item.price)}</TableCell>
                                                <TableCell>
                                                    <div className="flex items-center justify-center gap-2">
                                                        <Button variant="ghost" size="icon" className="size-8" onClick={() => updateQuantity(item.cartItemId, Math.max(1, item.quantity - 1))}><Minus className="size-3"/></Button>
                                                        <span className="w-6 text-center font-bold">{item.quantity}</span>
                                                        <Button variant="ghost" size="icon" className="size-8" onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)}><Plus className="size-3"/></Button>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right font-bold">{formatIDR(item.price * item.quantity)}</TableCell>
                                                <TableCell>
                                                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100" onClick={() => removeFromCart(item.cartItemId)}><Trash2 className="size-4"/></Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </Card>
                </main>

                {/* RIGHT: PAYMENT PANEL */}
                <aside className="col-span-4 flex flex-col gap-4 min-h-0">
                    <Card className="border-none shadow-md bg-primary text-primary-foreground">
                        <CardContent className="p-5">
                            <div className="text-xs font-bold uppercase tracking-widest opacity-80 mb-1">Grand Total ({totalQty} Item)</div>
                            <div className="text-4xl font-black tabular-nums">{formatIDR(total)}</div>
                        </CardContent>
                    </Card>

                    <Card className="flex-1 border-none shadow-xl flex flex-col bg-card min-h-0">
                        <CardContent className="flex-1 flex flex-col min-h-0 py-6 px-0">
                            <ScrollArea className='flex-1 w-full min-h-0'>
                                <div className='flex flex-col min-h-0 space-y-6 px-5'>
                                    <div className="space-y-3">
                                        <div className="flex justify-between text-xs font-medium text-muted-foreground uppercase tracking-tighter">Ringkasan</div>
                                        <div className="flex justify-between text-sm"><span>Subtotal</span><span>{formatIDR(subtotal)}</span></div>
                                        <div className="flex justify-between text-sm"><span>Pajak</span><span>{formatIDR(tax)}</span></div>
                                        <div className="grid grid-cols-3 gap-2 mt-6 border-t border-border pt-6">
                                            {cashSuggestions.map(amt => (
                                                <Button key={amt} variant="outline" size="sm" className="font-bold text-xs" onClick={() => curr.setRaw(amt.toString())}>
                                                    {amt === total ? "Uang Pas" : formatIDR(amt)}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-2 flex-1">
                                        <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Bayar Tunai (F8)</Label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-muted-foreground">Rp</span>
                                            <Input 
                                                ref={cashInputRef} 
                                                type="text"
                                                inputMode='numeric'
                                                className="h-14 text-xl! font-black pl-12 bg-muted/10 border-2 focus-visible:ring-primary"
                                                value={curr.value}
                                                onChange={curr.onChange}
                                                onKeyDown={(e) => e.key === 'Enter' && handleProcessPayment()}
                                            />
                                        </div>
                                    </div>

                                    <div className={cn("p-4 rounded-xl flex justify-end items-center border-2", change >= 0 ? "bg-success/50 border-success" : "bg-warning/50 border-warning")}>
                                        <span className={cn("text-2xl font-black truncate", change >= 0 ? "text-success-foreground" : "text-warning-foreground")}>{change >= 0 ? "" : "-"}{formatIDR(Math.abs(change))}</span>
                                    </div>

                                    <div className="mt-auto space-y-3">
                                        <div className="grid grid-cols-2 gap-2">
                                            <Button variant="secondary" className="font-bold h-14" onClick={handleParkAction} disabled={cart.length === 0}>
                                                <ParkingSquare className="mr-2 size-4" /> Parkir (F3)
                                            </Button>
                                            <Button className="h-14 text-xl font-black" disabled={change < 0 || cart.length === 0} onClick={handleProcessPayment}>
                                                <ReceiptCent className="mr-3 size-7" /> BAYAR
                                            </Button>
                                            {/* <Button variant="ghost" className="font-bold h-11 text-muted-foreground" onClick={clearCart}>BATAL</Button> */}
                                        </div>
                                    </div>
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </aside>
            </div>

            <Dialog open={!!successData} onOpenChange={(open) => !open && setSuccessData(null)}>
                <DialogContent className="sm:max-w-md text-center py-10">
                    <div className="flex justify-center mb-4"><CheckCircle2 className="size-16 text-green-500" /></div>
                    <DialogTitle className="text-2xl">Pembayaran Berhasil</DialogTitle>
                    <div className="bg-muted p-6 rounded-xl my-4">
                        <p className="text-sm text-muted-foreground mb-1 uppercase font-bold tracking-widest">Kembalian</p>
                        <p className="text-5xl font-black text-primary">{formatIDR(successData?.change || 0)}</p>
                    </div>
                    <div className="flex gap-3">
                        <Button variant="outline" className="flex-1 h-12" onClick={() => setSuccessData(null)}>Selesai</Button>
                        {/* <Button className="flex-1 h-12" onClick={() => addToQueue({} as any)}> <Printer className="mr-2 size-4" /> Cetak Struk</Button> */}
                    </div>
                </DialogContent>
            </Dialog>

            {/* --- TRANSACTION HISTORY DIALOG --- */}
            <Dialog open={isHistoryOpen} onOpenChange={(open) => {
                setIsHistoryOpen(open);
                if(!open) setReviewingTx(null);
            }}>
                <DialogContent className="sm:max-w-4xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
                    <DialogHeader className="p-6 border-b flex flex-row items-center justify-between">
                        <div className="flex items-center gap-4">
                            {reviewingTx && (
                                <Button variant="ghost" size="icon" onClick={() => setReviewingTx(null)}>
                                    <ArrowLeft className="size-5" />
                                </Button>
                            )}
                            <DialogTitle className="text-2xl font-black">
                                {reviewingTx ? `Detail ${reviewingTx.invoice_number}` : 'Riwayat Transaksi (Sif Ini)'}
                            </DialogTitle>
                        </div>
                    </DialogHeader>

                    <div className="flex-1 overflow-auto p-0">
                        {!reviewingTx ? (
                            <Table>
                                <TableHeader className="bg-muted/50">
                                    <TableRow>
                                        <TableHead>Waktu</TableHead>
                                        <TableHead>Invoice</TableHead>
                                        <TableHead className="text-right">Total</TableHead>
                                        <TableHead className="text-center">Status</TableHead>
                                        <TableHead className="w-25"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {shiftTransactions.length === 0 ? (
                                        <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground">Belum ada transaksi di sif ini.</TableCell></TableRow>
                                    ) : (
                                        shiftTransactions.map(tx => (
                                            <TableRow key={tx.id} className="cursor-pointer hover:bg-accent" onClick={() => setReviewingTx(tx)}>
                                                <TableCell>{format(new Date(tx.created_at), 'p')}</TableCell>
                                                <TableCell className="font-bold">{tx.invoice_number}</TableCell>
                                                <TableCell className="text-right font-bold">{formatIDR(tx.total)}</TableCell>
                                                <TableCell className="text-center">
                                                    <Badge variant={tx.status === 'paid' ? 'success' : 'destructive'}>
                                                        {tx.status.toUpperCase()}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell><Button variant="outline" size="sm">Detail</Button></TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        ) : (
                            <div className="p-6 space-y-6">
                                <div className="grid grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <h4 className="font-bold text-muted-foreground uppercase text-xs tracking-widest">Item Pesanan</h4>
                                        <div className="border rounded-lg overflow-hidden">
                                            <Table>
                                                <TableBody>
                                                    {reviewingTx.items.map((it, idx) => (
                                                        <TableRow key={idx}>
                                                            <TableCell>{it.qty}x {it.product_snapshot.name}</TableCell>
                                                            <TableCell className="text-right">{formatIDR(it.price_snapshot * it.qty)}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <h4 className="font-bold text-muted-foreground uppercase text-xs tracking-widest">Informasi Pembayaran</h4>
                                        <div className="bg-muted/30 p-4 rounded-lg space-y-2">
                                            <div className="flex justify-between"><span>Subtotal</span><span>{formatIDR(reviewingTx.total)}</span></div>
                                            <div className="flex justify-between font-black text-lg border-t pt-2"><span>Total</span><span>{formatIDR(reviewingTx.total)}</span></div>
                                        </div>
                                        
                                        {reviewingTx.status !== 'voided' && (
                                            <div className="pt-4 border-t space-y-3">
                                                <Label className="text-destructive font-bold">Void Transaksi</Label>
                                                <Input 
                                                    placeholder="Alasan pembatalan..." 
                                                    value={voidReason} 
                                                    onChange={(e) => setVoidReason(e.target.value)} 
                                                />
                                                <Button 
                                                    variant="destructive" 
                                                    className="w-full" 
                                                    disabled={!voidReason || isVoiding}
                                                    onClick={handleVoid}
                                                >
                                                    <XCircle className="mr-2 size-4" /> Konfirmasi Pembatalan
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    <DialogFooter className="p-4 border-t bg-muted/20">
                        <Button variant="ghost" onClick={() => setIsHistoryOpen(false)}>Tutup (Esc)</Button>
                        {reviewingTx && <Button onClick={() => addToQueue(reviewingTx)}><Printer className="mr-2 size-4"/> Cetak Ulang Struk</Button>}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <VariantPanel item={itemToSelectVariant} onOpenChange={(open) => !open && setItemToSelectVariant(null)} onConfirm={handleVariantConfirm} />
            <ModifierPanel item={itemToModify} onOpenChange={(open) => !open && setItemToModify(null)} onConfirm={handleModifierConfirm} />
        </div>
    );
}