import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useStore } from '@/lib/store';
import { useDbStore } from '@/lib/db-store';
import { normalizePromo, isPromoLive } from '@/lib/promo-model';
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
import { SearchDropdown } from '@/components/SearchDropdown';
import { Button } from '@/components/ui/button';
import { Search, Trash2, ReceiptCent, Printer, CheckCircle2, LogIn, ArrowLeft, XCircle, TicketPercent, GitBranch, Handshake, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { VariantPanel } from '@/components/VariantPanel';
import ReturnDialog from '@/components/ReturnDialog';
import { useGlobalKeydown } from '@/hooks/use-global-keydown';
import { usePrintStore } from '@/lib/print-store';
import { usePrinterStore } from '@/lib/print-detect-store';
import { Badge } from '@/components/ui/badge';
import { useCurrencyFormat } from '@/hooks/useCurrencyFormat';
import { voidTransaction, isVoidBlockedByPiutang } from '@/services/transactionService';
import { evaluateDiscounts } from '@/services/promoService';
import { DEFAULT_STORE_CONFIG } from '@/lib/defaults';
import { normalizeProductUoms } from '@/lib/uom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { ReceiptTape, type ReceiptSnapshot } from '@/components/ReceiptTape';
import { formatIDR, formatCompactIDR, isCompactable } from '@/lib/format';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { FileText } from 'lucide-react';
import { usePdfGeneration, PdfGeneratingOverlay } from '@/hooks/usePdfGeneration';
import { PdfPreviewSheet } from '@/components/PdfPreviewSheet';
import { buildFakturPdfBytes } from '@/lib/fakturPdf';

type ItemWithVariant = Product & { _selectedVariant: ProductVariant };



const Kbd = ({ children }: { children: React.ReactNode }) => (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-semibold text-muted-foreground">
        {children}
    </kbd>
);

export default function ClassicCashierPage({ defaultWholesale = false }: { defaultWholesale?: boolean } = {}) {
    const { 
        products, cart, saveItemToCart, updateQuantity, updateCartItemUom, removeFromCart, clearCart,
        checkout, activeShift, openShift, storeConfig, transactions,
        parkCart, promos, setPromos, categories, customers, customerGroups
    } = useStore();
    const [isWholesaleMode, setIsWholesaleMode] = useState(defaultWholesale);
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
    
    const { toast } = useToast();
    const { addToQueue } = usePrintStore();
    const printerEnabled = usePrinterStore(s => s.isEnabled);
    const showTapeWhenDisabled = usePrinterStore(s => s.showTapeWhenDisabled);
    const showVirtualTape = !printerEnabled && showTapeWhenDisabled;
    const reducedMotion = usePrefersReducedMotion();
    const fakturPdf = usePdfGeneration();
    const { query, setQuery } = useProductSearch();
    const curr = useCurrencyFormat();
    const openingCash = useCurrencyFormat();
    const [openingCashierName, setOpeningCashierName] = useState('');

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

    const selectedCustomer = useMemo(() => customers.find(c => c.id === selectedCustomerId) || null, [customers, selectedCustomerId]);
    const selectedGroupId = selectedCustomer?.groupId || undefined;
    const [customerQuery, setCustomerQuery] = useState('');

    const handleWholesaleToggle = (checked: boolean) => {
        const needsConfirm = cart.length > 0 && checked !== isWholesaleMode;
        if (needsConfirm) {
            if (!confirm('Ganti mode akan mengosongkan keranjang. Lanjutkan?')) return;
            clearCart();
        } else if (checked !== isWholesaleMode) {
            toast({ title: checked ? 'Mode Grosir Aktif' : 'Mode Grosir Nonaktif', description: checked ? 'Harga grosir & pelanggan aktif' : 'Kembali ke mode retail' });
        }
        setIsWholesaleMode(checked);
        if (!checked) setSelectedCustomerId(null);
    };

    // Re-price cart when customer group changes in wholesale mode (Group Base -> Qty Tier) — lock to base Pcs
    useEffect(() => {
        if (!isWholesaleMode || cart.length === 0) return;
        for (const it of cart) {
            if ((it as any).isReserved) continue;
            const norm = normalizeProductUoms(it as any);
            const baseId = norm.uoms?.find(u=>u.isBase)?.id;
            if (baseId) updateCartItemUom(it.cartItemId, baseId, selectedGroupId);
        }
    }, [selectedGroupId, isWholesaleMode]); // eslint-disable-line react-hooks/exhaustive-deps

    const [successData, setSuccessData] = useState<ReceiptSnapshot | null>(null);
    const [itemToSelectVariant, setItemToSelectVariant] = useState<Product | null>(null);
    const [searchIndex, setSearchIndex] = useState(-1);

    // --- Discount engine state (voucher + manual cashier discount) ---
    const [voucherCode, setVoucherCode] = useState('');   // applied code (used by engine)
    const [voucherInput, setVoucherInput] = useState(''); // draft typed in the F5 modal
    const [voucherClaimMsg, setVoucherClaimMsg] = useState<string | null>(null);
    const [voucherResolving, setVoucherResolving] = useState(false);
    const [manualDiscountInput, setManualDiscountInput] = useState('');
    const [manualDiscountType, setManualDiscountType] = useState<'persen' | 'flat'>('flat');
    const [manualDiscountTargetItemId, setManualDiscountTargetItemId] = useState<string | null>(null);
    const [isVoucherOpen, setIsVoucherOpen] = useState(false);
    const [isDiscountOpen, setIsDiscountOpen] = useState(false);

    // Deterministic voucher claim: resolve the code (store snapshot first, then an
    // index-free scan of the whole `promos` collection), validate it, and either
    // apply it or keep the modal open with the exact reason. Claiming can never
    // fail silently.
    const claimVoucher = async () => {
        if (voucherResolving) return;
        const code = voucherInput.trim().toUpperCase();
        if (!code) {
            setVoucherCode('');
            setVoucherClaimMsg(null);
            setIsVoucherOpen(false);
            return;
        }
        setVoucherResolving(true);
        try {
            let promo = promos.find(p => p.kind === 'voucher' && (p.code || '').toUpperCase() === code);
            if (!promo) {
                const { db, firesqlite } = useDbStore.getState();
                if (db && firesqlite) {
                    const { collection: coll, getDocs } = firesqlite;
                    const all = await getDocs(coll(db, 'promos'));
                    const row = (all.docs || [])
                        .map((d: any) => normalizePromo(d.data() as Promotion))
                        .find(p => p.kind === 'voucher' && (p.code || '').toUpperCase() === code);
                    if (row) {
                        const current = useStore.getState().promos;
                        if (!current.some(p => p.id === row.id)) setPromos([...current, row]);
                        promo = row;
                    }
                }
            }
            if (!promo) {
                setVoucherClaimMsg(`Kode "${code}" tidak ditemukan. Buat voucher di menu Promo & Voucher terlebih dahulu.`);
                return;
            }
            if (!promo.is_active) {
                setVoucherClaimMsg(`Voucher "${promo.name}" sedang nonaktif. Aktifkan di menu Promo & Voucher.`);
                return;
            }
            const now = Date.now();
            const startMs = promo.starts_at ? new Date(promo.starts_at).getTime() : 0;
            const endMs = promo.ends_at ? new Date(promo.ends_at).getTime() : Number.POSITIVE_INFINITY;
            if (startMs > now) {
                setVoucherClaimMsg(`Voucher "${promo.name}" baru berlaku mulai ${format(new Date(startMs), "d MMM, HH:mm")}.`);
                return;
            }
            if (endMs <= now) {
                setVoucherClaimMsg(`Voucher "${promo.name}" sudah kedaluwarsa (${format(new Date(endMs), "d MMM, HH:mm")}).`);
                return;
            }
            setVoucherCode(code);
            setVoucherClaimMsg(null);
            setIsVoucherOpen(false);
        } catch {
            setVoucherClaimMsg('Gagal memeriksa kode voucher. Coba lagi.');
        } finally {
            setVoucherResolving(false);
        }
    };

    // --- Cart table navigation + in-cell editing ---
    const cartTableRef = useRef<HTMLDivElement>(null);
    const [qtyEditId, setQtyEditId] = useState<string | null>(null);
    const [qtyEditValue, setQtyEditValue] = useState('');
    const [uomEditId, setUomEditId] = useState<string | null>(null);
    const [variantEditItem, setVariantEditItem] = useState<Product | null>(null);
    const [variantEditCartId, setVariantEditCartId] = useState<string | null>(null);
    const { activeIndex: cartActiveIndex, setActiveIndex: setCartActiveIndex, activeColumn: cartActiveColumn, setActiveColumn: setCartActiveColumn } = useTableNavigation({
        rowCount: cart.length,
        columnCount: 12, // No | Produk | Var | Con | Merek | Kategori | Harga | Satuan | Qty | Diskon | Subtotal | Hapus
        bindTo: cartTableRef,
        enabled: qtyEditId === null && uomEditId === null,
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
            } else if (column === 7) {
                const norm = normalizeProductUoms(item as any);
                if (!isWholesaleMode && (norm.uoms?.length || 0) > 1) setUomEditId(item.cartItemId);
            } else if (column === 8) {
                // Qty column (default for any line): start in-cell qty edit
                setQtyEditValue(String(item.quantity));
                setQtyEditId(item.cartItemId);
            } else if (column === 11) {
                removeFromCart(item.cartItemId);
            }
        },
    });

    // Auto-highlight newly added / qty-increased product to Qty column
    const prevCartIdsRef = useRef<string[]>([]);
    const prevCartQtysRef = useRef<Record<string, number>>({});
    useEffect(() => {
        const currIds = cart.map(c=>c.cartItemId);
        const currQtys: Record<string, number> = {};
        cart.forEach(c=> currQtys[c.cartItemId]=c.quantity);
        if (currIds.length===0) { prevCartIdsRef.current=[]; prevCartQtysRef.current={}; return; }
        let targetId: string | null = null;
        const newId = currIds.find(id=>!prevCartIdsRef.current.includes(id));
        if (newId) targetId=newId;
        else {
            for (const id of currIds) {
                if ((currQtys[id]||0) > (prevCartQtysRef.current[id]||0)) { targetId=id; break; }
            }
        }
        if (targetId) {
            const idx = currIds.indexOf(targetId);
            if (idx>=0) {
                setCartActiveIndex(idx);
                setCartActiveColumn(8);
                cartTableRef.current?.focus();
            }
        }
        prevCartIdsRef.current=currIds;
        prevCartQtysRef.current=currQtys;
    }, [cart]);

    const openVariantEdit = (item: CartItem) => {
        const base = products.find(p => p.id === item.id);
        if (!base) return;
        setVariantEditItem(base);
        setVariantEditCartId(item.cartItemId);
    };

    const handleQtyCommit = (item: CartItem) => {
        if (qtyEditId !== item.cartItemId) return;
        const qty = Math.max(1, Math.floor(Number(qtyEditValue) || 1));
        updateQuantity(item.cartItemId, qty, selectedGroupId);
        setQtyEditId(null);
        setQtyEditValue('');
        const idx = cart.findIndex(c=>c.cartItemId===item.cartItemId);
        if (idx>=0) { setCartActiveIndex(idx); setCartActiveColumn(8); requestAnimationFrame(()=> cartTableRef.current?.focus()); }
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
        let filtered = products;
        if (isWholesaleMode) filtered = filtered.filter(p => (p as any).isWholesaleEnabled);
        return filtered.filter(p => 
            p.name.toLowerCase().includes(query.toLowerCase()) || 
            p.barcode?.includes(query)
        ).slice(0, 8);
    }, [products, query, isWholesaleMode]);

    useEffect(() => { setSearchIndex(-1); }, [query]);

    // --- Totals Calculation (discount engine: BOGO + voucher + manual) ---
    // A missing store config must never disable the engine — fall back to the
    // default (DbProvider seeds the real doc on boot).
    const activeStoreConfig = storeConfig ?? DEFAULT_STORE_CONFIG;
    const parsedManualDiscount = parseFloat(manualDiscountInput) || 0;

    const discountResult = useMemo(() => {
        if (cart.length === 0) return null;
        return evaluateDiscounts(cart, activeStoreConfig, promos, {
            voucherCode,
            manualDiscount: parsedManualDiscount,
            manualDiscountType,
            manualDiscountTargetItemId: manualDiscountInput ? (manualDiscountTargetItemId ?? undefined) : undefined,
            usageCounts: voucherUsage,
        });
    }, [cart, activeStoreConfig, promos, voucherCode, parsedManualDiscount, manualDiscountType, manualDiscountTargetItemId, manualDiscountInput, voucherUsage]);

    // Auto-add free product shopping line when a bonus_promo (BOGO different free
    // product, criteria `bonus_product`, or conditional `bonus_product`) triggers.
    // We add a regular shopping line (not reserved) so the cart never shows
    // duplicate rows; `evaluateDiscounts` will mark those units as `freeQty` on
    // the new line, and the renderer paints qty / discount in success color.
    useEffect(() => {
        if (cart.length === 0) return;
        const cartQtyBaseById: Record<string, number> = {};
        cart.filter(c => !(c as any).isReserved).forEach(c => {
            const anyC = c as any;
            const base = anyC.qtyBase ?? c.quantity * (anyC.selectedUomFactor || 1);
            cartQtyBaseById[c.id] = (cartQtyBaseById[c.id] || 0) + base;
        });
        const cartIds = new Set(cart.filter(c => !(c as any).isReserved).map(c => c.id));
        const shoppingBaseTotal = cart.filter(c => !(c as any).isReserved).reduce((s, l) => s + ((l as any).qtyBase ?? l.quantity), 0);
        const shoppingPriceTotal = cart.filter(c => !(c as any).isReserved).reduce((s, c) => s + (c.price * c.quantity), 0);

        const bonusPromos = promos.filter(p => {
            if (!p.is_active) return false;
            if (isWholesaleMode && !(p as any).allowWholesale) return false;
            if (!isPromoLive(p)) return false;
            if (p.kind === 'bogo') return !!(p as any).free_product_id;
            if (p.kind === 'criteria' || p.kind === 'conditional') return (p as any).reward_type === 'bonus_product';
            return false;
        });
        if (bonusPromos.length === 0) return;

        // For each bonus promo compute grant list, then ensure a shopping line exists
        // for each free product with at least `grant` quantity. The engine will
        // apply freeQty=grant to those units so the customer doesn't pay for them.
        let needsSync = false;
        const actions: { promoId: string; freeProductId: string; grant: number; existingCartItemId?: string }[] = [];

        for (const promo of bonusPromos) {
            const anyP = promo as any;
            let rewardIds: string[] = [];
            let grants: number[] = [];

            if (promo.kind === 'bogo') {
                const freeProductId: string = anyP.free_product_id;
                if (!freeProductId) continue;
                const buyQty = Math.max(1, anyP.buy_quantity || 1);
                const freeQty = Math.max(1, anyP.free_quantity || 1);
                const cap = anyP.max_total_free_qty && anyP.max_total_free_qty > 0 ? anyP.max_total_free_qty : Infinity;
                const scopeIds: string[] = anyP.applies_to_product_ids || [];
                const purchased = scopeIds.length === 0
                    ? shoppingBaseTotal
                    : scopeIds.reduce((s, pid) => s + (cartQtyBaseById[pid] || 0), 0);
                if (purchased < buyQty) continue;
                const grant = Math.min(Math.floor(purchased / buyQty) * freeQty, cap);
                if (grant <= 0) continue;
                rewardIds = [freeProductId];
                grants = [grant];
            } else {
                rewardIds = anyP.reward_product_ids || [];
                if (rewardIds.length === 0) continue;
                let triggerMet = false;
                if (promo.kind === 'criteria') {
                    const pids: string[] = anyP.applies_to_product_ids || [];
                    const cids: string[] = anyP.applies_to_category_ids || [];
                    if (pids.length === 0 && cids.length === 0) triggerMet = true;
                    else {
                        triggerMet = pids.every((pid: string) => cartIds.has(pid))
                            && cids.every((cid: string) => cart.some(c => (c as any).category_id === cid && !(c as any).isReserved));
                        if (triggerMet && anyP.min_scope_qty > 0) {
                            const total = (pids.length ? pids.reduce((s, pid) => s + (cartQtyBaseById[pid] || 0), 0) : 0)
                                + (cids.length ? cart.filter(c => cids.includes((c as any).category_id)).reduce((s, c) => s + ((c as any).qtyBase || c.quantity), 0) : 0);
                            if (total < anyP.min_scope_qty) triggerMet = false;
                        }
                    }
                } else if (promo.kind === 'conditional') {
                    const minMet = !anyP.min_purchase || shoppingPriceTotal >= anyP.min_purchase;
                    const scopeMet = !anyP.require_scope
                        || ((anyP.applies_to_product_ids || []).length === 0 && (anyP.applies_to_category_ids || []).length === 0)
                        || (anyP.applies_to_product_ids || []).some((pid: string) => cartIds.has(pid));
                    triggerMet = minMet && scopeMet;
                }
                if (!triggerMet) continue;
                // criteria/conditional bonus: 1 unit per reward product (clamped by max_bonus_qty)
                const cap = anyP.max_bonus_qty && anyP.max_bonus_qty > 0 ? anyP.max_bonus_qty : rewardIds.length;
                grants = rewardIds.map(() => 1).slice(0, cap);
            }

            for (let i = 0; i < rewardIds.length; i++) {
                const rid = rewardIds[i];
                const grant = grants[i] || 1;
                if (grant <= 0) continue;
                const existing = cart.find(c => c.id === rid && !(c as any).isReserved);
                if (!existing) {
                    actions.push({ promoId: promo.id, freeProductId: rid, grant });
                    needsSync = true;
                } else if (existing.quantity < grant) {
                    actions.push({ promoId: promo.id, freeProductId: rid, grant, existingCartItemId: existing.cartItemId });
                    needsSync = true;
                }
            }
        }

        if (!needsSync) return;

        queueMicrotask(() => {
            for (const act of actions) {
                if (act.existingCartItemId) {
                    useStore.getState().updateQuantity(act.existingCartItemId, act.grant, undefined, { force: true } as any);
                } else {
                    const prod = products.find(p => p.id === act.freeProductId);
                    if (!prod) continue;
                    useStore.getState().saveItemToCart(prod as any);
                    const added = [...useStore.getState().cart].reverse().find(c => c.id === act.freeProductId && !(c as any).isReserved);
                    if (added && added.quantity !== act.grant) {
                        useStore.getState().updateQuantity(added.cartItemId, act.grant, undefined, { force: true } as any);
                    }
                }
            }
        });
    }, [cart, promos, isWholesaleMode, products]);

    // The typed draft is committed only through claimVoucher (Selesai / Enter) so
    // every claim is validated; Esc / outside click cancels without changes.

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
        if (isWholesaleMode) {
            const cust = customers.find(c => c.id === barcode || c.phone === barcode || (c as any).barcode === barcode);
            if (cust) {
                setSelectedCustomerId(cust.id);
                toast({ title: "Pelanggan dipilih", description: `${cust.name} · ${customerGroups.find(g=>g.id===cust.groupId)?.name || ''}` });
                return;
            }
        }
        const product = products.find(p => p.barcode === barcode && p.is_active);
        if (product) {
            if (isWholesaleMode && !(product as any).isWholesaleEnabled) {
                toast({ variant: "destructive", title: "Produk bukan grosir", description: `${product.name} tidak support grosir` });
                return;
            }
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
    useGlobalKeydown({ key: 'f5', handler: () => { setVoucherInput(voucherCode); setVoucherClaimMsg(null); setIsVoucherOpen(true); }, enabled: cart.length > 0 && !isReturnOpen && !isDiscountOpen });
    useGlobalKeydown({ key: 'f6', handler: () => { if (cartActiveIndex < 0) setCartActiveIndex(cart.length - 1); setIsDiscountOpen(true); }, enabled: cart.length > 0 && !isReturnOpen && !isVoucherOpen });
    useGlobalKeydown({ key: 'f9', handler: () => handleWholesaleToggle(!isWholesaleMode), enabled: !isReturnOpen && !isHistoryOpen });
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
        const block = isVoidBlockedByPiutang(reviewingTx as any);
        if (block.blocked) { toast({ variant: 'destructive', title: 'Void diblokir', description: block.reason }); return; }
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
        const isWholesalePiutang = isWholesaleMode && !!selectedCustomerId;
        if (isWholesaleMode && !selectedCustomerId && change < 0) {
            toast({ variant: "destructive", title: "Grosir tanpa pelanggan harus tunai", description: "Pilih pelanggan untuk piutang atau lunasi pembayaran." });
            return;
        }
        if ((!isWholesalePiutang && change < 0) || cart.length === 0) return;
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
                items: cart.map(item => {
                    const ln = lineDiscounts.get(item.cartItemId);
                    const free = ln?.freeQty || 0;
                    return {
                        name: item.name,
                        variant: item.selectedVariant?.name,
                        qty: item.quantity,
                        price: item.price,
                        discount: ln?.lineDiscount ?? 0,
                        bonusLabel: free > 0 ? `${free} bonus` : undefined,
                    };
                }),
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
                isWholesale: isWholesaleMode,
                customerId: selectedCustomerId || undefined,
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

    const handleCetakFaktur = async (tx: Transaction) => {
        try {
            const anyTx = tx as any;
            const cust = anyTx.customer_id ? customers.find(c => c.id === anyTx.customer_id) || null : null;
            const shiftDoc = anyTx.shift_id ? (useStore.getState().shifts.find(s => s.id === anyTx.shift_id) || null) : null;
            fakturPdf.setTitle('Faktur Penjualan');
            fakturPdf.setFilename(`faktur-${tx.invoice_number}.pdf`);
            fakturPdf.start('Faktur Penjualan');
            await new Promise(r => setTimeout(r, 30));
            const bytes = await buildFakturPdfBytes(tx, storeConfig, cust, shiftDoc);
            fakturPdf.finish(bytes);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Gagal cetak faktur', description: e?.message || String(e) });
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
                            <div className="space-y-1.5">
                                <Label htmlFor="opening-cashier">Nama Kasir *</Label>
                                <Input id="opening-cashier" value={openingCashierName} onChange={e => setOpeningCashierName(e.target.value)} placeholder="cth. Riza / Andi / Siti" className="h-11" autoFocus />
                            </div>
                            <div className="relative">
                                <Label htmlFor="opening-cash" className="sr-only">Kas Awal</Label>
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">Rp</span>
                                <Input 
                                    id="opening-cash"
                                    type="text" inputMode="numeric" value={openingCash.value} 
                                    onChange={openingCash.onChange}
                                    className="pl-10 h-12 text-lg tabular-nums"
                                    onKeyDown={(e) => e.key === 'Enter' && openingCashierName.trim() && openShift(parseInt(openingCash.raw, 10) || 0, openingCashierName.trim())}
                                />
                            </div>
                            <Button onClick={() => openShift(parseInt(openingCash.raw, 10) || 0, openingCashierName.trim())} className="w-full h-12" disabled={!openingCashierName.trim() || (parseInt(openingCash.raw, 10) || 0) < 0}>
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
                            <div className="text-[2.5rem] font-light leading-none tracking-tight tabular-nums tabular-nums">
                                    {formatIDR(total)}
                                </div>
                        </div>

                        {/* Summary */}
                        <div className="space-y-0.5 text-sm">
                            <div className={cn("flex justify-between gap-6", (discountResult?.discountTotal||0) > 0 ? "text-success dark:text-success-foreground" : "text-muted-foreground/50")}>
                                <span>Diskon</span>
                                <span className="font-semibold tabular-nums">-{formatIDR(discountResult?.discountTotal||0)}</span>
                            </div>
                            <div className="flex justify-between gap-6"><span className="text-muted-foreground">Subtotal</span>
                                <span className="font-medium tabular-nums">
                                    {(discountResult?.discountTotal||0) > 0 ? (
                                        <span><span className="line-through text-muted-foreground/50 mr-1.5 text-xs font-normal">{formatIDR(subtotal)}</span>{formatIDR(subtotal - (discountResult?.discountTotal||0))}</span>
                                    ) : formatIDR(subtotal)}
                                </span>
                            </div>
                            <div className="flex justify-between gap-6"><span className="text-muted-foreground">Pajak</span><span className="font-medium tabular-nums">{formatIDR(tax)}</span></div>
                        </div>

                        {/* Applied voucher — dynamic wrap max 3 lines, static totals stay fixed */}
                        <div className="flex flex-col gap-1 max-w-[28rem] max-h-[3.75rem] overflow-hidden">
                            {voucherCode && (
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <button onClick={() => setVoucherCode('')} className="group inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-xs font-semibold text-primary" title="Hapus voucher">
                                        <TicketPercent className="size-3.5" /> {voucherCode}
                                        <XCircle className="size-3.5 opacity-60 transition-opacity group-hover:opacity-100" />
                                    </button>
                                </div>
                            )}
                            
                            {voucherCode && !discountResult?.voucherCode && (
                                <p className="text-[10px] font-medium text-destructive">{discountResult?.errors?.[0] || `Voucher ${voucherCode} tidak dapat diterapkan`}</p>
                            )}
                        </div>

                        <div className="flex-1" />

                        {/* Quick cash (inline with Bayar label) + cash input + change */}
                        <div className="flex items-end gap-3">
                            <div className="space-y-1">
                                <div className="flex items-baseline gap-1.5">
                                    <Label htmlFor="cash-pay-input" className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Bayar</Label>
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
                                    <span aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-semibold text-muted-foreground">Rp</span>
                                    <Input
                                        ref={cashInputRef}
                                        id="cash-pay-input"
                                        type="text"
                                        inputMode='numeric'
                                        aria-label="Uang tunai dibayarkan"
                                        aria-describedby={change < 0 ? "cash-shortage-hint" : undefined}
                                        aria-invalid={change < 0}
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
                                <div id="cash-shortage-hint" aria-live="polite" className={cn(
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
                            <Button className="h-full min-w-36 px-6 text-base font-black tracking-tight" disabled={(! (isWholesaleMode && selectedCustomerId) && change < 0) || cart.length === 0} onClick={handleProcessPayment}>
                                <ReceiptCent className="mr-2 size-5" /> BAYAR
                            </Button>
                        </div>
                    </div>
                </div>

                <main aria-label="Kasir" className="flex min-w-0 flex-1 flex-col bg-card">
                    <h1 className="sr-only">Kasir — TokoCepat POS</h1>
                    {/* Search bar */}
                    <div role="search" aria-label="Cari produk" className="relative shrink-0 border-b border-border bg-muted/30 px-2.5 py-2">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                            <Input 
                                ref={searchInputRef}
                                id="cashier-search-input"
                                role="combobox"
                                aria-label="Cari produk"
                                aria-controls="cashier-search-listbox"
                                aria-expanded={searchResults.length > 0}
                                aria-autocomplete="list"
                                aria-activedescendant={searchIndex >= 0 ? `search-option-${searchIndex}` : undefined}
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
                                <div id="cashier-search-listbox" role="listbox" className="absolute top-full -left-0.5 -right-0.5 z-50 mt-1 max-h-96 overflow-auto rounded-b-lg border border-t-0 border-border bg-popover shadow-xl">
                                    {searchResults.map((p, i) => (
                                        <div 
                                            key={p.id}
                                            id={`search-option-${i}`}
                                            role="option"
                                            aria-selected={searchIndex === i}
                                            className={cn(
                                                "flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-sm transition-colors",
                                                searchIndex === i ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                                            )}
                                            onClick={() => handleProductSelect(p)}
                                        >
                                            <span className="min-w-0 flex-1 truncate font-normal">{p.name}</span>
                                            <span className={cn("w-16 shrink-0 truncate text-xs", searchIndex === i ? "text-primary-foreground/70" : "text-muted-foreground")}>{normalizeProductUoms(p as any).baseUom || 'Pcs'}</span>
                                            <span className={cn("w-28 shrink-0 truncate text-xs", searchIndex === i ? "text-primary-foreground/70" : "text-muted-foreground")}>{(p as any).category_id ? (categories.find(c=>c.id===(p as any).category_id)?.name || '—') : '—'}</span>
                                            <span className={cn("w-28 shrink-0 truncate", searchIndex === i ? "text-primary-foreground/70" : "text-muted-foreground")}>{p.brand || '—'}</span>
                                            <span className={cn("w-32 shrink-0 truncate font-mono text-xs", searchIndex === i ? "text-primary-foreground/70" : "text-muted-foreground")}>{p.barcode || 'Tanpa barcode'}</span>
                                            <span className="w-24 shrink-0 text-right font-bold tabular-nums">{formatIDR(p.price)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {isWholesaleMode && (
                    <div className="flex shrink-0 items-center gap-3 border-b border-wholesale/20 bg-wholesale/10 dark:bg-wholesale/10 px-2.5 py-1.5">
                        <span className="flex items-center gap-1.5 text-xs font-medium"><span className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-[10px]">F9</span> Mode Grosir</span>
                        <div className="h-4 w-px bg-border" />
                                {selectedCustomer ? (
                                    <span className="text-xs font-medium flex items-center gap-1">
                                        {selectedCustomer.name} · {customerGroups.find(g=>g.id===selectedCustomer.groupId)?.name || 'Umum'}
                                        <Button variant="ghost" size="sm" className="h-5 ml-1 px-1 text-xs" onClick={()=>{setSelectedCustomerId(null); setCustomerQuery('');}}>× Hapus</Button>
                                    </span>
                                ) : (
                                    <div className="w-64">
                                        <SearchDropdown
                                            value={customerQuery}
                                            onChange={setCustomerQuery}
                                            placeholder="Cari pelanggan (nama/hp/scan barcode)"
                                            options={customers.map(c => ({ id: c.id, label: c.name, subLabel: customerGroups.find(g=>g.id===c.groupId)?.name, data: c }))}
                                            onSelect={opt => { setSelectedCustomerId(opt.id); setCustomerQuery(''); }}
                                            emptyText="Tidak ditemukan"
                                        />
                                    </div>
                                )}
                                {selectedCustomer && (
                                    <span className="text-xs text-muted-foreground">
                                        TOP {selectedCustomer.topDays ?? customerGroups.find(g=>g.id===selectedCustomer.groupId)?.topDays ?? 0} hari
                                        {selectedCustomer.creditLimit ? ` · Limit ${formatIDR(selectedCustomer.creditLimit)}` : ''}
                                    </span>
                                )}
                                <span className="ml-auto text-[10px] text-muted-foreground hidden lg:inline">Harga grosir otomatis per qty Pcs · Scan barcode pelanggan</span>
                    </div>
                    )}

                    {/* Cart table — classic W7 ledger, dense Explorer detail view */}
                    <div className="min-h-0 flex-1 overflow-auto outline-none px-1" ref={cartTableRef} tabIndex={0}>
                        <Table className="table-fixed">
                            <TableHeader className="sticky top-0 z-10 border-b border-border bg-card">
                                <TableRow className="hover:bg-transparent">
                                <TableHead className="w-10 h-6 px-2">No</TableHead>
                                <TableHead className="min-w-32 h-6 px-2">Produk</TableHead>
                                <TableHead className="w-8 text-center h-6 px-2">Var</TableHead>
                                <TableHead className="w-8 text-center h-6 px-2">Con</TableHead>
                                <TableHead className="w-20 h-6 px-2">Merek</TableHead>
                                <TableHead className="w-20 h-6 px-2">Kategori</TableHead>
                                <TableHead className="w-28 text-right h-6 px-2">Harga</TableHead>
                                <TableHead className="w-20 text-center h-6 px-2">Satuan</TableHead>
                                <TableHead className="w-20 text-center h-6 px-2">Qty</TableHead>
                                <TableHead className="w-28 text-right h-6 px-2">Diskon</TableHead>
                                <TableHead className="w-44 text-right h-6 px-2">Subtotal</TableHead>
                                <TableHead className="w-10 h-6 px-2"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {cart.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={12} className="h-[40vh] text-center text-muted-foreground">
                                            <div className="space-y-1">
                                                <p className="font-medium text-foreground/70">Keranjang kosong</p>
                                                <p className="text-sm">Cari produk, scan barcode, atau tekan <Kbd>F1</Kbd> untuk fokus pencarian.</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                        cart.map((item, idx) => (
                                            <TableRow key={item.cartItemId} className={cn("group bg-card hover:bg-muted/40", cartActiveIndex === idx && "bg-muted/40")} onMouseEnter={() => setCartActiveIndex(idx)}>
                                                <TableCell className={cn("!py-0.5 !px-2", cartActiveIndex === idx && cartActiveColumn === 0 && "bg-primary/10")}>{idx + 1}</TableCell>
                                                <TableCell className={cn("font-normal !py-0.5 !px-2", cartActiveIndex === idx && cartActiveColumn === 1 && "bg-primary/10")}>
                                                    <div className="truncate">
                                                        {item.name}
                                                        {(() => {
                                                            const line = discountResult?.lines.find(l => l.cartItemId === item.cartItemId);
                                                            const free = line?.freeQty || 0;
                                                            return free > 0 ? <span className="text-success"> ({free} bonus)</span> : null;
                                                        })()}
                                                    </div>
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
                                                <TableCell className={cn("text-center !py-0.5 !px-2", cartActiveIndex === idx && cartActiveColumn === 2 && "bg-primary/10")}>
                                                    {item.has_variant ? <span title="Memiliki varian" aria-label="Memiliki varian"><GitBranch className="mx-auto size-3.5 text-muted-foreground" /></span> : null}
                                                </TableCell>
                                                <TableCell className={cn("text-center !py-0.5 !px-2", cartActiveIndex === idx && cartActiveColumn === 3 && "bg-primary/10")}>
                                                    {item.is_consignment ? <span title="Konsinyasi" aria-label="Konsinyasi"><Handshake className="mx-auto size-3.5 text-warning dark:text-warning-foreground" /></span> : null}
                                                </TableCell>
                                                <TableCell className={cn("whitespace-nowrap text-muted-foreground !py-0.5 !px-2", cartActiveIndex === idx && cartActiveColumn === 4 && "bg-primary/10")}>
                                                    <span className="truncate">{item.brand || '—'}</span>
                                                </TableCell>
                                                <TableCell className={cn("whitespace-nowrap text-muted-foreground !py-0.5 !px-2", cartActiveIndex === idx && cartActiveColumn === 5 && "bg-primary/10")}>
                                                    <span className="truncate">{categoryName(item) || '—'}</span>
                                                </TableCell>
                                                <TableCell className={cn("text-right tabular-nums whitespace-nowrap !py-0.5 !px-2", cartActiveIndex === idx && cartActiveColumn === 6 && "bg-primary/10")}>{formatIDR(item.price)}</TableCell>
                                                <TableCell className={cn("text-center !py-0.5 !px-2", cartActiveIndex === idx && cartActiveColumn === 7 && "bg-primary/10")}>
                                                    {(() => {
                                                        const norm = normalizeProductUoms(item as any);
                                                        const uoms = norm.uoms || [];
                                                        if (isWholesaleMode) return <span className="text-xs">{norm.baseUom || 'Pcs'}</span>;
                                                        if (uoms.length <= 1) return <span className="text-xs">{uoms[0]?.name || norm.baseUom || 'Pcs'}</span>;
                                                        const isEditing = uomEditId === item.cartItemId;
                                                        const currentUomName = uoms.find(u=>u.id===((item as any).selectedUomId || uoms.find(x=>x.isBase)?.id))?.name || norm.baseUom || 'Pcs';
                                                        if (!isEditing) {
                                                            return <button className={cn("mx-auto block h-7 text-xs rounded px-2", cartActiveIndex === idx && cartActiveColumn === 7 && "bg-primary/15 ring-1 ring-primary/40")} onClick={() => { setCartActiveIndex(idx); setCartActiveColumn(7); setUomEditId(item.cartItemId); }} onKeyDown={e=>e.stopPropagation()} aria-label={`Ubah satuan ${item.name}`}>{currentUomName}</button>;
                                                        }
                                                        return (
                                                            <Select value={(item as any).selectedUomId || uoms.find(u=>u.isBase)?.id} onValueChange={v => { updateCartItemUom(item.cartItemId, v, selectedGroupId); setUomEditId(null); setCartActiveIndex(idx); setCartActiveColumn(7); requestAnimationFrame(()=> cartTableRef.current?.focus()); }} onOpenChange={open => { if (!open) { setUomEditId(null); setCartActiveIndex(idx); setCartActiveColumn(7); cartTableRef.current?.focus(); } }}>
                                                                <SelectTrigger autoFocus className="h-7 w-full text-xs"><SelectValue /></SelectTrigger>
                                                                <SelectContent>{uoms.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
                                                            </Select>
                                                        );
                                                    })()}
                                                </TableCell>
                                                <TableCell className={cn("text-center !py-0.5 !px-2", cartActiveIndex === idx && cartActiveColumn === 8 && qtyEditId !== item.cartItemId && "bg-primary/10")}>
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
                                                                if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); }
                                                                if (e.key === 'Escape') { setQtyEditId(null); setQtyEditValue(''); (e.target as HTMLInputElement).blur(); }
                                                            }}
                                                            aria-label={`Edit jumlah ${item.name}, Enter simpan Escape batal`}
                                                            className="mx-auto block h-7 w-16 rounded-md border-border/70 bg-background text-center text-sm font-bold tabular-nums outline-none ring-1 ring-primary"
                                                        />
                                                    ) : (
                                                        <button
                                                            className={cn(
                                                                "mx-auto block w-16 text-center font-bold tabular-nums rounded",
                                                                cartActiveIndex === idx && cartActiveColumn === 8 && "bg-primary/15 ring-1 ring-primary/40"
                                                            )}
                                                            onClick={() => { setCartActiveIndex(idx); setCartActiveColumn(8); setQtyEditValue(String(item.quantity)); setQtyEditId(item.cartItemId); }}
                                                            title="Klik untuk ubah jumlah"
                                                            aria-label={`Ubah jumlah ${item.name}`}
                                                        >
                                                            {(() => {
                                                                const line = discountResult?.lines.find(l => l.cartItemId === item.cartItemId);
                                                                const free = line?.freeQty || 0;
                                                                if (free > 0) {
                                                                    const totalQty = (line as any)?.qty ?? item.quantity;
                                                                    return <span className="text-success" title={`${free} unit bonus (tidak dibayar)`}>{totalQty}</span>;
                                                                }
                                                                return item.quantity;
                                                            })()}
                                                        </button>
                                                    )}
                                                </TableCell>
                                                <TableCell className={cn("text-right tabular-nums !py-0.5 !px-2", cartActiveIndex === idx && cartActiveColumn === 9 && "bg-primary/10", (() => { const l = discountResult?.lines.find(l=>l.cartItemId===item.cartItemId); return (l?.lineDiscount||0) > 0; })() ? "text-success dark:text-success-foreground font-medium" : "text-muted-foreground/50")}>
                                                    {(() => {
                                                        const l = discountResult?.lines.find(l => l.cartItemId === item.cartItemId);
                                                        return formatIDR(l?.lineDiscount || 0);
                                                    })()}
                                                </TableCell>
                                                <TableCell className={cn("text-right font-bold tabular-nums whitespace-nowrap !py-0.5 !px-2", cartActiveIndex === idx && cartActiveColumn === 10 && "bg-primary/10")}>
                                                    {(() => {
                                                        const line: any = discountResult?.lines.find(l=>l.cartItemId===item.cartItemId);
                                                        const gross = line ? line.grossAmount : item.price * item.quantity;
                                                        const net = line ? line.chargedBase ?? gross - (line.lineDiscount||0) : gross;
                                                        const disc = line?.lineDiscount || 0;
                                                        const grosCompact = isCompactable(gross) ? formatCompactIDR(gross) : formatIDR(gross);
                                                        return disc > 0 ? (
                                                            <span><span className="line-through text-muted-foreground/60 mr-1 font-normal text-xs" title={formatIDR(gross)}>{grosCompact}</span>{formatIDR(net)}</span>
                                                        ) : formatIDR(gross);
                                                    })()}
                                                </TableCell>
                                                <TableCell className={cn("!py-0.5 !px-2", cartActiveIndex === idx && cartActiveColumn === 11 && "bg-primary/10")}>
                                                    <Button variant="ghost" size="icon" className={cn("size-7 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100", cartActiveIndex === idx && "opacity-100")} aria-label={`Hapus ${item.name}`} onClick={() => removeFromCart(item.cartItemId)}><Trash2 className="size-4"/></Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
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
                            <span className="flex items-center gap-1.5"><Kbd>F9</Kbd> Grosir</span>
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
                                    storeName={activeStoreConfig.store_name || 'Toko Cepat'}
                                    storeAddress={activeStoreConfig.address}
                                    footer={activeStoreConfig.receipt_footer}
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
                                                <TableCell className="whitespace-nowrap text-muted-foreground">{(() => { try { return format(new Date(tx.created_at), 'dd MMM yyyy, HH:mm', { locale: idLocale }); } catch { return String(tx.created_at); } })()}</TableCell>
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
                                                {(() => { const vb = isVoidBlockedByPiutang(reviewingTx as any); return vb.blocked ? <p className="text-xs text-destructive">Void diblokir: {vb.reason}</p> : null; })()}
                                                <Input 
                                                    placeholder="Alasan pembatalan..." 
                                                    value={voidReason} 
                                                    onChange={(e) => setVoidReason(e.target.value)} 
                                                    disabled={isVoidBlockedByPiutang(reviewingTx as any).blocked}
                                                />
                                                <Button 
                                                    variant="destructive" 
                                                    className="w-full" 
                                                    disabled={!voidReason || isVoiding || isVoidBlockedByPiutang(reviewingTx as any).blocked}
                                                    title={isVoidBlockedByPiutang(reviewingTx as any).reason || ''}
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
                    <DialogFooter className="p-4 border-t bg-muted/20 gap-2">
                        <Button variant="ghost" onClick={() => setIsHistoryOpen(false)}>Tutup (Esc)</Button>
                        {reviewingTx && (
                          <>
                            <Button variant="outline" onClick={() => handleCetakFaktur(reviewingTx)}><FileText className="mr-2 size-4"/> Cetak Faktur</Button>
                            <Button onClick={() => addToQueue(reviewingTx)}><Printer className="mr-2 size-4"/> Cetak Ulang Struk</Button>
                          </>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* --- VOUCHER MODAL (F5) --- */}
            <Dialog open={isVoucherOpen} onOpenChange={(open) => { if (!open) setIsVoucherOpen(false); }}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Kode Voucher</DialogTitle>
                        <DialogDescription>Masukkan kode lalu tekan Selesai untuk memeriksa dan menerapkan voucher.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="relative">
                            <TicketPercent className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                autoFocus
                                value={voucherInput}
                                onChange={(e) => { setVoucherInput(e.target.value.toUpperCase()); setVoucherClaimMsg(null); }}
                                placeholder="Mis. HEMAT10"
                                className="h-10 pl-9 pr-9 font-mono uppercase tracking-widest"
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); claimVoucher(); } }}
                            />
                            {voucherInput && (
                                <button onClick={() => { setVoucherInput(''); setVoucherClaimMsg(null); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="Hapus kode voucher" title="Hapus">
                                    <XCircle className="size-4" />
                                </button>
                            )}
                        </div>
                        {voucherClaimMsg && (
                            <p className="text-xs font-medium text-destructive">{voucherClaimMsg}</p>
                        )}
                        <p className="text-xs text-muted-foreground">Kode baru menggantikan kode yang sedang aktif.</p>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="ghost" onClick={() => { setVoucherCode(''); setVoucherInput(''); setVoucherClaimMsg(null); setIsVoucherOpen(false); }}>Hapus</Button>
                        <Button onClick={claimVoucher} disabled={voucherResolving}>
                            {voucherResolving ? (<><Loader2 className="mr-2 size-4 animate-spin" /> Memeriksa…</>) : 'Selesai'}
                        </Button>
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
            <PdfPreviewSheet open={fakturPdf.previewOpen} onOpenChange={fakturPdf.setPreviewOpen} pdfBytes={fakturPdf.pdfBytes} title={fakturPdf.title || 'Faktur Penjualan'} filename={fakturPdf.filename || 'faktur.pdf'} />
            <PdfGeneratingOverlay open={fakturPdf.open} onCancel={fakturPdf.cancel} title={fakturPdf.title} elapsedMs={fakturPdf.elapsedMs} pageCount={fakturPdf.pageCount} />
        </div>
    );
}