

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

export interface ProductVariant {
    id: string;
    product_id: string;
    name: string; // e.g. "Size M", "Red"
    additional_price: number;
    sku?: string;
    stock: number;
    track_stock: boolean;
    low_stock_alert?: number;
    updated_at?: string;
}

export interface Product {
  id: string;
  sku?: string;
  barcode?: string;
  name: string;
  brand?: string;
  category_id?: string;
  price: number;
  cost_price?: number;
  stock: number;
  track_stock: boolean;
  has_variant: boolean;
  imageUrl: string;
  imageHint: string;
  is_active: boolean;
  low_stock_alert?: number;
  updated_at?: string;

  is_consignment?: boolean;
  consignor_name?: string;
  consignment_commission_type?: 'percentage' | 'flat';
  consignment_commission_value?: number;
}

export interface CartItem extends Product {
  cartItemId: string; // A unique ID for this specific instance in the cart
  quantity: number;
  // `price` in a CartItem will now represent the final calculated price including variants
  selectedVariant?: ProductVariant;
  // Transient flags used by the discount engine / checkout (never persisted to the cart store)
  isFreeItem?: boolean;
  freeFromPromoId?: string;
}

/**
 * Read-only reference catalog item (bundled resource, imported into the local
 * `catalog` collection, excluded from net-sync). Used as a search fallback on
 * the Produk page; a real `products` doc is only created when the user saves
 * the promoted product form.
 */
export interface CatalogProduct {
  id: string;
  barcode: string;
  name: string;
  brand?: string;
  brand_owner?: string;
  brand_tags?: string;
  generic_name?: string;
  category_id: string;
  category_name: string;
  price: number;
  cost_price: number;
  stock: number;
  low_stock_alert: number;
  track_stock: boolean;
  is_active: boolean;
  has_variant: boolean;
  image_url?: string;
  image_small_url?: string;
  categories?: string;
  category_tags?: string;
  labels?: string;
  countries?: string;
  origins?: string;
  quantity?: string;
  net_weight?: string;
  packaging?: string;
  serving_size?: string;
  ingredients_text?: string;
  allergens?: string;
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
    product_snapshot: Omit<Product, 'stock' | 'track_stock' | 'has_variant' | 'is_active' | 'low_stock_alert'>;
    price_snapshot: number;
    cost_snapshot?: number;
    qty: number;
    subtotal: number;
    is_consignment_settled?: boolean; // true jika sudah dilunasi ke vendor, false jika belum
    consignment_settled_at?: string;  // timestamp kapan pelunasan dilakukan
    // Discount / promo snapshot (0 by default for legacy transactions)
    unit_discount?: number;     // discount in Rp applied to each charged unit (gross price before discount)
    discount_amount?: number;   // total discount for this line = unit_discount * qty
    promo_ids?: string[];       // promotion ids that contributed to this line
    is_free_item?: boolean;     // line was granted free via a promo (price_snapshot = 0)
}

export interface AppliedPromoRecord {
    promo_id: string;
    name: string;
    amount: number;   // total Rp value given up (discounts + free item value)
    kind: 'auto' | 'voucher' | 'manual';
    voucher_code?: string;
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
  device?: string; // HWID of the device that created the transaction
  status: 'paid' | 'voided';
  voided_at?: string;
  void_reason?: string;
  // Return (retur) fields — a return transaction is a separate 'return'
  // transaction that references its original 'sale' transaction. Amounts on a
  // return transaction are stored as NEGATIVE (subtotal, tax_amount, total,
  // and item qty/subtotal) so existing total-based reports net automatically.
  transaction_type?: 'sale' | 'return';
  original_transaction_id?: string;
  original_invoice?: string;
  return_reason?: string;
  condition_ok?: boolean;
  // Discount / promo snapshot (0 by default for legacy transactions).
  // `subtotal` remains the GROSS line total; `total = subtotal - discount_total + tax_amount`.
  gross_subtotal?: number;
  discount_total?: number;
  promo_discount?: number;   // auto + voucher discounts + free item value
  manual_discount?: number;  // cashier-entered manual discount
  voucher_code?: string;
  applied_promos?: AppliedPromoRecord[];
}

export type StockMovementType = 'sale' | 'restock' | 'correction' | 'lost' | 'damaged' | 'initial_balance' | 'return';

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
    total_cash_out?: number;
}

export type PromoKind = 'flat' | 'bogo' | 'criteria' | 'conditional' | 'voucher';

/** Legacy kinds written by older versions; `normalizePromo` maps them to 'flat'. */
export type LegacyPromoKind = 'product' | 'category' | 'event';

/** What a criteria / conditional promo grants once its trigger is met. */
export type PromoRewardType = 'discount' | 'bonus_product' | 'discount_product';

/**
 * A promotion rule.
 * - 'flat'        → automatic money-off on chosen products / categories
 * - 'bogo'        → Buy X, Get Y free (auto-applied at checkout/cart)
 * - 'criteria'    → activates when the whole selected scope is present in the cart,
 *                   then grants a flat order discount, a bonus product, or a
 *                   discount on another selected product
 * - 'conditional' → activates on a spend threshold (min_purchase), optionally also
 *                   requiring the selected scope in the cart; grants an order
 *                   discount or bonus product(s)
 * - 'voucher'     → discount code the cashier enters (percentage or flat Rp)
 *
 * Scope (`applies_to_product_ids` / `applies_to_category_ids`) is picked from the
 * shared left-panel checkboxes on the Promo page. A product can receive at most
 * ONE diskon (money-off OR free units) per transaction; a voucher may stack on
 * top of that diskon.
 */
export interface Promotion {
  id: string;
  name: string;
  kind: PromoKind;
  is_active: boolean;
  created_at: string;
  // Validity window (ISO datetimes). Mandatory for diskons (and vouchers expire too).
  starts_at?: string;
  ends_at?: string;
  // --- Scope (which products the rule applies to) ---
  applies_to_product_ids?: string[];  // empty = any product
  applies_to_category_ids?: string[]; // empty = any category
  // --- Reward (criteria / conditional) ---
  reward_type?: PromoRewardType;      // what is granted once the trigger is met
  reward_product_ids?: string[];      // products granted free / discounted
  require_scope?: boolean;            // conditional: also require selected scope in cart
  // --- BOGO (Buy X Get Y Free) ---
  buy_quantity?: number;        // X units you must buy
  free_quantity?: number;       // Y units you get free
  free_product_id?: string;     // if set, free units come from this product
  max_total_free_qty?: number;  // cap on free units per cart (optional)
  // --- Discount amount (flat / criteria / conditional / voucher) ---
  discount_type?: 'percentage' | 'flat';
  discount_value?: number;      // percent (0-100) or Rp
  // --- VOUCHER ---
  code?: string;                // unique code, uppercased
  min_purchase?: number;        // gross subtotal required to activate
  max_uses?: number;            // lifetime redemption cap across devices
  uses_count?: number;          // how many times it has been used
  // --- LEGACY FIELDS (kept for reading old docs; not written by new forms) ---
  trigger_product_ids?: string[];
  trigger_qty?: number;
  apply_to?: 'items' | 'cart';
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
    peer_mode?: 'master'|'slave',
    room?: string,
    key?: string,
}
