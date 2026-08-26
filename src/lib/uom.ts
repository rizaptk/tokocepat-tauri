import { Product, UomDef, WholesaleTier } from './types';

export const DEFAULT_BASE_UOM = 'Pcs';

export const PRESET_UOMS: { name: string; factor: number }[] = [
  { name: 'Pcs', factor: 1 },
  { name: 'Pack', factor: 6 },
  { name: 'Dus', factor: 24 },
  { name: 'Karton', factor: 24 },
  { name: 'Lusin', factor: 12 },
  { name: 'Kg', factor: 1 },
  { name: 'Sachet', factor: 1 },
  { name: 'Box', factor: 12 },
  { name: 'Roll', factor: 1 },
];

export const DEFAULT_WHOLESALE_TIERS: Omit<WholesaleTier, 'id'>[] = [
  { minQty: 12, maxQty: 49, price: 0, label: 'Grosir 12-49' },
  { minQty: 50, price: 0, label: 'Grosir ≥50' },
];

export function normalizeProductUoms(p: Product): Product {
  if (p.baseUom && p.uoms && p.uoms.length > 0) return p;
  const baseUom = p.baseUom || DEFAULT_BASE_UOM;
  const existing = p.uoms || [];
  const hasBase = existing.some(u => u.isBase || u.name === baseUom);
  const uoms: UomDef[] = hasBase
    ? existing.map(u => ({ ...u, factor: u.factor > 0 ? u.factor : 1 }))
    : [{ id: `uom-base-${p.id}`, name: baseUom, factor: 1, isBase: true }, ...existing];
  // Ensure exactly one base
  let baseCount = uoms.filter(u => u.isBase).length;
  if (baseCount === 0) uoms[0].isBase = true;
  if (baseCount > 1) {
    let first = true;
    for (const u of uoms) {
      if (u.isBase) {
        if (first) first = false;
        else u.isBase = false;
      }
    }
  }
  return { ...p, baseUom, uoms, wholesaleTiers: p.wholesaleTiers || [], groupPrices: p.groupPrices || [] };
}

export function getUom(p: Product, uomId?: string): UomDef {
  const norm = normalizeProductUoms(p);
  if (!uomId) return norm.uoms!.find(u => u.isBase)!;
  return norm.uoms!.find(u => u.id === uomId) || norm.uoms!.find(u => u.isBase)!;
}

export function toBaseQty(qtyUom: number, factor: number): number {
  return qtyUom * factor;
}

export function fromBaseQty(qtyBase: number, factor: number): number {
  return factor === 0 ? 0 : qtyBase / factor;
}

/**
 * Resolve price per base unit for given base qty, considering group price and wholesale tiers.
 * Priority: Group base → Qty Tier
 */
export function resolvePricePerBase(
  product: Product,
  qtyBase: number,
  groupId?: string
): number {
  const norm = normalizeProductUoms(product);
  let basePrice = product.price;
  if (groupId && norm.groupPrices) {
    const gp = norm.groupPrices.find(g => g.groupId === groupId);
    if (gp) basePrice = gp.price;
  }
  if (norm.isWholesaleEnabled && norm.wholesaleTiers && norm.wholesaleTiers.length > 0) {
    const tier = norm.wholesaleTiers
      .filter(t => qtyBase >= t.minQty && (t.maxQty == null || qtyBase <= t.maxQty))
      .sort((a, b) => b.minQty - a.minQty)[0];
    if (tier) return tier.price;
  }
  return basePrice;
}

export function resolvePricePerUom(
  product: Product,
  uom: UomDef,
  qtyBase: number,
  groupId?: string
): number {
  const pricePerBase = resolvePricePerBase(product, qtyBase, groupId);
  // If UOM has explicit price and no tier matched, use it; tier always wins when matched
  const hasTier = (product.wholesaleTiers || []).some(t => qtyBase >= t.minQty && (t.maxQty == null || qtyBase <= t.maxQty));
  if (!hasTier && uom.price != null && uom.price > 0) return uom.price;
  return pricePerBase * uom.factor;
}

export function formatUomQty(qtyUom: number, uomName: string): string {
  return `${qtyUom} ${uomName}`;
}
