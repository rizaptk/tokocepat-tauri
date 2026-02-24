
export interface Category {
    id: string;
    name: string;
    is_active: boolean;
}

export interface StoreConfig {
    id: string;
    store_name: string;
    tax_rate: number;
    currency: string;
    receipt_footer?: string;
}

export interface ModifierItem {
    id: string;
    name: string;
    additional_price: number;
}

export interface ModifierGroup {
    id: string;
    name: string;
    min_select: number;
    max_select: number;
    required: boolean;
    items: ModifierItem[];
}

export interface ProductVariant {
    id: string;
    product_id: string;
    name: string; // e.g. "Size M", "Red"
    additional_price: number;
    sku?: string;
    stock: number;
}

export type ProductType = 'retail' | 'food_and_beverage';

export interface Product {
  id: string;
  sku?: string;
  barcode?: string;
  name: string;
  category_id?: string;
  price: number;
  cost_price?: number;
  stock: number;
  track_stock: boolean;
  has_variant: boolean;
  has_modifier: boolean;
  modifier_group_ids?: string[];
  imageUrl: string;
  imageHint: string;
  is_active: boolean;
  product_type: ProductType;
  low_stock_alert?: number;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface TransactionItem {
    id: string;
    transaction_id: string;
    product_snapshot: Omit<Product, 'stock' | 'track_stock' | 'has_variant' | 'has_modifier' | 'is_active' | 'low_stock_alert'>;
    price_snapshot: number;
    cost_snapshot?: number;
    qty: number;
    subtotal: number;
}

export interface Transaction {
  id: string; // Will be invoice number or unique ID
  invoice_number: string;
  items: TransactionItem[];
  subtotal: number;
  tax_amount: number;
  total: number;
  cash_paid: number;
  change: number;
  created_at: string;
  shift_id?: string;
}

export interface StockMovement {
    id: string;
    product_id: string;
    type: 'sale' | 'adjustment' | 'lost' | 'initial_balance';
    qty_change: number; // will be negative for sales
    reference_id: string; // transaction_id for sales
    created_at: string;
}

export interface Shift {
    id: string;
    opened_at: string;
    opening_cash: number;
    closed_at?: string;
    declared_cash?: number;
    system_cash?: number;
    variance?: number;
    status: 'open' | 'closed';
}
