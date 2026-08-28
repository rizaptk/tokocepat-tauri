import { Percent, Gift, ListChecks, GitBranch, TicketPercent, type LucideIcon } from 'lucide-react';
import { PromoKind, PromoRewardType } from '@/lib/types';

export const KIND_META: { kind: PromoKind; label: string; icon: LucideIcon; hint: string }[] = [
    { kind: 'flat', label: 'Diskon', icon: Percent, hint: 'Potongan harga produk/kategori' },
    { kind: 'bogo', label: 'Beli X Gratis Y', icon: Gift, hint: 'Gratis item' },
    { kind: 'criteria', label: 'Kriteria', icon: ListChecks, hint: 'Beli semua produk terpilih' },
    { kind: 'conditional', label: 'Bersyarat', icon: GitBranch, hint: 'Minimal belanja' },
    { kind: 'voucher', label: 'Voucher', icon: TicketPercent, hint: 'Kode diskon' },
];

export const KIND_LABEL: Record<PromoKind, string> = Object.fromEntries(
    KIND_META.map(({ kind, label }) => [kind, label])
) as Record<PromoKind, string>;

export const KIND_ICON: Record<PromoKind, LucideIcon> = Object.fromEntries(
    KIND_META.map(({ kind, icon }) => [kind, icon])
) as Record<PromoKind, LucideIcon>;

export const REWARD_META: { value: PromoRewardType; label: string; icon: LucideIcon; hint: string }[] = [
    { value: 'discount', label: 'Flat diskon', icon: Percent, hint: 'Potongan dari total' },
    { value: 'bonus_product', label: 'Bonus produk', icon: Gift, hint: 'Produk gratis' },
];