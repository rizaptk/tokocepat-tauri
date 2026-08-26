import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useStore } from '@/lib/store';
import { useDbStore } from '@/lib/db-store';
import { normalizePromo } from '@/lib/promo-model';
import { Header } from '@/components/Header';
import { Product, CartItem, ProductVariant, Transaction, Promotion } from '@/lib/types';
import { useProductSearch } from '@/lib/useProductSearch';
import { useGlobalBarcodeScanner } from '@/hooks/use-global-barcode-scanner';
import { useToast } from '@/hooks/use-toast';
import { useTableNavigation } from '@/hooks/useTableNavigation';
import { 
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Trash2, ReceiptCent, Printer, CheckCircle2, LogIn, ArrowLeft, XCircle, TicketPercent, Gift, BadgePercent, GitBranch, Handshake } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { VariantPanel } from '@/components/VariantPanel';
import ReturnDialog from '@/components/ReturnDialog';
import { useGlobalKeydown } from '@/hooks/use-global-keydown';
import { usePrintStore } from '@/lib/print-store';
import { usePrinterStore } from '@/lib/print-detect-store';
import { Badge } from '@/components/ui/badge';
import { useCurrencyFormat } from '@/hooks/useCurrencyFormat';
import { voidTransaction } from '@/services/transactionService';
import { evaluateDiscounts } from '@/services/promoService';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { ReceiptTape, type ReceiptSnapshot } from '@/components/ReceiptTape';
import { formatIDR } from '@/lib/format';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

type ItemWithVariant = Product & { _selectedVariant: ProductVariant };

const rowSpring = {
    type: 'spring' as const,
    bounce: 0,
    duration: 0.3,
};

const Kbd = ({ children }: { children: React.ReactNode }) => (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-semibold text-muted-foreground">
        {children}
    </kbd>
);

