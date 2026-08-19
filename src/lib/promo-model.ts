import { Promotion, PromoKind } from './types';

const LEGACY_TO_FLAT: Record<string, PromoKind> = {
    product: 'flat',
    category: 'flat',
    event: 'flat',
};

/**
 * Fold legacy kinds ('product' | 'category' | 'event') written by older app
 * versions into the new unified 'flat' kind. Applied on DB snapshot, in the
 * engine, and defensively in the UI so old rules keep working as-is.
 */
export const normalizePromo = (p: Promotion): Promotion => {
    if (!p || typeof p.kind !== 'string') return p;
    const mapped = LEGACY_TO_FLAT[p.kind as string];
    if (mapped) return { ...p, kind: mapped };
    return p;
};

/** A promo only applies when active AND inside its validity window. */
export const isPromoLive = (p: Promotion, now: number = Date.now()): boolean => {
    if (!p.is_active) return false;
    if (p.starts_at && new Date(p.starts_at).getTime() > now) return false;
    if (p.ends_at && new Date(p.ends_at).getTime() <= now) return false;
    return true;
};

export const scopeHasItems = (p: Promotion): boolean =>
    (p.applies_to_product_ids?.length || 0) > 0 || (p.applies_to_category_ids?.length || 0) > 0;

/** Convert an ISO datetime to a `datetime-local` input value. */
export const toLocalInput = (iso?: string): string => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** Convert a `datetime-local` input value back to an ISO string. */
export const fromLocalInput = (v: string): string | undefined => (v ? new Date(v).toISOString() : undefined);

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Short random voucher code (6 chars, no look-alike characters). */
export const generateVoucherCode = (): string => {
    let code = '';
    for (let i = 0; i < 6; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    return code;
};

/** Unique voucher code that does not collide with existing ones. */
export const generateUniqueVoucherCode = (existing: string[]): string => {
    const taken = new Set(existing.map(c => c.toUpperCase()));
    let code = generateVoucherCode();
    let tries = 0;
    while (taken.has(code) && tries < 6) {
        code = generateVoucherCode();
        tries++;
    }
    return code;
};

/** Human-readable scope summary: "3 produk · 2 kategori" (or "Semua produk"). */
export const describeScope = (p: Promotion): string => {
    const pids = p.applies_to_product_ids || [];
    const cids = p.applies_to_category_ids || [];
    if (pids.length === 0 && cids.length === 0) return 'Semua produk';
    const parts: string[] = [];
    if (pids.length > 0) parts.push(`${pids.length} produk`);
    if (cids.length > 0) parts.push(`${cids.length} kategori`);
    return parts.join(' · ');
};