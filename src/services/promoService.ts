import { CartItem, Promotion, StoreConfig, AppliedPromoRecord } from '@/lib/types';
import { getTaxRateForItem } from '@/lib/pricing';
import { normalizePromo, isPromoLive } from '@/lib/promo-model';

/** Per-cart-line discount & tax breakdown produced by the engine. */
export interface DiscountLine {
    cartItemId: string;
    qty: number;
    price: number;
    grossAmount: number;   // qty * price (retail value)
    freeQty: number;       // units granted free by a BOGO / bonus promo
    freeAmount: number;    // freeQty * price
    autoAmount: number;    // money-off from an automatic promo on this line
    sharedAmount: number;  // voucher + manual discount share for this line
    lineDiscount: number;  // freeAmount + autoAmount + sharedAmount
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
    /** When set, the cashier-entered manual discount applies ONLY to this cart
     *  line instead of the whole transaction. */
    manualDiscountTargetItemId?: string;
    /** Actual redeems per voucher code, derived from transactions (source of truth). */
    usageCounts?: Record<string, number>;
    // Wholesale context (v0.5 grosir) — Group Base -> Qty Tier
    customerId?: string;
    isWholesale?: boolean;
}

export interface DiscountResult {
    grossSubtotal: number;
    lines: DiscountLine[];
    taxAmount: number;
    total: number;
    promoDiscount: number;           // auto (money + free value) + voucher value
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
 * Distribute `totalDiscount` across lines proportional to their remaining
 * chargeable base (already reduced by free units + auto discounts). Integer-safe:
 * the rounding remainder is pushed onto the largest line. When `excludeFreeLines`
 * is set, lines that already received free units are skipped (one diskon/line).
 */
const distribute = (
    lines: DiscountLine[],
    totalDiscount: number,
    field: keyof Pick<DiscountLine, 'sharedAmount' | 'autoAmount'> = 'sharedAmount',
    excludeFreeLines = false,
): void => {
    if (totalDiscount <= 0) return;

    const remaining = (l: DiscountLine) =>
        excludeFreeLines && l.freeAmount > 0
            ? 0
            : Math.max(0, chargeableBase(l) - l.autoAmount - l.sharedAmount);
    const weights = lines.map(remaining);
    const weightSum = weights.reduce((a, b) => a + b, 0);
    if (weightSum <= 0) return;

    let allocated = 0;
    lines.forEach((line, i) => {
        if (i === lines.length - 1) {
            line[field] += totalDiscount - allocated;
            return;
        }
        const share = round((totalDiscount * weights[i]) / weightSum);
        line[field] += share;
        allocated += share;
    });
};

/**
 * Evaluate every discount for a cart:
 *  1. Auto diskons — one diskon per product line.
 *  2. Voucher code (percentage or flat Rp, optionally scoped).
 *  3. Cashier-entered manual discount.
 *
 * "One diskon per line": a line can receive at most ONE auto diskon — either a
 * money-off (best-value wins across flat / criteria `discount_product`) or free
 * units (BOGO / bonus rewards, which only land on undiscounted lines). Cart-level
 * order discounts spread only across lines with no diskon yet. A voucher may
 * stack on top of that single diskon.
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
        autoAmount: 0,
        sharedAmount: 0,
        lineDiscount: 0,
        chargedBase: 0,
        taxAmount: 0,
        unitDiscount: 0,
        promoIds: [],
        isFreeItem: false,
    }));

    const grossSubtotal = lines.reduce((sum, l) => sum + l.grossAmount, 0);

    // NOTE: must wrap in an arrow — `filter(isPromoLive)` would pass the array
    // INDEX as isPromoLive's `now` parameter, killing every promo whose
    // starts_at is after 1970 (i.e. all of them).
    let activePromos = promos.map(normalizePromo).filter(p => isPromoLive(p));
    // Wholesale transactions skip promos/vouchers unless explicitly allowed per-promo
    if (opts.isWholesale) {
        activePromos = activePromos.filter(p => !!p.allowWholesale);
    }

    const cartById = new Map(cart.map(c => [c.cartItemId, c]));
    const getItem = (l: DiscountLine) => cartById.get(l.cartItemId);

    const scopeLinesOf = (promo: Promotion) =>
        lines.filter(l => {
            const item = getItem(l);
            return item ? matchesPromo(item, promo) : false;
        });

    /** Every selected product (>=1 unit) and category (>=1 line) present in the cart? */
    const allScopePresent = (promo: Promotion): boolean => {
        const pids = promo.applies_to_product_ids || [];
        const cids = promo.applies_to_category_ids || [];
        if (pids.length === 0 && cids.length === 0) return true;
        for (const pid of pids) {
            const has = lines.some(l => getItem(l)?.id === pid);
            if (!has) return false;
        }
        for (const cid of cids) {
            const has = lines.some(l => getItem(l)?.category_id === cid);
            if (!has) return false;
        }
        return true;
    };

