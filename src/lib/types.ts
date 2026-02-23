export interface Category {
    id: string;
    name: string;
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
    name: string; // e.g. "Size M", "Red"
    additional_price: number;
    stock: number;
}

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
  imageUrl: string;
  imageHint: string;
  is_active: boolean;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface Transaction {
  id: string;
  items: CartItem[];
  total: number;
  tax: number;
  subtotal: number;
  cashReceived: number;
  change: number;
  date: string;
}
