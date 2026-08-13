/** @ts-ignore - No types available for this package */
import ReceiptPrinterEncoder from '@point-of-sale/receipt-printer-encoder';
import { Transaction, StoreConfig, AppliedPromoRecord } from './types';
import type { PaperWidth } from './print-detect-store';

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID').format(amount);
};

// Character width per paper size.
// 58mm printers are typically 32 characters wide.
// 80mm printers are typically 42-48 characters wide.
const PAPER_WIDTH_CHARS: Record<PaperWidth, number> = {
    '58mm': 32,
    '80mm': 48,
};

// Two-column layout: the right column is always kept right-aligned on the same
// line; the left column is truncated (with "..") when it would overflow.
const twoCols = (receiptWidth: number, left: string, right: string) => {
    const leftStr = String(left);
    const rightStr = String(right);

    const availForLeft = receiptWidth - rightStr.length - 1;
    const leftFitted = leftStr.length > availForLeft
        ? leftStr.slice(0, Math.max(1, availForLeft - 1)) + '..'
        : leftStr;

    const gap = Math.max(1, receiptWidth - leftFitted.length - rightStr.length);
    return leftFitted + ' '.repeat(gap) + rightStr;
};

// Truncate a single line to the printable width so long text never wraps
// awkwardly in the middle of the layout.
const fit = (receiptWidth: number, text: string): string => {
    const s = String(text);
    return s.length > receiptWidth
        ? s.slice(0, Math.max(1, receiptWidth - 2)) + '..'
        : s;
};

const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });


// Replicate the logic from transactionService
const getTaxRateForItem = (item: any, storeConfig: StoreConfig): number => {
    const { tax_settings, tax_rate } = storeConfig;
    if (!tax_settings) return tax_rate;

    // Check category override (using snapshot data)
    if (item.product_snapshot.category_id) {
        const categoryOverride = tax_settings.category_overrides.find(
            co => co.category_id === item.product_snapshot.category_id
        );
        if (categoryOverride) return categoryOverride.tax_rate;
    }

    return tax_settings.default_rate;
};

export function generateReceiptBinary(
    transaction: Transaction,
    storeConfig: StoreConfig,
    paperWidth: PaperWidth = '58mm'
): Uint8Array {
    
    const receiptWidth = PAPER_WIDTH_CHARS[paperWidth];

    const encoder = new ReceiptPrinterEncoder({
        feedBeforeCut: 2,
        columns: receiptWidth,
        language: 'esc-pos' // Explicitly set language
    });
    
    const taxGroups = new Map<number, { taxableAmount: number; taxAmount: number }>();

    transaction.items.forEach((item) => {
        const rate = getTaxRateForItem(item, storeConfig);
        const current = taxGroups.get(rate) || { taxableAmount: 0, taxAmount: 0 };
        
        // Tax base = net charged amount (gross minus discounts / free units)
        const itemTaxable = (item.subtotal || 0) - (item.discount_amount || 0);
        const itemTax = itemTaxable * rate;

        taxGroups.set(rate, {
            taxableAmount: current.taxableAmount + itemTaxable,
            taxAmount: current.taxAmount + itemTax,
        });
    });

    encoder.initialize();

    // 1. OPEN CASH DRAWER (Kick Pin 2 and Pin 5)
    // This sends the ESC p command. It will only work if a drawer is 
    // physically connected to the printer's RJ11 port.
    encoder.pulse(); 

    // --- Header ---
    encoder.align('center'); // Set alignment ONCE for the block
    
    encoder.bold(true).line(storeConfig.store_name.toUpperCase()).bold(false);

    if (storeConfig.address && storeConfig.address.trim()) {
        // We must remain in 'center' alignment
        encoder.line(storeConfig.address);
    }
    
    encoder.newline();

    // --- Transaction Info ---
    encoder.align('left'); // Reset to left for body
    encoder
        .line(`Inv: ${transaction.invoice_number}`)
        .line(`Date: ${formatDate(transaction.created_at)}`)
        .rule({ char: '-' }); 

    // --- Items ---
    transaction.items.forEach(item => {
        // Product Name (truncated to width, keep it on a single line)
        encoder.line(fit(receiptWidth, item.product_snapshot.name));

        // Price details — show the NET line total (gross minus discounts) so a
        // discounted or free line prints what the customer actually paid.
        const qtyAndPrice = `${item.qty} x ${formatCurrency(item.price_snapshot)}`;
        const discount = item.discount_amount || 0;
        const netItemTotal = item.subtotal - discount;
        const lineTotal = item.is_free_item ? 0 : netItemTotal;

        encoder.line(twoCols(receiptWidth, qtyAndPrice, formatCurrency(lineTotal)));
        if (discount > 0) {
            encoder.line(twoCols(receiptWidth, `   Diskon -${formatCurrency(discount)}`, ''));
        }
    });

    encoder.rule({ char: '-' });

    // --- Totals ---
    encoder.line(twoCols(receiptWidth, 'Subtotal', formatCurrency(transaction.subtotal)))

    // Discount lines (manual discount, voucher, free items from promos)
    (transaction.applied_promos || []).forEach((p: AppliedPromoRecord) => {
        if (p.amount > 0) {
            const label = p.kind === 'manual' ? 'Diskon Kasir' : p.name;
            const suffix = p.voucher_code ? ` (${p.voucher_code})` : '';
            encoder.line(twoCols(receiptWidth, `${label}${suffix}`, `-${formatCurrency(p.amount)}`));
        }
    });
    if (!transaction.applied_promos?.length && (transaction.discount_total || 0) > 0) {
        encoder.line(twoCols(receiptWidth, 'Diskon', `-${formatCurrency(transaction.discount_total || 0)}`));
    }

    // Print each tax rate found
    taxGroups.forEach((data, rate) => {
        if (rate === 0) return; // Skip 0% items
        const label = `Pajak (${Math.round(rate * 100)}%)`;
        encoder.line(twoCols(receiptWidth, label, formatCurrency(data.taxAmount)));
    });
    
        
    encoder.rule({ char: '=' })
        .bold(true)
        .line(twoCols(receiptWidth, 'TOTAL', formatCurrency(transaction.total)))
        .bold(false)
        .line(twoCols(receiptWidth, 'TUNAI', formatCurrency(transaction.cash_paid)))
        .line(twoCols(receiptWidth, 'KEMBALI', formatCurrency(transaction.change)))
        .newline();

    // --- Invoice barcode (scan-to-return proof) ---
    encoder.align('center');
    encoder.barcode('code128', transaction.invoice_number, { width: 2, height: 60 });
    encoder.newline();

    // --- Footer ---
    encoder.align('center');

    if (storeConfig.receipt_footer && storeConfig.receipt_footer.trim()) {
        encoder.line(storeConfig.receipt_footer);
    } else {
        encoder.line('TERIMA KASIH');
    }
    
    encoder
        .newline()
        .newline()
        .cut(); 

    return encoder.encode();
}