    /** Order base used by spend thresholds — gross minus already-discounted value. */
    const orderBase = () =>
        lines.reduce((s, l) => s + Math.max(0, chargeableBase(l) - l.autoAmount - l.sharedAmount), 0);

    const discAmount = (promo: Promotion, base: number): number => {
        const value = promo.discount_value || 0;
        return promo.discount_type === 'flat'
            ? Math.min(round(value), base)
            : Math.min(round(base * (value / 100)), base);
    };

    /** Trigger met for criteria (scope present) / conditional (spend + optional scope). */
    const rewardMet = (promo: Promotion): boolean => {
        if (promo.kind === 'criteria') return allScopePresent(promo);
        const minMet = !(promo.min_purchase && promo.min_purchase > 0) || orderBase() >= promo.min_purchase;
        const scopeMet = !promo.require_scope || allScopePresent(promo);
        return minMet && scopeMet;
    };

    interface MoneyCandidate { promo: Promotion; amount: number; }
    const moneyBest = new Map<number, MoneyCandidate>();
    const setMoneyBest = (i: number, promo: Promotion, amount: number) => {
        const cur = moneyBest.get(i);
        if (!cur || amount > cur.amount) moneyBest.set(i, { promo, amount });
    };
    const hasMoney = (i: number) => moneyBest.has(i);

    // Free-item bookkeeping (BOGO + bonus rewards).
    const freeValueByPromo = new Map<string, number>();
    const freeNotes: FreeItemNote[] = [];
    const addFreeNote = (pid: string, name: string, qty: number) => {
        if (qty <= 0) return;
        const note = freeNotes.find(n => n.productId === pid);
        if (note) note.freeQty += qty;
        else freeNotes.push({ productId: pid, name, freeQty: qty });
    };

    const grantFree = (promo: Promotion, target: DiscountLine, qty: number) => {
        const grant = Math.min(qty, target.qty - target.freeQty);
        if (grant <= 0) return;
        target.freeQty += grant;
        target.freeAmount += grant * target.price;
        if (!target.promoIds.includes(promo.id)) target.promoIds.push(promo.id);
        freeValueByPromo.set(promo.id, (freeValueByPromo.get(promo.id) || 0) + grant * target.price);
        const it = getItem(target);
        addFreeNote(it?.id || '', it?.name || '', grant);
    };

    // --- Pass A: money-off candidates (flat + criteria `discount_product`) ---
    const moneyPromos = activePromos.filter(p =>
        p.kind === 'flat' || (p.kind === 'criteria' && p.reward_type === 'discount_product')
    );
    for (const promo of moneyPromos) {
        if ((promo.discount_value || 0) <= 0) continue;
        if (promo.kind === 'criteria' && !allScopePresent(promo)) continue;
        const eligible = promo.kind === 'flat'
            ? scopeLinesOf(promo)
            : lines.filter(l => {
                  const it = getItem(l);
                  const rewardIds = promo.reward_product_ids || [];
                  return it ? rewardIds.includes(it.id) : false;
              });
        for (const l of eligible) {
            const base = chargeableBase(l);
            if (base <= 0) continue;
            const amount = Math.min(discAmount(promo, base), base);
            if (amount > 0) setMoneyBest(lines.indexOf(l), promo, amount);
        }
    }

    const autoApplied = new Map<string, number>();
    for (const [i, cand] of moneyBest) {
        const l = lines[i];
        l.autoAmount += cand.amount;
        if (!l.promoIds.includes(cand.promo.id)) l.promoIds.push(cand.promo.id);
        autoApplied.set(cand.promo.id, (autoApplied.get(cand.promo.id) || 0) + cand.amount);
    }

    // --- Pass B: free-unit grants (BOGO + criteria/conditional `bonus_product`) ---
    // Land only on lines that received no money discount and no other free grant.
    const undiscounted = (l: DiscountLine) => !hasMoney(lines.indexOf(l)) && l.freeQty <= 0;

