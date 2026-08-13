import { CartItem, Promotion, StoreConfig, AppliedPromoRecord } from '@/lib/types';
import { getTaxRateForItem } from '@/lib/pricing';

/** Per-cart-line discount & tax breakdown produced by the engine. */
export interface DiscountLine {
    cartItemId: string;
    qty: number;
    price: number;
    grossAmount: number;   // qty * price (retail value)
    freeQty: number;       // units granted free by a BOGO promo
    freeAmount: number;    // freeQty * price
    sharedAmount: number;  // voucher + manual discount share for this line
    lineDiscount: number;  // freeAmount + sharedAmount
    chargedBase: number;   // grossAmount - lineDiscount (tax base the customer actually pays)
    taxAmount: number;
    unitDiscount: number;  // integer Rp per unit (snapshot-friendly)
    promoIds: string[];
    isFreeItem: boolean;   // nothing charged on this line
}

export interface FreeItemNote {
    productId: string;
    name: string;
    freeQty: number;
}

export interface DiscountOptions {
    voucherCode?: string;
    manualDiscount?: number;
    manualDiscountType?: 'flat' | 'persen';
    /** Actual redeems per voucher code, derived from transactions (source of truth). */
    usageCounts?: Record<string, number>;
}

export interface DiscountResult {
    grossSubtotal: number;
    lines: DiscountLine[];
    taxAmount: number;
    total: number;
    promoDiscount: number;           // BOGO free value + voucher value
    voucherDiscount: number;
    manualDiscount: number;
    discountTotal: number;
voucherCode?: string;
    appliedPromos: AppliedPromoRecord[];
    freeItems: FreeItemNote[];
    errors: string[];
}

const round = (n: number) => Math.round(n);

const matchesPromo = (item: CartItem, promo: Promotion): boolean => {
    const pids = promo.applies_to_product_ids || [];
    const cids = promo.applies_to_category_ids || [];
    if (pids.length === 0 && cids.length === 0) return true; // applies to any product
    return !!((item.id && pids.includes(item.id)) || (item.category_id && cids.includes(item.category_id)));
};

/** Sum of line gross values that remain chargeable (used as voucher/manual base). */
const chargeableBase = (line: DiscountLine) => Math.max(0, line.grossAmount - line.freeAmount);

/**
 * Distribute `totalDiscount` across lines proportional to their chargeable
 * base. Integer-safe: rounding remainder is pushed onto the largest line.
 */
const distribute = (
    lines: DiscountLine[],
    totalDiscount: number
): void => {
    if (totalDiscount <= 0) return;

    const weights = lines.map(l => chargeableBase(l));
    const weightSum = weights.reduce((a, b) => a + b, 0);
    if (weightSum <= 0) return;

    let allocated = 0;
    lines.forEach((line, i) => {
        if (i === lines.length - 1) {
            line.sharedAmount += totalDiscount - allocated;
            return;
        }
        const share = round((totalDiscount * weights[i]) / weightSum);
        line.sharedAmount += share;
        allocated += share;
    });
};

/**
 * Evaluate every discount for a cart:
 *  1. BOGO (Buy X Get Y Free) auto promotions.
 *  2. Voucher code (percentage or flat Rp).
 *  3. Cashier-entered manual discount.
 *
 * `subtotal` (gross) includes the retail value of free units; the total the
 * customer pays is `gross - discountTotal + tax`, with tax computed on the
 * discounted base the customer actually pays.
 */
