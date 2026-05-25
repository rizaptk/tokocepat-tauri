

export interface Category {
    id: string;
    name: string;
    is_active: boolean;
}

export interface CategoryTaxOverride {
  category_id: string;
  tax_rate: number;
}

export interface TaxSettings {
  default_rate: number;
  product_type_overrides: {
    food_and_beverage?: number;
  };
  category_overrides: CategoryTaxOverride[];
}

export interface StoreConfig {
    id: string;
    store_name: string;
    address?: string;
    tax_rate: number; // Legacy, will be default rate from tax_settings
    tax_settings?: TaxSettings;
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
    track_stock: boolean;
    low_stock_alert?: number;
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
  is_composite?: boolean;

  is_consignment?: boolean;
  consignor_name?: string;
  consignment_commission_type?: 'percentage' | 'flat';
  consignment_commission_value?: number;
}

export interface SelectedModifier {
    groupId: string;
    groupName: string;
    item: ModifierItem;
}

export interface CartItem extends Product {
  cartItemId: string; // A unique ID for this specific instance in the cart
  quantity: number;
  // `price` in a CartItem will now represent the final calculated price including modifiers
  selectedVariant?: ProductVariant;
  selectedModifiers: SelectedModifier[];
}

export interface PendingCart {
  id: string;
  name: string; // e.g. "Order at 14:30"
  createdAt: string;
  items: CartItem[];
  itemCount: number;
  total: number;
}

export interface TransactionItem {
    id: string;
    transaction_id: string;
    product_snapshot: Omit<Product, 'stock' | 'track_stock' | 'has_variant' | 'has_modifier' | 'is_active' | 'low_stock_alert' | 'modifier_group_ids'>;
    selected_modifiers_snapshot?: SelectedModifier[];
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
  status: 'paid' | 'voided';
  voided_at?: string;
  void_reason?: string;
}

export type StockMovementType = 'sale' | 'restock' | 'correction' | 'lost' | 'damaged' | 'initial_balance';

export interface StockMovement {
    id: string;
    product_id: string;
    product_name_snapshot: string;
    type: StockMovementType;
    qty_change: number; // can be negative
    reason?: string;
    reference_id: string; // transaction_id for sales, or a unique ID for manual adjustments
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
    device?: string;
}

export interface RawIngredient {
    id: string;
    name: string;
    unit_type: 'gram' | 'ml' | 'pcs';
    stock_qty: number;
    cost_per_unit: number;
}

export interface RecipeItem {
    ingredient_id: string;
    quantity: number;
}

export interface Recipe {
    product_id: string; // The composite product this recipe is for
    items: RecipeItem[];
}

export type PaymentPlan = 'PRO_MONTHLY' | 'PRO_YEARLY' | 'LIFETIME';

export interface PaymentTicket {
    id: string;
    customerId?: string;
    customerEmail: string;
    customerName: string;
    customerWhatsapp: string;
    plan: string; // Changed from PaymentPlan to string to match plan name
    status: 'pending' | 'processing' | 'resolved' | 'rejected';
    proofOfPaymentUrl: string;
    notes?: string; // Admin notes for rejection, etc.
    userNotes?: string;
    createdAt: string; // ISO String
    updatedAt: string; // ISO String
    licenseKey?: string; // The license key generated when this ticket is resolved
    licenseId?: string; // The Firestore document ID for the license
    deviceId?: string; // The unique ID of the client device that submitted the ticket
    claimedAt?: string; // Timestamp for when the client has claimed the license
}

export interface SubscriptionPlan {
    id: string;
    name: string;
    price: number;
    durationDays: number; // e.g., 30 for monthly, 365 for yearly, -1 for lifetime
    description: string;
    maxSeats: number;
    isTrial: boolean;
}

export interface PaymentInstructions {
    message?: string;
    bankName?: string;
    accountName?: string;
    accountNumber?: string;
    whatsappNumber?: string;
}

export interface CustomAccessType {
    id: string;
    name?: string;
    description?: string;
    access?: string[], 
    cashier_layout?: string ,
    peer_mode?: 'master'|'slave',
    room?: string,
    key?: string,
}