    const bogoPromos = activePromos.filter(p => p.kind === 'bogo');
    for (const promo of bogoPromos) {
        let capRemaining = promo.max_total_free_qty ?? Number.MAX_SAFE_INTEGER;
        if (capRemaining <= 0) continue;
        const buyQty = Math.max(1, promo.buy_quantity ?? 1);
        const freeQty = Math.max(1, promo.free_quantity ?? 1);

        if (promo.free_product_id) {
            // Free units come from a designated product (must already be in the cart).
            const targetLine = lines.find(l => getItem(l)?.id === promo.free_product_id && undiscounted(l));
            const purchased = scopeLinesOf(promo).filter(undiscounted).reduce((s, l) => s + l.qty, 0);
            const grant = Math.min(
                Math.floor(purchased / buyQty) * freeQty,
                targetLine ? targetLine.qty : 0,
                capRemaining
            );
            if (targetLine && grant > 0) {
                grantFree(promo, targetLine, grant);
                capRemaining -= grant;
            }
        } else {
            // Free units come from the same purchased products (pooled per product id).
            const byProduct = new Map<string, DiscountLine[]>();
            scopeLinesOf(promo)
                .filter(undiscounted)
                .forEach(l => {
                    const pid = getItem(l)?.id || '';
                    const arr = byProduct.get(pid) || [];
                    arr.push(l);
                    byProduct.set(pid, arr);
                });

            for (const [, group] of byProduct) {
                if (capRemaining <= 0) break;
                const purchased = group.reduce((sum, l) => sum + l.qty, 0);
                const grant = Math.min(Math.floor(purchased / buyQty) * freeQty, purchased, capRemaining);
                let toDistribute = grant;
                for (const l of group) {
                    if (toDistribute <= 0) break;
                    const g = Math.min(l.qty - l.freeQty, toDistribute);
                    if (g <= 0) continue;
                    grantFree(promo, l, g);
                    toDistribute -= g;
                }
                capRemaining -= grant - toDistribute;
            }
        }
    }

    const bonusPromos = activePromos.filter(p =>
        (p.kind === 'criteria' || p.kind === 'conditional') && p.reward_type === 'bonus_product'
    );
    for (const promo of bonusPromos) {
        const rewardIds = promo.reward_product_ids || [];
        if (rewardIds.length === 0 || !rewardMet(promo)) continue;
        for (const l of lines) {
            const it = getItem(l);
            if (!it || !rewardIds.includes(it.id)) continue;
            if (!undiscounted(l)) continue;
            grantFree(promo, l, 1);
        }
    }

    lines.forEach(l => {
        l.freeQty = Math.min(l.freeQty, l.qty);
        l.freeAmount = Math.min(l.freeAmount, l.grossAmount);
    });

    // --- Pass C: cart-level order discounts (criteria/conditional `discount`) ---
    // Distributed only across lines that have no diskon yet (money OR free).
    const cartLevel: { promo: Promotion; amount: number }[] = activePromos
        .filter(p => (p.kind === 'criteria' || p.kind === 'conditional') && p.reward_type === 'discount')
        .filter(p => (p.discount_value || 0) > 0 && rewardMet(p))
        .map(promo => {
            const base = lines.reduce((s, l) => {
                if (l.freeAmount > 0) return s;
                return s + Math.max(0, chargeableBase(l) - l.autoAmount - l.sharedAmount);
            }, 0);
            if (base <= 0) return null;
            const amount = Math.min(discAmount(promo, base), base);
            return amount > 0 ? { promo, amount } : null;
        })
        .filter((x): x is { promo: Promotion; amount: number } => x !== null);

    for (const { promo, amount } of cartLevel) {
        distribute(lines, amount, 'autoAmount', true);
        autoApplied.set(promo.id, (autoApplied.get(promo.id) || 0) + amount);
    }

    const autoDiscountTotal = lines.reduce((s, l) => s + l.autoAmount, 0);

    // --- 2. Voucher code (percentage or flat Rp, optionally scoped) ---
    let voucherDiscount = 0;
    let voucherPromo: Promotion | undefined;
    let voucherCode: string | undefined;

