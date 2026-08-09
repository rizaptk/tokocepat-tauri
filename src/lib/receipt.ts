/** @ts-ignore - No types available for this package */
import ReceiptPrinterEncoder from '@point-of-sale/receipt-printer-encoder';
import { Transaction, StoreConfig } from './types';

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID').format(amount);
};


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

export function generateReceiptBinary(transaction: Transaction, storeConfig: StoreConfig): Uint8Array {
    
    // 58mm printers are typically 32 characters wide. 
    // 80mm printers are typically 42-48 characters wide.
    const receiptWidth = 32;

    const encoder = new ReceiptPrinterEncoder({
        feedBeforeCut: 2,
        columns: receiptWidth,
        language: 'esc-pos' // Explicitly set language
    });
    
    // Improved Helper for two column layout
    const twoCols = (left: string, right: string) => {
        const leftStr = String(left);
        const rightStr = String(right);
        const spaceNeeded = receiptWidth - leftStr.length - rightStr.length;
        
        if (spaceNeeded > 0) {
            return leftStr + ' '.repeat(spaceNeeded) + rightStr;
        } else {
            // If text is too long, put right column on a new line right-aligned
            return leftStr + '\n' + ' '.repeat(receiptWidth - rightStr.length) + rightStr;
        }
    };

    const taxGroups = new Map<number, { taxableAmount: number; taxAmount: number }>();

    transaction.items.forEach((item) => {
        const rate = getTaxRateForItem(item, storeConfig);
        const current = taxGroups.get(rate) || { taxableAmount: 0, taxAmount: 0 };
        
        const itemTaxable = item.subtotal;
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
        .line(`Date: ${new Date(transaction.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}`)
        .rule({ char: '-' }); 

    // --- Items ---
    transaction.items.forEach(item => {
        // Product Name (Bold for clarity)
        encoder.line(item.product_snapshot.name);

        // Price details
        // Format: "1 x 10.000             10.000"
        const qtyAndPrice = `${item.qty} x ${formatCurrency(item.price_snapshot)}`;
        const totalItemPrice = formatCurrency(item.subtotal);
        
        encoder.line(twoCols(qtyAndPrice, totalItemPrice));
    });

    encoder.rule({ char: '-' });

    // --- Totals ---
    encoder.line(twoCols('Subtotal', formatCurrency(transaction.subtotal)))


        // .line(twoCols(`Tax (${Math.round((storeConfig.tax_rate || 0.11) * 100)}%)`, formatCurrency(transaction.tax_amount)))
    // Print each tax rate found
    taxGroups.forEach((data, rate) => {
        if (rate === 0) return; // Skip 0% items
        const label = `Pajak (${Math.round(rate * 100)}%)`;
        encoder.line(twoCols(label, formatCurrency(data.taxAmount)));
    });
    
        
    encoder.rule({ char: '=' })
        .bold(true)
        .line(twoCols('TOTAL', formatCurrency(transaction.total)))
        .bold(false)
        .line(twoCols('TUNAI', formatCurrency(transaction.cash_paid)))
        .line(twoCols('KEMBALI', formatCurrency(transaction.change)))
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