export default function ClassicCashierPage() {
    const { 
        products, cart, saveItemToCart, updateQuantity, removeFromCart, 
        checkout, activeShift, openShift, storeConfig, transactions,
        parkCart, promos, setPromos, categories
    } = useStore();
    
    const { toast } = useToast();
    const { addToQueue } = usePrintStore();
    const printerEnabled = usePrinterStore(s => s.isEnabled);
    const showTapeWhenDisabled = usePrinterStore(s => s.showTapeWhenDisabled);
    const showVirtualTape = !printerEnabled && showTapeWhenDisabled;
    const reducedMotion = usePrefersReducedMotion();
    const { query, setQuery } = useProductSearch();
    const curr = useCurrencyFormat();
    const openingCash = useCurrencyFormat();

    // Actual redemptions per voucher code, derived from persisted transactions.
    const voucherUsage = useMemo(() => {
        const map: Record<string, number> = {};
        transactions.forEach(tx => {
            if (tx.status === 'paid' && tx.voucher_code) {
                map[tx.voucher_code] = (map[tx.voucher_code] || 0) + 1;
            }
        });
        return map;
    }, [transactions]);
    
    // Refs for keyboard focus
    const cashInputRef = useRef<HTMLInputElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    const [successData, setSuccessData] = useState<ReceiptSnapshot | null>(null);
    const [itemToSelectVariant, setItemToSelectVariant] = useState<Product | null>(null);
    const [searchIndex, setSearchIndex] = useState(-1);

    // --- Discount engine state (voucher + manual cashier discount) ---
    const [voucherCode, setVoucherCode] = useState('');   // applied code (used by engine)
    const [voucherInput, setVoucherInput] = useState(''); // draft typed in the F5 modal
    const [manualDiscountInput, setManualDiscountInput] = useState('');
    const [manualDiscountType, setManualDiscountType] = useState<'persen' | 'flat'>('flat');
    const [manualDiscountTargetItemId, setManualDiscountTargetItemId] = useState<string | null>(null);
    const [isVoucherOpen, setIsVoucherOpen] = useState(false);
    const [isDiscountOpen, setIsDiscountOpen] = useState(false);

    // Resolve an applied voucher code that is missing from the live promos
    // snapshot (brand-new or synced-from-another-device). Primary source is the
    // store; fallback scans the whole `promos` collection client-side so the
    // claim never depends on a field index being present/backfilled.
    useEffect(() => {
        const code = voucherCode.trim().toUpperCase();
        if (!code) return;
        if (promos.some(p => p.kind === 'voucher' && (p.code || '').toUpperCase() === code)) return;
        let cancelled = false;
        const resolve = async () => {
            const { db, firesqlite } = useDbStore.getState();
            if (!db || !firesqlite) return;
            const { collection: coll, query, where, getDocs } = firesqlite;
            const pick = (rows: any[]) =>
                rows.map(r => normalizePromo(r as Promotion))
                    .find(p => p.kind === 'voucher' && (p.code || '').toUpperCase() === code);
            try {
                let found: Promotion | null | undefined = null;
                // 1) Fast path: indexed equality query.
                try {
                    const snap = await getDocs(query(coll(db, 'promos'), where('code', 'eq', code)));
                    found = snap.docs?.[0] ? pick([snap.docs[0].data()]) : null;
                } catch { /* fall through to scan */ }
                // 2) Index-independent full scan (promos stays a tiny collection).
                if (!found) {
                    const all = await getDocs(coll(db, 'promos'));
                    found = all.docs?.length ? pick(all.docs.map((d: any) => d.data())) : null;
                }
                if (!cancelled && found) {
                    const current = useStore.getState().promos;
                    if (!current.some(p => p.id === found!.id)) {
                        setPromos([...current, found]);
                    }
                }
            } catch { /* the snapshot will deliver it eventually */ }
        };
        resolve();
        return () => { cancelled = true; };
    }, [voucherCode, promos]);

    // --- Cart table navigation + in-cell editing ---
    const cartTableRef = useRef<HTMLDivElement>(null);
    const [qtyEditId, setQtyEditId] = useState<string | null>(null);
    const [qtyEditValue, setQtyEditValue] = useState('');
    const [variantEditItem, setVariantEditItem] = useState<Product | null>(null);
    const [variantEditCartId, setVariantEditCartId] = useState<string | null>(null);
    const { activeIndex: cartActiveIndex, setActiveIndex: setCartActiveIndex, activeColumn: cartActiveColumn } = useTableNavigation({
        rowCount: cart.length,
        columnCount: 11, // No | Var | Con | Produk | Merek | Kategori | Stok | Harga | Qty | Subtotal | Hapus
        bindTo: cartTableRef,
        onActivate: (index, column) => {
            const item = cart[index];
            if (!item) return;
            if (column === 1) {
                // Produk column: open variant selector when the item has variants,
                // otherwise start an in-cell qty edit.
                if (item.has_variant) {
                    const base = products.find(p => p.id === item.id);
                    if (base) {
                        setVariantEditItem(base);
                        setVariantEditCartId(item.cartItemId);
                    }
                } else {
                    setQtyEditValue(String(item.quantity));
                    setQtyEditId(item.cartItemId);
                }
            } else if (column === 8) {
                // Qty column (default for any line): start in-cell qty edit
                setQtyEditValue(String(item.quantity));
                setQtyEditId(item.cartItemId);
            } else if (column === 10) {
                removeFromCart(item.cartItemId);
            }
        },
    });

    const openVariantEdit = (item: CartItem) => {
        const base = products.find(p => p.id === item.id);
        if (!base) return;
        setVariantEditItem(base);
        setVariantEditCartId(item.cartItemId);
    };

    const handleQtyCommit = (item: CartItem) => {
        if (qtyEditId !== item.cartItemId) return;
        const qty = Math.max(1, Math.floor(Number(qtyEditValue) || 1));
        updateQuantity(item.cartItemId, qty);
        setQtyEditId(null);
        setQtyEditValue('');
    };

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

    // --- Totals Calculation (discount engine: BOGO + voucher + manual) ---
    const parsedManualDiscount = parseFloat(manualDiscountInput) || 0;

    const discountResult = useMemo(() => {
        if (!storeConfig || cart.length === 0) return null;
        return evaluateDiscounts(cart, storeConfig, promos, {
            voucherCode,
            manualDiscount: parsedManualDiscount,
            manualDiscountType,
            manualDiscountTargetItemId: manualDiscountInput ? (manualDiscountTargetItemId ?? undefined) : undefined,
            usageCounts: voucherUsage,
        });
    }, [cart, storeConfig, promos, voucherCode, parsedManualDiscount, manualDiscountType, manualDiscountTargetItemId, manualDiscountInput, voucherUsage]);

    // The typed draft is committed on ANY modal close (Selesai / Enter / Esc /
    // outside click) so a stray dismissal can never silently drop the code.
    const commitVoucherDraft = () => {
        setVoucherCode(voucherInput.trim().toUpperCase());
    };

    const closeVoucherModal = () => {
        commitVoucherDraft();
        setIsVoucherOpen(false);
    };

    const applyManualDiscount = () => {
        if (cartActiveIndex >= 0) {
            setManualDiscountTargetItemId(cart[cartActiveIndex]?.cartItemId ?? null);
        }
        setIsDiscountOpen(false);
    };

    // When the manual discount modal opens, lock the target to the highlighted
    // row so the live preview reflects the item the cashier sees selected.
    useEffect(() => {
        if (isDiscountOpen && cartActiveIndex >= 0) {
            const item = cart[cartActiveIndex];
            if (item) setManualDiscountTargetItemId(item.cartItemId);
        }
    }, [isDiscountOpen]); // eslint-disable-line react-hooks/exhaustive-deps

    const { subtotal, tax, total, totalQty } = useMemo(() => {
        const qty = cart.reduce((sum, item) => sum + item.quantity, 0);
        if (!discountResult) {
            const sub = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            if (!storeConfig) return { subtotal: sub, tax: sub * 0.11, total: sub + sub * 0.11, totalQty: qty };
            return { subtotal: sub, tax: 0, total: sub, totalQty: qty };
        }
        return {
            subtotal: discountResult.grossSubtotal,
            tax: discountResult.taxAmount,
            total: discountResult.total,
            totalQty: qty,
        };
    }, [cart, discountResult, storeConfig]);

    const hasDiscountError = (discountResult?.errors?.length ?? 0) > 0;

    const reviewingVoucherAmount = reviewingTx?.applied_promos?.find(p => p.kind === 'voucher')?.amount ?? 0;
    const reviewingPromoAmount = (reviewingTx?.promo_discount || 0) - reviewingVoucherAmount;

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


    const change = (parseFloat(curr.raw) || 0) - total;

    const categoryName = (item: CartItem) => categories.find(c => c.id === item.category_id)?.name;

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
        } else {
            saveItemToCart(product);
            cashInputRef.current?.focus();
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

    const [isReturnOpen, setIsReturnOpen] = useState(false);

    useGlobalBarcodeScanner({ enabled: !isReturnOpen, onScan: handleBarcodeScan });

    // --- Keyboard Shortcuts ---
    useGlobalKeydown({ key: 'f1', handler: () => searchInputRef.current?.focus(), enabled: !isReturnOpen });
    useGlobalKeydown({ key: 'f2', handler: () => setIsHistoryOpen(true), enabled: !isReturnOpen });
    useGlobalKeydown({ key: 'f3', handler: handleParkAction, enabled: cart.length > 0 && !isReturnOpen });
    useGlobalKeydown({ key: 'f4', handler: () => setIsReturnOpen(true), enabled: !isHistoryOpen });
    useGlobalKeydown({ key: 'f5', handler: () => { setVoucherInput(voucherCode); setIsVoucherOpen(true); }, enabled: cart.length > 0 && !isReturnOpen && !isDiscountOpen });
    useGlobalKeydown({ key: 'f6', handler: () => { if (cartActiveIndex < 0) setCartActiveIndex(cart.length - 1); setIsDiscountOpen(true); }, enabled: cart.length > 0 && !isReturnOpen && !isVoucherOpen });
    useGlobalKeydown({ key: 'f8', handler: () => {
        const el = cashInputRef.current as HTMLInputElement | null;
        if (document.activeElement === el) {
            el?.blur();
        } else {
            el?.focus();
        }
    }, enabled: true });
    
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


    const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowDown') {
            setSearchIndex(prev => Math.min(prev + 1, searchResults.length - 1));
        } else if (e.key === 'ArrowUp') {
            setSearchIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter' && searchIndex >= 0) {
            handleProductSelect(searchResults[searchIndex]);
        } else if (e.key === 'Escape') {
            e.stopPropagation();
            e.currentTarget.blur();
        }
    };

    // --- Confirmation Handlers ---
    const handleVariantConfirm = (selectedVariant: ProductVariant) => {
        // Editing an existing cart line (variant re-select)
        if (variantEditCartId) {
            const existing = cart.find(i => i.cartItemId === variantEditCartId);
            setVariantEditCartId(null);
            if (existing) {
                saveItemToCart(existing, selectedVariant);
                cashInputRef.current?.focus();
                return;
            }
        }
        const item = itemToSelectVariant;
        setItemToSelectVariant(null);
        if (!item) return;
        const composite: ItemWithVariant = { ...item, price: item.price + selectedVariant.additional_price, _selectedVariant: selectedVariant };
        saveItemToCart(composite, selectedVariant);
        cashInputRef.current?.focus();
    };

    const handleProcessPayment = async () => {
        if (change < 0 || cart.length === 0) return;
        if (hasDiscountError) {
            toast({ variant: "destructive", title: "Promo tidak valid", description: discountResult?.errors?.[0] });
            return;
        }
        try {
            const invoiceNum = `INV-${Date.now().toString().slice(-6)}`;
            const lineDiscounts = new Map((discountResult?.lines ?? []).map(l => [l.cartItemId, l]));
            const snapshot: ReceiptSnapshot = {
                invoice: invoiceNum,
                change,
                cashPaid: parseFloat(curr.raw) || 0,
                items: cart.map(item => ({
                    name: item.name,
                    variant: item.selectedVariant?.name,
                    qty: item.quantity,
                    price: item.price,
                    discount: lineDiscounts.get(item.cartItemId)?.lineDiscount ?? 0,
                })),
                subtotal,
                tax,
                total,
                promoDiscount: discountResult?.promoDiscount ?? 0,
                voucherDiscount: discountResult?.voucherDiscount ?? 0,
                voucherCode: discountResult?.voucherCode ?? (voucherCode || undefined),
                manualDiscount: discountResult?.manualDiscount ?? 0,
                dateISO: new Date().toISOString(),
            };
            await checkout(parseFloat(curr.raw), {
                voucherCode,
                manualDiscount: parsedManualDiscount,
                manualDiscountType,
                manualDiscountTargetItemId: manualDiscountInput ? manualDiscountTargetItemId ?? undefined : undefined,
            });
            // Printer menyala → struk ditangani antrean cetak fisik.
            // Printer nonaktif → hanya tampilkan tape di layar jika opsi diaktifkan;
            // selain itu langsung kembali ke kasir tanpa dokumen.
            if (showVirtualTape) {
                setSuccessData(snapshot);
            }
            curr.setRaw('0');
            setVoucherCode('');
            setVoucherInput('');
            setManualDiscountInput('');
            setManualDiscountTargetItemId(null);
        } catch (error) {
            toast({ variant: "destructive", title: "Gagal memproses pembayaran" });
        }
    };

    // --- Shift Guard ---
    if (!activeShift) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-muted/40 p-4">
                <div className="w-full max-w-sm space-y-6">
                    <div className="text-center space-y-1">
                        <h1 className="text-2xl font-black tracking-tight">Buka Sif Baru</h1>
                        <p className="text-sm text-muted-foreground">Masukkan kas awal untuk mulai melayani.</p>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-5">
                        <div className="space-y-4">
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">Rp</span>
                                <Input 
                                    type="text" inputMode="numeric" value={openingCash.value} 
                                    onChange={openingCash.onChange}
                                    className="pl-10 h-12 text-lg tabular-nums" autoFocus
                                    onKeyDown={(e) => e.key === 'Enter' && openShift(parseInt(openingCash.raw, 10) || 0)}
                                />
                            </div>
                            <Button onClick={() => openShift(parseInt(openingCash.raw, 10) || 0)} className="w-full h-12" disabled={(parseInt(openingCash.raw, 10) || 0) < 0}>
                                <LogIn className="mr-2 h-4 w-4" /> Mulai Sif
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen w-full flex-col overflow-hidden bg-background">
            <Header />

            <div className="flex min-h-0 flex-1 flex-col">
                {/* PAYMENT BAR (full width, above the search bar) */}
                <div className="shrink-0 border-b border-border bg-card px-4 py-2">
                    <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
                        {/* Grand total */}
                        <div className="min-w-44">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Grand Total · {totalQty} item</div>
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={total}
                                    initial={{ opacity: 0, y: reducedMotion ? 0 : 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: reducedMotion ? 0 : -6 }}
                                    transition={reducedMotion ? { duration: 0 } : { type: 'spring', bounce: 0, duration: 0.3 }}
                                    className="text-[2.5rem] font-light leading-none tracking-tight tabular-nums"
                                >
                                    {formatIDR(total)}
                                </motion.div>
                            </AnimatePresence>
                        </div>

                        {/* Summary */}
                        <div className="space-y-0.5 text-sm">
                            <div className="flex justify-between gap-6"><span className="text-muted-foreground">Subtotal</span><span className="font-medium tabular-nums">{formatIDR(subtotal)}</span></div>
                            {discountResult && (
                                <>
                                    {discountResult.promoDiscount > 0 && (
                                        <div className="flex justify-between gap-6 text-success dark:text-success-foreground">
                                            <span>Promo & Voucher</span>
                                            <span className="font-semibold tabular-nums">-{formatIDR(discountResult.promoDiscount)}</span>
                                        </div>
                                    )}
                                    {discountResult.manualDiscount > 0 && (
                                        <div className="flex justify-between gap-6 text-success dark:text-success-foreground">
                                            <span>Diskon Kasir</span>
                                            <span className="font-semibold tabular-nums">-{formatIDR(discountResult.manualDiscount)}</span>
                                        </div>
                                    )}
                                </>
                            )}
                            <div className="flex justify-between gap-6"><span className="text-muted-foreground">Pajak</span><span className="font-medium tabular-nums">{formatIDR(tax)}</span></div>
                            {cart.length > 0 && discountResult && discountResult.freeItems.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1 pt-0.5">
                                    <Gift className="size-3.5 text-success dark:text-success-foreground" />
                                    {discountResult.freeItems.map((f, i) => (
                                        <span key={i} className="rounded bg-success/10 px-1.5 py-0.5 text-[10px] font-semibold text-success-foreground dark:bg-success/20 dark:text-success-foreground">
                                            {f.freeQty}x {f.name} gratis
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Applied voucher / discount chips + errors */}
                        <div className="flex flex-col gap-1">
                            {(voucherCode || manualDiscountInput) && (
                                <div className="flex flex-wrap items-center gap-1.5">
                                    {voucherCode && (
                                        <button onClick={() => setVoucherCode('')} className="group inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-xs font-semibold text-primary" title="Hapus voucher">
                                            <TicketPercent className="size-3.5" /> {voucherCode}
                                            <XCircle className="size-3.5 opacity-60 transition-opacity group-hover:opacity-100" />
                                        </button>
                                    )}
                                    {manualDiscountInput && (
                                        <button onClick={() => { setManualDiscountInput(''); setManualDiscountTargetItemId(null); }} className="group inline-flex items-center gap-1 rounded-md border border-warning/40 bg-warning/10 px-2 py-1 text-xs font-semibold text-warning dark:text-warning-foreground" title="Hapus diskon kasir">
                                            <BadgePercent className="size-3.5" /> {manualDiscountType === 'persen' ? `${manualDiscountInput}%` : formatIDR(parsedManualDiscount)}
                                            {manualDiscountTargetItemId && <span className="hidden sm:inline text-muted-foreground">· {cart.find(c => c.cartItemId === manualDiscountTargetItemId)?.name}</span>}
                                            <XCircle className="size-3.5 opacity-60 transition-opacity group-hover:opacity-100" />
                                        </button>
                                    )}
                                </div>
                            )}
                            {voucherCode && !discountResult?.voucherCode && (
                                <p className="text-[10px] font-medium text-destructive">{discountResult?.errors?.[0] || 'Voucher tidak berlaku'}</p>
                            )}
                        </div>

                        <div className="flex-1" />

                        {/* Quick cash (inline with Bayar label) + cash input + change */}
                        <div className="flex items-end gap-3">
                            <div className="space-y-1">
                                <div className="flex items-baseline gap-1.5">
                                    <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Bayar</Label>
                                    {cashSuggestions.length > 0 && (
                                        <span className="flex items-baseline gap-0.5 text-xs text-muted-foreground">
                                            <span className="mr-0.5">-</span>
                                            {cashSuggestions.map((amt, i) => (
                                                <span key={amt} className="flex items-baseline">
                                                    <button
                                                        type="button"
                                                        className="px-0.5 font-semibold text-foreground/80 underline decoration-dotted underline-offset-2 hover:text-primary"
                                                        onClick={() => curr.setRaw(amt.toString())}
                                                        title={amt === total ? 'Bayar uang pas' : 'Isi uang tunai cepat'}
                                                    >
                                                        {amt === total ? 'Pas' : `${Math.round(amt / 1000)}K`}
                                                    </button>
                                                    {i < cashSuggestions.length - 1 && <span className="mx-0.5 text-muted-foreground">,</span>}
                                                </span>
                                            ))}
                                        </span>
                                    )}
                                </div>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-semibold text-muted-foreground">Rp</span>
                                    <Input
                                        ref={cashInputRef}
                                        type="text"
                                        inputMode='numeric'
                                        aria-label="Uang tunai dibayarkan"
                                        className="h-9 w-40 pl-10 text-base font-bold tracking-tight tabular-nums"
                                        value={curr.value}
                                        onChange={curr.onChange}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleProcessPayment();
                                            if (e.key === 'Escape') { e.currentTarget.blur(); e.stopPropagation(); }
                                        }}
                                    />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <div className="flex h-4 items-end justify-end">
                                    <span className={cn("text-[10px] font-semibold uppercase tracking-widest", change >= 0 ? "text-success-foreground" : "text-warning-foreground")}>
                                        {change >= 0 ? 'Kembalian' : 'Kurang'}
                                    </span>
                                </div>
                                <div className={cn(
                                    "flex h-9 w-40 items-center justify-end overflow-hidden rounded-lg border px-3",
                                    change >= 0 ? "border-success/60 bg-success/40" : "border-warning bg-warning/50"
                                )}>
                                    <span className={cn("truncate text-lg font-bold tabular-nums", change >= 0 ? "text-success-foreground" : "text-warning-foreground")}>
                                        {change < 0 ? "-" : ""}{formatIDR(Math.abs(change))}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-stretch self-stretch">
                            <Button className="h-full min-w-36 px-6 text-base font-black tracking-tight" disabled={change < 0 || cart.length === 0} onClick={handleProcessPayment}>
                                <ReceiptCent className="mr-2 size-5" /> BAYAR
                            </Button>
                        </div>
                    </div>
                </div>

                <main className="flex min-w-0 flex-1 flex-col bg-card">
                    {/* Search bar */}
                    <div className="relative shrink-0 border-b border-border bg-muted/30 px-2.5 py-2">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                            <Input 
                                ref={searchInputRef}
                                placeholder="Cari produk atau scan barcode..."
                                className={cn(
                                    "h-8 pl-8 text-sm",
                                    searchResults.length > 0 ? "rounded-b-none" : ""
                                )}
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={handleSearchKeyDown}
                                autoFocus
                            />
                            {searchResults.length > 0 && (
                                <div role="listbox" className="absolute top-full -left-0.5 -right-0.5 z-50 mt-1 max-h-96 overflow-auto rounded-b-lg border border-t-0 border-border bg-popover shadow-xl">
                                    {searchResults.map((p, i) => (
                                        <div 
                                            key={p.id}
                                            role="option"
                                            aria-selected={searchIndex === i}
                                            className={cn(
                                                "flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-sm transition-colors",
                                                searchIndex === i ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                                            )}
                                            onClick={() => handleProductSelect(p)}
                                        >
                                            <span className="min-w-0 flex-1 truncate font-normal">{p.name}</span>
                                            <span className={cn("w-28 shrink-0 truncate", searchIndex === i ? "text-primary-foreground/70" : "text-muted-foreground")}>{p.brand || '—'}</span>
                                            <span className={cn("w-32 shrink-0 truncate font-mono text-xs", searchIndex === i ? "text-primary-foreground/70" : "text-muted-foreground")}>{p.barcode || 'Tanpa barcode'}</span>
                                            <span className="w-24 shrink-0 text-right font-bold tabular-nums">{formatIDR(p.price)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Cart table */}
                    <div className="min-h-0 flex-1 overflow-auto outline-none" ref={cartTableRef} tabIndex={0}>
                        <Table className="table-fixed">
                            <TableHeader className="sticky top-0 z-10 border-b border-border bg-card">
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="w-10">No</TableHead>
                                    <TableHead className="min-w-40">Produk</TableHead>
                                    <TableHead className="w-8 text-center">Var</TableHead>
                                    <TableHead className="w-8 text-center">Con</TableHead>
                                    <TableHead className="w-28">Merek</TableHead>
                                    <TableHead className="w-24">Kategori</TableHead>
                                    <TableHead className="w-16 text-right">Stok</TableHead>
                                    <TableHead className="w-24 text-right">Harga</TableHead>
                                    <TableHead className="w-20 text-center">Qty</TableHead>
                                    <TableHead className="w-28 text-right">Subtotal</TableHead>
                                    <TableHead className="w-10"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {cart.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={11} className="h-[40vh] text-center text-muted-foreground">
                                            <div className="space-y-1">
                                                <p className="font-medium text-foreground/70">Keranjang kosong</p>
                                                <p className="text-sm">Cari produk, scan barcode, atau tekan <Kbd>F1</Kbd> untuk fokus pencarian.</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    <AnimatePresence initial={false}>
                                        {cart.map((item, idx) => (
                                            <motion.tr
                                                key={item.cartItemId}
                                                layout={!reducedMotion}
                                                initial={{ opacity: 0, x: reducedMotion ? 0 : -16 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, height: 0 }}
                                                transition={reducedMotion ? { duration: 0 } : rowSpring}
                                                className={cn(
                                                    "group bg-card hover:bg-muted/40",
                                                    cartActiveIndex === idx && "bg-muted/40"
                                                )}
                                                onMouseEnter={() => setCartActiveIndex(idx)}
                                            >
                                                <TableCell className={cn(cartActiveIndex === idx && cartActiveColumn === 0 && "bg-primary/10")}>{idx + 1}</TableCell>
                                                <TableCell className={cn("font-normal", cartActiveIndex === idx && cartActiveColumn === 1 && "bg-primary/10")}>
                                                    <div className="truncate">{item.name}</div>
                                                    {item.selectedVariant && (
                                                        <button
                                                            className="mt-0.5 h-4 rounded-sm px-1 text-[10px] font-medium text-primary underline decoration-dotted underline-offset-2 hover:text-primary/80"
                                                            onClick={() => openVariantEdit(item)}
                                                            title="Ganti varian"
                                                            aria-label={`Ganti varian ${item.name}`}
                                                        >
                                                            Var: {item.selectedVariant.name}
                                                        </button>
                                                    )}
                                                </TableCell>
                                                <TableCell className={cn("text-center", cartActiveIndex === idx && cartActiveColumn === 2 && "bg-primary/10")}>
                                                    {item.has_variant ? <span title="Memiliki varian" aria-label="Memiliki varian"><GitBranch className="mx-auto size-3.5 text-muted-foreground" /></span> : null}
                                                </TableCell>
                                                <TableCell className={cn("text-center", cartActiveIndex === idx && cartActiveColumn === 3 && "bg-primary/10")}>
                                                    {item.is_consignment ? <span title="Konsinyasi" aria-label="Konsinyasi"><Handshake className="mx-auto size-3.5 text-warning dark:text-warning-foreground" /></span> : null}
                                                </TableCell>
                                                <TableCell className={cn("whitespace-nowrap text-muted-foreground", cartActiveIndex === idx && cartActiveColumn === 4 && "bg-primary/10")}>
                                                    <span className="truncate">{item.brand || '—'}</span>
                                                </TableCell>
                                                <TableCell className={cn("whitespace-nowrap text-muted-foreground", cartActiveIndex === idx && cartActiveColumn === 5 && "bg-primary/10")}>
                                                    <span className="truncate">{categoryName(item) || '—'}</span>
                                                </TableCell>
                                                <TableCell className={cn("text-right tabular-nums whitespace-nowrap", cartActiveIndex === idx && cartActiveColumn === 6 && "bg-primary/10")}>
                                                    {item.selectedVariant?.stock ?? item.stock}
                                                </TableCell>
                                                <TableCell className={cn("text-right tabular-nums whitespace-nowrap", cartActiveIndex === idx && cartActiveColumn === 7 && "bg-primary/10")}>{formatIDR(item.price)}</TableCell>
                                                <TableCell className={cn("text-center", cartActiveIndex === idx && cartActiveColumn === 8 && "bg-primary/10")}>
                                                    {qtyEditId === item.cartItemId ? (
                                                        <input
                                                            autoFocus
                                                            type="number"
                                                            min={1}
                                                            value={qtyEditValue}
                                                            onChange={(e) => setQtyEditValue(e.target.value)}
                                                            onBlur={() => handleQtyCommit(item)}
                                                            onKeyDown={(e) => {
                                                                e.stopPropagation();
                                                                if (e.key === 'Enter') { e.preventDefault(); handleQtyCommit(item); setCartActiveIndex(-1); }
                                                                if (e.key === 'Escape') { setQtyEditId(null); setQtyEditValue(''); }
                                                            }}
                                                            className="mx-auto block h-7 w-16 rounded-md border-border/70 bg-background text-center text-sm font-bold tabular-nums outline-none ring-1 ring-primary"
                                                        />
                                                    ) : (
                                                        <button
                                                            className={cn(
                                                                "mx-auto block w-16 text-center font-bold tabular-nums rounded",
                                                                cartActiveIndex === idx && "bg-primary/15 ring-1 ring-primary/40"
                                                            )}
                                                            onClick={() => { setQtyEditValue(String(item.quantity)); setQtyEditId(item.cartItemId); }}
                                                            title="Klik untuk ubah jumlah"
                                                            aria-label={`Ubah jumlah ${item.name}`}
                                                        >
                                                            {item.quantity}
                                                        </button>
                                                    )}
                                                </TableCell>
                                                <TableCell className={cn("text-right font-bold tabular-nums whitespace-nowrap", cartActiveIndex === idx && cartActiveColumn === 9 && "bg-primary/10")}>{formatIDR(item.price * item.quantity)}</TableCell>
                                                <TableCell className={cn(cartActiveIndex === idx && cartActiveColumn === 10 && "bg-primary/10")}>
                                                    <Button variant="ghost" size="icon" className={cn("size-7 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100", cartActiveIndex === idx && "opacity-100")} aria-label={`Hapus ${item.name}`} onClick={() => removeFromCart(item.cartItemId)}><Trash2 className="size-4"/></Button>
                                                </TableCell>
                                            </motion.tr>
                                        ))}
                                    </AnimatePresence>
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Shortcut legend */}
                    <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-border bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
                        <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1.5"><Kbd>F1</Kbd> Cari</span>
                            <span className="flex items-center gap-1.5"><Kbd>F2</Kbd> Riwayat</span>
                            <span className="flex items-center gap-1.5"><Kbd>F3</Kbd> Parkir</span>
                            <span className="flex items-center gap-1.5"><Kbd>F4</Kbd> Retur</span>
                            <span className="flex items-center gap-1.5"><Kbd>F5</Kbd> Voucher</span>
                            <span className="flex items-center gap-1.5"><Kbd>F6</Kbd> Diskon</span>
                            <span className="flex items-center gap-1.5"><Kbd>F8</Kbd> Bayar</span>
                        </div>
                        <span className="tabular-nums">{totalQty} items</span>
                    </div>
                </main>
            </div>

            <Dialog open={!!successData} onOpenChange={(open) => !open && setSuccessData(null)}>
                <DialogContent className="sm:max-w-[27rem] border-0 bg-transparent p-0 shadow-none">
                    <DialogTitle className="sr-only">Pembayaran Berhasil</DialogTitle>
                    {successData && (
                        <div className="overflow-hidden rounded-[2px] border border-border bg-background shadow-xl">
                            <div className="flex items-center justify-between border-b border-border py-3.5 pl-5 pr-10">
                                <div className="flex items-center gap-2.5">
                                    <motion.span
                                        initial={{ scale: reducedMotion ? 1 : 0, rotate: reducedMotion ? 0 : -20 }}
                                        animate={{ scale: 1, rotate: 0 }}
                                        transition={reducedMotion ? { duration: 0 } : { type: 'spring', bounce: 0.5, duration: 0.5 }}
                                        className="flex size-8 items-center justify-center rounded-full bg-success text-success-foreground"
                                    >
                                        <CheckCircle2 className="size-5" />
                                    </motion.span>
                                    <div>
                                        <p className="text-sm font-bold leading-none">Pembayaran Berhasil</p>
                                        <p className="mt-1 text-xs text-muted-foreground">{successData.invoice}</p>
                                    </div>
                                </div>
                                <span className="rounded-md bg-muted px-2 py-1 font-mono text-xs tabular-nums">
                                    Kembalian {successData.change < 0 ? '-' : ''}{formatIDR(Math.abs(successData.change))}
                                </span>
                            </div>

                            <div className="relative flex max-h-[54vh] justify-center overflow-y-auto bg-[#0d0e12] px-6 py-10">
                                <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/[0.05] to-transparent" />
                                <ReceiptTape
                                    data={successData}
                                    storeName={storeConfig?.store_name || 'Toko Cepat'}
                                    storeAddress={storeConfig?.address}
                                    footer={storeConfig?.receipt_footer}
                                />
                            </div>

                            <div className="flex justify-center border-t border-border p-4">
                                <Button className="h-11 w-full max-w-[16rem] font-bold" onClick={() => setSuccessData(null)}>
                                    Selesai
                                </Button>
                            </div>
                        </div>
                    )}
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
                                <Button variant="ghost" size="icon" aria-label="Kembali ke daftar riwayat" onClick={() => setReviewingTx(null)}>
                                    <ArrowLeft className="size-5" />
                                </Button>
                            )}
                            <DialogTitle className="text-xl font-semibold">
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
                                                <TableCell className="text-right font-bold tabular-nums">{formatIDR(tx.total)}</TableCell>
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
                                                            <TableCell className="text-right tabular-nums">{formatIDR(it.price_snapshot * it.qty)}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <h4 className="font-bold text-muted-foreground uppercase text-xs tracking-widest">Informasi Pembayaran</h4>
                                        <div className="bg-muted/30 p-4 rounded-lg space-y-2">
                                            <div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{formatIDR(reviewingTx.subtotal)}</span></div>
                                            {reviewingPromoAmount > 0 && (
                                                <div className="flex justify-between text-success dark:text-success-foreground"><span>Promo & Diskon Produk</span><span className="tabular-nums">-{formatIDR(reviewingPromoAmount)}</span></div>
                                            )}
                                            {reviewingTx.voucher_code && reviewingVoucherAmount > 0 && (
                                                <div className="flex justify-between text-success dark:text-success-foreground"><span>Voucher ({reviewingTx.voucher_code})</span><span className="tabular-nums">-{formatIDR(reviewingVoucherAmount)}</span></div>
                                            )}
                                            {(reviewingTx.manual_discount || 0) > 0 && (
                                                <div className="flex justify-between text-success dark:text-success-foreground"><span>Diskon Kasir</span><span className="tabular-nums">-{formatIDR(reviewingTx.manual_discount || 0)}</span></div>
                                            )}
                                            <div className="flex justify-between"><span>Pajak</span><span className="tabular-nums">{formatIDR(reviewingTx.tax_amount)}</span></div>
                                            <div className="flex justify-between font-black text-lg border-t pt-2"><span>Total</span><span className="tabular-nums">{formatIDR(reviewingTx.total)}</span></div>
                                        </div>
                                        
                                        {reviewingTx.status !== 'voided' && reviewingTx.transaction_type !== 'return' && (
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

            {/* --- VOUCHER MODAL (F5) --- */}
            <Dialog open={isVoucherOpen} onOpenChange={(open) => { if (!open) closeVoucherModal(); }}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Kode Voucher</DialogTitle>
                        <DialogDescription>Masukkan kode voucher. Kode diterapkan saat modal ditutup.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="relative">
                            <TicketPercent className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                autoFocus
                                value={voucherInput}
                                onChange={(e) => setVoucherInput(e.target.value.toUpperCase())}
                                placeholder="Mis. HEMAT10"
                                className="h-10 pl-9 pr-9 font-mono uppercase tracking-widest"
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); closeVoucherModal(); } }}
                            />
                            {voucherInput && (
                                <button onClick={() => setVoucherInput('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="Hapus kode voucher" title="Hapus">
                                    <XCircle className="size-4" />
                                </button>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground">Kode baru menggantikan kode yang sedang aktif.</p>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="ghost" onClick={() => { setVoucherCode(''); setVoucherInput(''); setIsVoucherOpen(false); }}>Hapus</Button>
                        <Button onClick={closeVoucherModal}>Selesai</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* --- MANUAL DISCOUNT MODAL (F6) --- */}
            <Dialog open={isDiscountOpen} onOpenChange={(open) => !open && setIsDiscountOpen(false)}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Diskon Kasir</DialogTitle>
                        <DialogDescription>Potongan manual diterapkan hanya ke item yang sedang dipilih (baris ter-highlight).</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
                            <span className="text-muted-foreground">Diterapkan ke: </span>
                            <span className="font-semibold">{cartActiveIndex >= 0 && cart[cartActiveIndex] ? cart[cartActiveIndex].name : '-'}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="relative flex-1">
                                <Input
                                    autoFocus
                                    value={manualDiscountInput}
                                    onChange={(e) => setManualDiscountInput(e.target.value.replace(/[^0-9.]/g, ''))}
                                    placeholder="0"
                                    inputMode="decimal"
                                    className="h-10 text-lg font-semibold tabular-nums"
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyManualDiscount(); } }}
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => setManualDiscountType(t => t === 'flat' ? 'persen' : 'flat')}
                                aria-pressed={true}
                                title={manualDiscountType === 'flat' ? 'Diskon dalam Rupiah — klik untuk persen' : 'Diskon dalam persen — klik untuk Rupiah'}
                                className="flex h-10 w-14 shrink-0 items-center justify-center rounded-md border border-border text-xs font-bold transition-colors bg-muted text-foreground hover:border-primary/50 hover:text-primary"
                            >
                                {manualDiscountType === 'flat' ? 'Rp' : '%'}
                            </button>
                        </div>
                        {manualDiscountInput && discountResult && discountResult.manualDiscount > 0 && (
                            <div className="flex items-center justify-between rounded-md bg-warning/10 px-3 py-2 text-sm">
                                <span className="font-medium text-warning dark:text-warning-foreground">Diskon Kasir</span>
                                <span className="font-bold tabular-nums text-warning dark:text-warning-foreground">-{formatIDR(discountResult.manualDiscount)}</span>
                            </div>
                        )}
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="ghost" onClick={() => { setManualDiscountInput(''); setManualDiscountTargetItemId(null); setIsDiscountOpen(false); }}>Hapus</Button>
                        <Button onClick={applyManualDiscount}>Selesai</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <VariantPanel item={itemToSelectVariant} onOpenChange={(open) => !open && setItemToSelectVariant(null)} onConfirm={handleVariantConfirm} />
            <VariantPanel item={variantEditItem} onOpenChange={(open) => { if (!open) { setVariantEditItem(null); setVariantEditCartId(null); } }} onConfirm={handleVariantConfirm} />

            <ReturnDialog open={isReturnOpen} onOpenChange={setIsReturnOpen} />
        </div>
    );
}