    const code = (opts.voucherCode || '').trim().toUpperCase();
    if (code) {
        voucherPromo = activePromos.find(p => p.kind === 'voucher' && (p.code || '').toUpperCase() === code);
        if (!voucherPromo) {
            const byCode = promos.find(p => p.kind === 'voucher' && (p.code || '').toUpperCase() === code);
            if (!byCode) {
                errors.push(`Kode voucher "${code}" tidak ditemukan.`);
            } else if (!byCode.is_active) {
                errors.push(`Voucher "${byCode.name}" sedang nonaktif.`);
            } else if (opts.isWholesale && !byCode.allowWholesale) {
                errors.push(`Voucher "${byCode.name}" tidak berlaku untuk grosir.`);
            } else {
                errors.push(`Voucher "${byCode.name}" belum berlaku atau sudah berakhir.`);
            }
        } else {
            const voucher = voucherPromo;
            // Voucher may stack on top of a diskon, so it is scoped to its own lines.
            const voucherLines = lines.filter(l => {
                const item = cartById.get(l.cartItemId);
                return item ? matchesPromo(item, voucher) : false;
            });
            if (voucherLines.length === 0) {
                errors.push(`Voucher ${voucher.name} tidak berlaku untuk item di keranjang.`);
            } else {
                const base = voucherLines.reduce((s, l) => s + Math.max(0, chargeableBase(l) - l.autoAmount), 0);
                const minPurchase = voucher.min_purchase || 0;
                let quotaAllowed = true;
                if (base <= 0) {
                    quotaAllowed = false;
                } else if (orderBase() < minPurchase) {
                    errors.push(`Voucher ${voucher.name} butuh minimal belanja ${minPurchase.toLocaleString('id-ID')}.`);
                    quotaAllowed = false;
                } else if (typeof voucher.max_uses === 'number' && voucher.max_uses > 0) {
                    const used = (opts.usageCounts?.[code] || 0) + (voucher.uses_count || 0);
                    if (used >= voucher.max_uses) {
                        errors.push(`Voucher ${voucher.name} sudah habis digunakan.`);
                        quotaAllowed = false;
                    }
                }
                if (quotaAllowed) {
                    const value = voucher.discount_value || 0;
                    if (value <= 0) {
                        errors.push(`Voucher ${voucher.name} belum memiliki nilai diskon.`);
                    } else {
                        if (voucher.discount_type === 'flat') {
                            voucherDiscount = Math.min(round(value), base);
                        } else {
                            voucherDiscount = Math.min(round(base * (value / 100)), base);
                        }
                        voucherDiscount = Math.max(0, voucherDiscount);
                        if (voucherDiscount > 0) {
                            voucherCode = code;
                            distribute(voucherLines, voucherDiscount);
                        }
                    }
                }
            }
        }
    }

    // --- 3. Manual cashier discount ---
    // Applies ONLY to the selected cart line when a target is given (the
    // highlighted row in the cashier), otherwise it is distributed across every
    // line (legacy whole-transaction behaviour).
    let manualDiscount = 0;
    const manualInput = opts.manualDiscount || 0;
    if (manualInput > 0) {
        const target = opts.manualDiscountTargetItemId
            ? lines.find(l => l.cartItemId === opts.manualDiscountTargetItemId)
            : undefined;
        const pool = target ? [target] : lines;
        const remainingBase = pool.reduce((s, l) => s + Math.max(0, chargeableBase(l) - l.autoAmount - l.sharedAmount), 0);
        if (opts.manualDiscountType === 'persen') {
            manualDiscount = Math.min(round(remainingBase * (Math.min(manualInput, 100) / 100)), remainingBase);
        } else {
            manualDiscount = Math.min(round(manualInput), remainingBase);
        }
        manualDiscount = Math.max(0, manualDiscount);
        distribute(pool, manualDiscount);
    }

    // --- Per-line snapshots + tax ---
    lines.forEach(l => {
        l.lineDiscount = l.freeAmount + l.autoAmount + l.sharedAmount;
        l.chargedBase = Math.max(0, l.grossAmount - l.lineDiscount);
        const rate = getTaxRateForItem(cart.find(c => c.cartItemId === l.cartItemId)!, storeConfig);
        l.taxAmount = round(l.chargedBase * rate);
        l.unitDiscount = l.qty > 0 ? round(l.lineDiscount / l.qty) : 0;
        l.isFreeItem = l.chargedBase <= 0 && l.qty > 0 && l.lineDiscount >= l.grossAmount;
    });

    const promoDiscountFree = lines.reduce((s, l) => s + l.freeAmount, 0);
    const promoDiscount = promoDiscountFree + autoDiscountTotal + voucherDiscount;
    const discountTotal = promoDiscount + manualDiscount;
    const taxAmount = lines.reduce((s, l) => s + l.taxAmount, 0);
    const total = grossSubtotal - discountTotal + taxAmount;

    const appliedPromos: AppliedPromoRecord[] = [];
    const freePromoIds = new Set<string>();
    freeValueByPromo.forEach((_, pid) => freePromoIds.add(pid));
    for (const promo of activePromos) {
        if (!freePromoIds.has(promo.id)) continue;
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
    for (const [promoId, amount] of autoApplied) {
        if (amount <= 0) continue;
        const promo = activePromos.find(p => p.id === promoId);
        if (promo) {
            appliedPromos.push({ promo_id: promo.id, name: promo.name, amount, kind: 'auto' });
        }
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