export const evaluateDiscounts = (
    cart: CartItem[],
    storeConfig: StoreConfig,
    promos: Promotion[],
    opts: DiscountOptions = {}
): DiscountResult => {
    const errors: string[] = [];

    const lines: DiscountLine[] = cart.map(item => ({
        cartItemId: item.cartItemId,
        qty: item.quantity,
        price: item.price,
        grossAmount: item.price * item.quantity,
        freeQty: 0,
        freeAmount: 0,
        sharedAmount: 0,
        lineDiscount: 0,
        chargedBase: 0,
        taxAmount: 0,
        unitDiscount: 0,
        promoIds: [],
        isFreeItem: false,
    }));

    const grossSubtotal = lines.reduce((sum, l) => sum + l.grossAmount, 0);
    /** A promo only applies when it is active AND inside its validity window. */
const isPromoLive = (p: Promotion): boolean => {
    if (!p.is_active) return false;
    const now = Date.now();
    if (p.starts_at && new Date(p.starts_at).getTime() > now) return false;
    if (p.ends_at && new Date(p.ends_at).getTime() <= now) return false;
    return true;
};

const activePromos = promos.filter(isPromoLive);

    // --- 1. BOGO auto promotions ---
    const freeValueByPromo = new Map<string, number>();
    const freeNotes: FreeItemNote[] = [];
    const bogoPromos = activePromos.filter(p => p.kind === 'bogo');

    for (const promo of bogoPromos) {
        let capRemaining = promo.max_total_free_qty ?? Number.MAX_SAFE_INTEGER;
        if (capRemaining <= 0) continue;

        const buyQty = Math.max(1, promo.buy_quantity ?? 1);
        const freeQty = Math.max(1, promo.free_quantity ?? 1);
        const eligible = lines.filter(l => {
            const item = cart.find(c => c.cartItemId === l.cartItemId);
            return item ? matchesPromo(item, promo) : false;
        });
        if (eligible.length === 0) continue;

        if (promo.free_product_id) {
            // Free units come from a designated product (must already be in the cart).
            const targetLine = lines.find(l => cart.find(c => c.cartItemId === l.cartItemId)?.id === promo.free_product_id);
            const purchased = eligible.reduce((sum, l) => sum + l.qty, 0);
            const grant = Math.min(
                Math.floor(purchased / buyQty) * freeQty,
                targetLine ? targetLine.qty : 0,
                capRemaining
            );
            if (targetLine && grant > 0) {
                const price = targetLine.price;
                targetLine.freeQty += grant;
                targetLine.freeAmount += grant * price;
                targetLine.promoIds.push(promo.id);
                freeValueByPromo.set(promo.id, (freeValueByPromo.get(promo.id) || 0) + grant * price);
                const note = freeNotes.find(n => n.productId === promo.free_product_id);
                if (note) note.freeQty += grant;
                else freeNotes.push({ productId: promo.free_product_id, name: cart.find(c => c.cartItemId === targetLine.cartItemId)?.name || '', freeQty: grant });
            }
        } else {
            // Free units come from the same purchased products (pooled per product id).
            const byProduct = new Map<string, DiscountLine[]>();
            eligible.forEach(l => {
                const pid = cart.find(c => c.cartItemId === l.cartItemId)?.id || '';
                const arr = byProduct.get(pid) || [];
                arr.push(l);
                byProduct.set(pid, arr);
            });

            for (const [, group] of byProduct) {
                if (capRemaining <= 0) break;
                const purchased = group.reduce((sum, l) => sum + l.qty, 0);
                let grant = Math.floor(purchased / buyQty) * freeQty;
                grant = Math.min(grant, purchased, capRemaining);

                let toDistribute = grant;
                for (const l of group) {
                    if (toDistribute <= 0) break;
                    const g = Math.min(l.qty, toDistribute);
                    l.freeQty += g;
                    l.freeAmount += g * l.price;
                    l.promoIds.push(promo.id);
                    freeValueByPromo.set(promo.id, (freeValueByPromo.get(promo.id) || 0) + g * l.price);
                    toDistribute -= g;
                }
                capRemaining -= (grant - toDistribute);

                const grantQty = grant - toDistribute;
                const item = group[0] && cart.find(c => c.cartItemId === group[0].cartItemId);
                const note = freeNotes.find(n => n.name === (item?.name || ''));
                if (note) {
                    note.freeQty += grantQty;
                } else if (item) {
                    freeNotes.push({ productId: item.id, name: item.name, freeQty: grantQty });
                }
            }
        }
    }

    lines.forEach(l => {
        l.freeQty = Math.min(l.freeQty, l.qty);
        l.freeAmount = Math.min(l.freeAmount, l.grossAmount);
    });

    // --- 2. Voucher code ---
    let voucherDiscount = 0;
    let voucherPromo: Promotion | undefined;
    let voucherCode: string | undefined;

    const code = (opts.voucherCode || '').trim().toUpperCase();
    if (code) {
        voucherPromo = activePromos.find(p => p.kind === 'voucher' && (p.code || '').toUpperCase() === code);
        if (!voucherPromo) {
            errors.push(`Kode voucher "${code}" tidak ditemukan.`);
        } else {
            const base = lines.reduce((s, l) => s + chargeableBase(l), 0);
            const minPurchase = voucherPromo.min_purchase || 0;
            let quotaAllowed = true;
            if (base < minPurchase) {
                errors.push(`Voucher ${voucherPromo.name} butuh minimal belanja ${minPurchase.toLocaleString('id-ID')}.`);
                quotaAllowed = false;
            } else if (typeof voucherPromo.max_uses === 'number' && voucherPromo.max_uses > 0) {
                const used = (opts.usageCounts?.[code] || 0) + (voucherPromo.uses_count || 0);
                if (used >= voucherPromo.max_uses) {
                    errors.push(`Voucher ${voucherPromo.name} sudah habis digunakan.`);
                    quotaAllowed = false;
                }
            }
            if (quotaAllowed) {
                const value = voucherPromo.discount_value || 0;
                if (voucherPromo.discount_type === 'flat') {
                    voucherDiscount = Math.min(round(value), base);
                } else {
                    voucherDiscount = Math.min(round(base * (value / 100)), base);
                }
                voucherDiscount = Math.max(0, voucherDiscount);
                if (voucherDiscount > 0) {
                    voucherCode = code;
                    distribute(lines, voucherDiscount);
                }
            }
        }
    }

    // --- 3. Manual cashier discount ---
    let manualDiscount = 0;
    const manualInput = opts.manualDiscount || 0;
    if (manualInput > 0) {
        const remainingBase = lines.reduce((s, l) => s + Math.max(0, chargeableBase(l) - l.sharedAmount), 0);
        if (opts.manualDiscountType === 'persen') {
            manualDiscount = Math.min(round(remainingBase * (Math.min(manualInput, 100) / 100)), remainingBase);
        } else {
            manualDiscount = Math.min(round(manualInput), remainingBase);
        }
        manualDiscount = Math.max(0, manualDiscount);
        distribute(lines, manualDiscount);
    }

    // --- Per-line snapshots + tax ---
    lines.forEach(l => {
        l.lineDiscount = l.freeAmount + l.sharedAmount;
        l.chargedBase = Math.max(0, l.grossAmount - l.lineDiscount);
        const rate = getTaxRateForItem(cart.find(c => c.cartItemId === l.cartItemId)!, storeConfig);
        l.taxAmount = round(l.chargedBase * rate);
        l.unitDiscount = l.qty > 0 ? round(l.lineDiscount / l.qty) : 0;
        l.isFreeItem = l.chargedBase <= 0 && l.qty > 0 && l.lineDiscount >= l.grossAmount;
    });

    const promoDiscountFree = lines.reduce((s, l) => s + l.freeAmount, 0);
    const promoDiscount = promoDiscountFree + voucherDiscount;
    const discountTotal = promoDiscount + manualDiscount;
    const taxAmount = lines.reduce((s, l) => s + l.taxAmount, 0);
    const total = grossSubtotal - discountTotal + taxAmount;

    const appliedPromos: AppliedPromoRecord[] = [];
    for (const promo of bogoPromos) {
        const amount = freeValueByPromo.get(promo.id) || 0;
        if (amount > 0) {
            appliedPromos.push({ promo_id: promo.id, name: promo.name, amount, kind: 'auto' });
        }
    }
    if (voucherPromo && voucherDiscount > 0) {
        appliedPromos.push({
            promo_id: voucherPromo.id,
            name: voucherPromo.name,
            amount: voucherDiscount,
            kind: 'voucher',
            voucher_code: code,
        });
    }
    if (manualDiscount > 0) {
        appliedPromos.push({
            promo_id: 'manual',
            name: 'Diskon Kasir',
            amount: manualDiscount,
            kind: 'manual',
        });
    }

    const freeItems = freeNotes
        .filter(n => n.freeQty > 0)
        .map(n => ({ ...n, name: n.name }));

    return {
        grossSubtotal,
        lines,
        taxAmount,
        total,
        promoDiscount,
        voucherDiscount,
        manualDiscount,
        discountTotal,
        voucherCode,
        appliedPromos,
        freeItems,
        errors,
    };
};