/**
 * ESC/POS layout for a return (retur) receipt. Amounts are stored negative on
 * the transaction, but for readability we print the returned qty / refunded
 * amounts as positive figures.
 */
export function generateReturnReceiptBinary(
    transaction: Transaction,
    storeConfig: StoreConfig,
    paperWidth: PaperWidth = '58mm'
): Uint8Array {
    const receiptWidth = PAPER_WIDTH_CHARS[paperWidth];

    const encoder = new ReceiptPrinterEncoder({
        feedBeforeCut: 2,
        columns: receiptWidth,
        language: 'esc-pos'
    });

    encoder.initialize();

    // --- Header ---
    encoder.align('center');
    encoder.bold(true).line(storeConfig.store_name.toUpperCase()).bold(false);

    if (storeConfig.address && storeConfig.address.trim()) {
        encoder.line(storeConfig.address);
    }

    encoder.bold(true).line('== STRUK RETUR ==').bold(false);
    encoder.line('PENGEMBALIAN DANA');
    encoder.newline();

    // --- Transaction Info ---
    encoder.align('left');
    encoder.line(`Rtr: ${transaction.invoice_number}`)
        .line(`Asal: ${transaction.original_invoice || '-'}`)
        .line(`Tgl: ${formatDate(transaction.created_at)}`)
        .line(`Alasan: ${fit(receiptWidth, transaction.return_reason || '-')}`)
        .rule({ char: '-' });

    // --- Returned items (positive qty / amounts for readability) ---
    transaction.items.forEach(item => {
        const qty = Math.abs(item.qty);
        const lineTotal = Math.abs(item.subtotal);
        encoder.line(fit(receiptWidth, item.product_snapshot.name));
        encoder.line(twoCols(receiptWidth, `${qty} x ${formatCurrency(item.price_snapshot)}`, formatCurrency(lineTotal)));
    });

    encoder.rule({ char: '-' });

    // --- Totals ---
    encoder.bold(true)
        .line(twoCols(receiptWidth, 'TOTAL DIKEMBALIKAN', formatCurrency(Math.abs(transaction.total))))
        .bold(false)
        .line(twoCols(receiptWidth, 'METODE', 'TUNAI (Kas Sif)'))
        .newline();

    // --- Footer ---
    encoder.align('center');

    if (storeConfig.receipt_footer && storeConfig.receipt_footer.trim()) {
        encoder.line(storeConfig.receipt_footer);
    } else {
        encoder.line('TERIMA KASIH');
    }

    encoder
        .newline()
        .newline()
        .cut();

    return encoder.encode();
}